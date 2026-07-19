import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// ═══════════════════════════════════════════════════════════════════
// STRIPE SETUP — paste your PUBLISHABLE keys here (they are safe to
// have in frontend code — they can't move money, only start payments).
// Get them from Stripe -> Developers -> API keys ("Publishable key").
// TEST_MODE must match the STRIPE_TEST_MODE secret in Supabase:
//   testing:  TEST_MODE = true   and STRIPE_TEST_MODE secret = true
//   go live:  TEST_MODE = false  and STRIPE_TEST_MODE secret = false
// ═══════════════════════════════════════════════════════════════════
const TEST_MODE = false;
const STRIPE_PK_TEST = "pk_test_51TRuS9EDXH0jLhRlxSLe38pD6QexUfdNwLuxrRMGlmSuyNkz5CTX3J03ltoDU9NorwBeAqx9baechszegcbKy7Hy00fQAbzjmQ";
const STRIPE_PK_LIVE = "pk_live_51TRuS9EDXH0jLhRl3r3VOAZTHWcRblzWGIy6xnorvIJheDJe5aAxCs172jinrbAQ5jJ7aLPoMxOabJ50MNLpjEmd009fTYe9Gg";
const STRIPE_PK = TEST_MODE ? STRIPE_PK_TEST : STRIPE_PK_LIVE;

// Loads Stripe.js once and reuses it
let stripePromise = null;
function getStripe() {
  if (stripePromise) return stripePromise;
  stripePromise = new Promise((resolve, reject) => {
    if (window.Stripe) return resolve(window.Stripe(STRIPE_PK));
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => resolve(window.Stripe(STRIPE_PK));
    script.onerror = () => reject(new Error("Could not load payment system. Check your connection and try again."));
    document.head.appendChild(script);
  });
  return stripePromise;
}

function fmt(n) {
  const num = Number(n) || 0;
  return num % 1 === 0
    ? "$" + num.toLocaleString()
    : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// rules = { startDay, initialFee, dailyFee } — tenant's custom values or {} for global defaults
function calcLateFee(dueDateStr, rules = {}) {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dueDateStr.split("T")[0].split("-");
  if (parts.length !== 3) return 0;
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const startDay = Number(rules.startDay) || 5;
  const initialFee = rules.initialFee != null ? Number(rules.initialFee) : 35;
  const dailyFee = rules.dailyFee != null ? Number(rules.dailyFee) : 10;
  const feeStart = new Date(due.getFullYear(), due.getMonth(), startDay);
  if (today < feeStart) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysAfterFeeStart = Math.floor((today - feeStart) / msPerDay);
  return initialFee + daysAfterFeeStart * dailyFee;
}

function classifyInvoice(inv, now) {
  const parts = (inv.due_date || "").split("T")[0].split("-");
  if (parts.length !== 3) return "future";
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const isCurrentMonth = due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
  const isOverdue = !isCurrentMonth && (
    due.getFullYear() < now.getFullYear() ||
    (due.getFullYear() === now.getFullYear() && due.getMonth() < now.getMonth())
  );
  return isOverdue ? "overdue" : isCurrentMonth ? "current" : "future";
}

export default function PayRentScreen({ tenant, invoices = [], onPaymentSuccess, defaultPayMode = "current" }) {
  const now = new Date();
  const day = now.getDate();
  const effectiveStartDay = (tenant?.custom_late_fee && tenant?.late_fee_start_day) ? Number(tenant.late_fee_start_day) : 5;
  const daysLeft = Math.max(0, effectiveStartDay - day);
  const month = now.toLocaleString("default", { month: "long", year: "numeric" });
  const rent = Number(tenant?.rent) || 0;
  const base = tenant?.section8
    ? (Number(tenant.tenantPortion || tenant.tenant_portion) || 0)
    : rent;

  // Per-tenant late fee rules — falls back to global defaults when not set
  const lateFeeRules = tenant?.custom_late_fee ? {
    startDay: Number(tenant.late_fee_start_day) || 5,
    initialFee: tenant.initial_late_fee != null ? Number(tenant.initial_late_fee) : 35,
    dailyFee: tenant.daily_late_fee != null ? Number(tenant.daily_late_fee) : 10,
  } : {};

  const [step, setStep] = useState("summary");
  const [payMode, setPayMode] = useState(defaultPayMode);
  const [prepayMonths, setPrepayMonths] = useState(1);
  const [prepayAll, setPrepayAll] = useState(false);
  const [error, setError] = useState(null);
  const [customInvoices, setCustomInvoices] = useState([]);
  const [payingCustomInvoice, setPayingCustomInvoice] = useState(null);

  // Stripe payment state
  const [paymentData, setPaymentData] = useState(null); // { clientSecret, paymentIntentId, amount, savedBank }
  const [paying, setPaying] = useState(false);
  const [resultInfo, setResultInfo] = useState(null); // { refId, microdeposits }

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from("custom_invoices").select("*").eq("tenant_id", tenant.id).eq("paid", false)
      .then(({ data }) => { if (data) setCustomInvoices(data); });
  }, [tenant?.id]);

  const classified = invoices.map(inv => ({
    ...inv,
    _type: classifyInvoice(inv, now),
    liveFee: inv.is_custom ? 0 : calcLateFee(inv.due_date, lateFeeRules),
    liveTotal: inv.is_custom ? Number(inv.rent || 0) : Number(inv.rent || 0) + calcLateFee(inv.due_date, lateFeeRules),
  }));

  const processingInvoices = classified.filter(inv => inv.payment_status === "processing" && !inv.paid);

  const payableInvoices = classified
    .filter(inv => (inv._type === "overdue" || inv._type === "current") && inv.payment_status !== "processing")
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const futureInvoices = classified
    .filter(inv => inv._type === "future" && inv.payment_status !== "processing")
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const totalFutureMonths = futureInvoices.length;
  const prepayOptions = [1, 2, 3, 6].filter(n => n <= totalFutureMonths);
  const showRemainderOption = totalFutureMonths > 6;

  const activePrepayInvoices = prepayAll
    ? futureInvoices
    : futureInvoices.slice(0, prepayMonths);

  const prepayTotal = activePrepayInvoices.reduce(
    (sum, inv) => sum + Number(inv.rent || base), 0
  );

  const defaultInvoice = payableInvoices.find(i => i._type === "overdue") || payableInvoices[0] || null;
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(defaultInvoice?.id || null);

  useEffect(() => {
    if (!selectedInvoiceId && defaultInvoice) setSelectedInvoiceId(defaultInvoice.id);
  }, [invoices.length]);

  const selectedInvoice = payableInvoices.find(i => i.id === selectedInvoiceId) || payableInvoices[0];
  const invoiceRent = Number(selectedInvoice?.rent) || rent;
  const invoiceLateFee = selectedInvoice ? (selectedInvoice.is_custom ? 0 : calcLateFee(selectedInvoice.due_date, lateFeeRules)) : 0;
  const invoiceTotal = invoiceRent + invoiceLateFee;
  const daysLate = invoiceLateFee > 35 ? Math.round((invoiceLateFee - 35) / 10) : 0;
  const isSelectedOverdue = selectedInvoice?._type === "overdue";

  const total = payingCustomInvoice
    ? Number(payingCustomInvoice.amount)
    : payMode === "prepay" ? prepayTotal : invoiceTotal;

  const currentRequest = () => ({
    tenantId: tenant.id,
    invoiceIds: payingCustomInvoice
      ? []
      : payMode === "prepay"
        ? activePrepayInvoices.map(i => i.id)
        : selectedInvoice ? [selectedInvoice.id] : [],
    customInvoiceId: payingCustomInvoice ? payingCustomInvoice.id : null,
  });

  // Step 1: ask the server to set up the payment (amount computed server-side)
  const startCheckout = async () => {
    setError(null);
    setStep("processing");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-rent-payment", {
        body: currentRequest(),
      });
      if (fnErr) throw new Error(fnErr.message || "Could not start payment");
      if (data?.error) throw new Error(data.error);
      setPaymentData(data);
      setStep("checkout");
    } catch (err) {
      setError(err.message || "Could not start payment. Please try again.");
      setStep("summary");
    }
  };

  // Step 2a: pay with a NEW bank account (Stripe's secure bank-connection window)
  const payWithNewBank = async () => {
    if (!paymentData?.clientSecret) return;
    setPaying(true);
    setError(null);
    try {
      const stripe = await getStripe();
      const collect = await stripe.collectBankAccountForPayment({
        clientSecret: paymentData.clientSecret,
        params: {
          payment_method_type: "us_bank_account",
          payment_method_data: {
            billing_details: {
              name: tenant?.name || "Tenant",
              email: tenant?.login_email || tenant?.email || undefined,
            },
          },
        },
      });
      if (collect.error) throw new Error(collect.error.message);
      if (collect.paymentIntent?.status === "requires_payment_method") {
        // Tenant closed the bank window without finishing
        setPaying(false);
        return;
      }

      const confirm = await stripe.confirmUsBankAccountPayment(paymentData.clientSecret);
      if (confirm.error) throw new Error(confirm.error.message);

      const status = confirm.paymentIntent?.status;
      setResultInfo({
        refId: paymentData.paymentIntentId,
        microdeposits: status === "requires_action",
      });
      setStep("success");
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  // Step 2b: one-click pay with the bank saved from a previous payment
  const payWithSavedBank = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-rent-payment", {
        body: { ...currentRequest(), useSaved: true },
      });
      if (fnErr) throw new Error(fnErr.message || "Could not start payment");
      if (data?.error) throw new Error(data.error);
      setResultInfo({ refId: data.paymentIntentId, microdeposits: false });
      setStep("success");
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (invoices.length === 0 && tenant?.paid) {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 8 }}>You're all paid up!</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Your {month} rent has been received. Thank you!</div>
        </div>
      </div>
    );
  }

  if (step === "processing") return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Setting up your payment...</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>Please don't close this page</div>
    </div>
  );

  if (step === "success") return (
    <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Payment submitted!</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
          {fmt(total)} — bank transfers take 3–5 business days to clear.
        </div>
        {resultInfo?.microdeposits && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 16px", textAlign: "left", fontSize: 13, color: "#92400e", marginBottom: 14 }}>
            <strong>One more step:</strong> your bank couldn't be verified instantly. Stripe will send a small
            deposit to your account in 1–2 days with a 6-character code — follow the emailed link to confirm it,
            and your payment will complete automatically.
          </div>
        )}
        <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", textAlign: "left", fontSize: 13, lineHeight: 2 }}>
          <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>Payment confirmation</div>
          <div>Amount: <strong>{fmt(total)}</strong></div>
          {payMode === "prepay" && !payingCustomInvoice
            ? <div>Months covered: <strong>{activePrepayInvoices.map(i => i.month).join(", ") || "—"}</strong></div>
            : payingCustomInvoice
              ? <div>Charge: <strong>{payingCustomInvoice.title}</strong></div>
              : <div>Invoice: <strong>{selectedInvoice?.month || month}</strong></div>
          }
          <div>Property: {tenant?.address}</div>
          <div>Method: ACH Bank Transfer</div>
          <div>Ref: {resultInfo?.refId || "—"}</div>
          <div>Date: {new Date().toLocaleDateString()}</div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 14 }}>
          Your invoice will show as paid once the transfer clears.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>

      {processingInvoices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {processingInvoices.map(inv => (
            <div key={inv.id} style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 12, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: "#1e40af", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⏳ <strong>{inv.month}</strong> — payment processing (3–5 business days)</span>
              <span style={{ fontWeight: 700 }}>{fmt(inv.liveTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {customInvoices.filter(i => i.payment_status !== "processing").length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SL>Other charges</SL>
          {customInvoices.filter(i => i.payment_status !== "processing").map(inv => (
            <div key={inv.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 10, border: "1.5px solid #fca5a5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{inv.title}</div>
                  {inv.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{inv.notes}</div>}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Due immediately</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{fmt(inv.amount)}</div>
              </div>
              <button onClick={() => { setPayingCustomInvoice(inv); setPayMode("custom"); setStep("summary"); }}
                style={{ width: "100%", background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Pay {fmt(inv.amount)} now →
              </button>
            </div>
          ))}
        </div>
      )}

      {payingCustomInvoice && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 2 }}>Paying charge</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 2 }}>{payingCustomInvoice.title}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{fmt(payingCustomInvoice.amount)}</div>
            <button onClick={() => { setPayingCustomInvoice(null); setPayMode("current"); setStep("summary"); setPaymentData(null); }}
              style={{ marginTop: 8, fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              ← Cancel
            </button>
          </div>
        </div>
      )}

      {!payingCustomInvoice && step === "summary" && (
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {[{ key: "current", label: "💳 Pay balance" }, { key: "prepay", label: "📅 Prepay rent" }].map(m => (
            <button key={m.key} onClick={() => { setPayMode(m.key); setStep("summary"); setPaymentData(null); }} style={{
              flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer",
              background: payMode === m.key ? "#fff" : "transparent",
              color: payMode === m.key ? "#1b3d2a" : "#6b7280",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: payMode === m.key ? 700 : 400,
              boxShadow: payMode === m.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}>{m.label}</button>
          ))}
        </div>
      )}

      {payMode === "current" && !payingCustomInvoice && step === "summary" && (
        <>
          {payableInvoices.length === 0 && processingInvoices.length > 0 && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "16px", marginBottom: 14, fontSize: 14, color: "#166534", textAlign: "center" }}>
              ✅ Nothing due — your payment is processing.
            </div>
          )}
          {selectedInvoice && invoiceLateFee > 0 ? (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#991b1b" }}>
              ⚠️ <strong>+${lateFeeRules.dailyFee != null ? `$${lateFeeRules.dailyFee}` : "$10.00"} every day until paid.</strong> You currently owe <strong>{fmt(invoiceLateFee)}</strong> in late fees on this invoice.
            </div>
          ) : selectedInvoice && day < 5 ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#166534" }}>
              ✅ No late fees yet — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</strong> before the {effectiveStartDay}{effectiveStartDay === 1 ? "st" : effectiveStartDay === 2 ? "nd" : effectiveStartDay === 3 ? "rd" : "th"}.
            </div>
          ) : null}

          {payableInvoices.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <SL>Select invoice to pay</SL>
              {payableInvoices.map(inv => {
                const fee = inv.is_custom ? 0 : calcLateFee(inv.due_date, lateFeeRules);
                const t = Number(inv.rent || 0) + fee;
                const isOverdue = inv._type === "overdue";
                const isSelected = selectedInvoiceId === inv.id;
                return (
                  <button key={inv.id} onClick={() => { setSelectedInvoiceId(inv.id); setPaymentData(null); }} style={{
                    width: "100%", marginBottom: 8, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: isSelected ? `2px solid ${isOverdue ? "#dc2626" : "#166534"}` : "1.5px solid #e5e7eb",
                    background: isSelected ? (isOverdue ? "#fef2f2" : "#f0fdf4") : "#fff",
                    fontFamily: "'DM Sans', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
                        {isOverdue ? "⚠️ " : ""}{inv.month} — {isOverdue ? "OVERDUE" : "CURRENT"}
                      </div>
                      {fee > 0 && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>{fmt(fee)} in late fees</div>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isOverdue ? "#991b1b" : "#1b3d2a" }}>{fmt(t)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {payableInvoices.length === 1 && selectedInvoice && (
            <div style={{ background: isSelectedOverdue ? "#fef2f2" : "#f0fdf4", border: `2px solid ${isSelectedOverdue ? "#fca5a5" : "#86efac"}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: isSelectedOverdue ? "#991b1b" : "#166534", marginBottom: 4 }}>
                {isSelectedOverdue ? "⚠️ Overdue" : "📅 Current invoice"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{selectedInvoice.month}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: isSelectedOverdue ? "#dc2626" : "#1b3d2a" }}>{fmt(invoiceTotal)}</div>
            </div>
          )}

          {selectedInvoice && (
            <>
              <SL>Payment breakdown — {selectedInvoice.month}</SL>
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
                <Row label="Monthly rent" value={fmt(invoiceRent)} />
                {invoiceLateFee > 0 && <>
                  <Row label="Base late fee (day 1 — 5th)" value="+ $35.00" danger />
                  {daysLate > 0 && <Row label={`Daily fees ($10 × ${daysLate} days)`} value={`+ $${daysLate * 10}.00`} danger />}
                </>}
                {invoiceLateFee === 0 && <Row label="Late fee" value="$0.00" />}
                <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 10, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Total due</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#1b3d2a" }}>{fmt(invoiceTotal)}</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {payMode === "prepay" && step === "summary" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📅 Prepay upcoming rent</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Lock in now — no late fees, no stress.</div>
          {totalFutureMonths === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "12px 0" }}>No upcoming invoices found. Contact your landlord.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: showRemainderOption ? 10 : 16 }}>
                {prepayOptions.map(n => {
                  const invs = futureInvoices.slice(0, n);
                  const t = invs.reduce((s, i) => s + Number(i.rent || base), 0);
                  const isActive = !prepayAll && prepayMonths === n;
                  return (
                    <button key={n} onClick={() => { setPrepayMonths(n); setPrepayAll(false); setPaymentData(null); }} style={{
                      padding: "10px 16px", borderRadius: 9, cursor: "pointer",
                      border: isActive ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                      background: isActive ? "#f0f9f4" : "#fff",
                      color: isActive ? "#1b3d2a" : "#6b7280",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                    }}>{n} mo{n > 1 ? "s" : ""} — {fmt(t)}</button>
                  );
                })}
              </div>
              {showRemainderOption && (
                <button onClick={() => { setPrepayAll(true); setPrepayMonths(totalFutureMonths); setPaymentData(null); }} style={{
                  width: "100%", padding: "12px 16px", borderRadius: 9, cursor: "pointer", marginBottom: 16,
                  border: prepayAll ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                  background: prepayAll ? "#f0f9f4" : "#fff",
                  color: prepayAll ? "#1b3d2a" : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>🏠 Remainder of lease ({totalFutureMonths} months)</span>
                  <span style={{ fontWeight: 800, color: prepayAll ? "#1b3d2a" : "#374151" }}>
                    {fmt(futureInvoices.reduce((s, i) => s + Number(i.rent || base), 0))}
                  </span>
                </button>
              )}
              {activePrepayInvoices.length > 0 && (
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#9ca3af", marginBottom: 8 }}>Months covered</div>
                  {activePrepayInvoices.map(inv => (
                    <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>
                      <span style={{ color: "#374151" }}>{inv.month}</span>
                      <span style={{ fontWeight: 600, color: "#1b3d2a" }}>{fmt(inv.rent || base)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#1b3d2a" }}>{fmt(prepayTotal)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === "summary" && (
        <>
          {error && <ErrBox msg={error} />}
          {total > 0 && (payingCustomInvoice || (payMode === "current" && selectedInvoice) || (payMode === "prepay" && activePrepayInvoices.length > 0)) && (
            <button onClick={startCheckout} style={payBtnStyle}>
              🏦 Pay {fmt(total)} by bank transfer →
            </button>
          )}
        </>
      )}

      {step === "checkout" && paymentData && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#1b3d2a" }}>🏦 Pay {fmt(total)} from your bank</div>
          <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            ACH transfers take 3–5 business days. Your invoice shows as paid once the transfer clears.
          </div>

          {paymentData.savedBank && (
            <button onClick={payWithSavedBank} disabled={paying} style={{ ...payBtnStyle, opacity: paying ? 0.6 : 1 }}>
              {paying ? "Submitting..." : `Pay with ${paymentData.savedBank.bank} ••••${paymentData.savedBank.last4} →`}
            </button>
          )}

          <button onClick={payWithNewBank} disabled={paying} style={paymentData.savedBank
            ? { width: "100%", padding: "13px", borderRadius: 12, cursor: "pointer", border: "1.5px solid #1b3d2a", background: "#fff", color: "#1b3d2a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: paying ? 0.6 : 1 }
            : { ...payBtnStyle, opacity: paying ? 0.6 : 1 }}>
            {paying ? "Connecting..." : paymentData.savedBank ? "Use a different bank account" : "Connect your bank & pay →"}
          </button>

          <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, marginBottom: 10 }}>
            By clicking Pay, you authorize G&I Holdings LLC to debit the amount shown above from your bank
            account via ACH, and to save this account for future rent payments you initiate.
          </div>

          {error && <ErrBox msg={error} />}
          <button onClick={() => { setStep("summary"); setError(null); setPaymentData(null); }} style={backBtnStyle}>← Back</button>
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>🔒 Secured by Stripe · Funds go directly to G&I Holdings LLC</div>
    </div>
  );
}

function Row({ label, value, danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: danger ? "#dc2626" : "#1a1a1a" }}>{value}</span>
    </div>
  );
}
function SL({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8 }}>{children}</div>; }
function ErrBox({ msg }) { return <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>⚠️ {msg}</div>; }
const payBtnStyle = { width: "100%", background: "#4caf7d", color: "#fff", border: "none", borderRadius: 13, padding: "15px", fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10, marginTop: 4 };
const backBtnStyle = { width: "100%", background: "none", border: "none", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", padding: "8px" };
