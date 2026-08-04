import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const TEST_MODE = false;
const STRIPE_PK_TEST = "pk_test_51TRuS9EDXH0jLhRlxSLe38pD6QexUfdNwLuxrRMGlmSuyNkz5CTX3J03ltoDU9NorwBeAqx9baechszegcbKy7Hy00fQAbzjmQ";
const STRIPE_PK_LIVE = "pk_live_51TRuS9EDXH0jLhRl3r3VOAZTHWcRblzWGIy6xnorvIJheDJe5aAxCs172jinrbAQ5jJ7aLPoMxOabJ50MNLpjEmd009fTYe9Gg";
const STRIPE_PK = TEST_MODE ? STRIPE_PK_TEST : STRIPE_PK_LIVE;

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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isOverdue = due <= today;
  const isCurrentMonth = due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
  return isOverdue ? "overdue" : isCurrentMonth ? "current" : "future";
}

// ── Autopay Section Component ─────────────────────────────────────────────
function AutopaySection({ tenant }) {
  const [autopayEnabled, setAutopayEnabled] = useState(tenant?.autopay_enabled || false);
  const [autopayStep, setAutopayStep] = useState("idle"); // idle | connecting | success | disabling
  const [autopayError, setAutopayError] = useState(null);
  const autopayMountedRef = useRef(false);

  const handleEnableAutopay = async () => {
    setAutopayStep("connecting");
    setAutopayError(null);
    try {
      const { data, error } = await supabase.functions.invoke("setup-autopay", {
        body: { tenantId: tenant.id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Could not set up autopay");

      const stripe = await getStripe();

      // Collect bank account for setup (saves for future use)
      const result = await stripe.collectBankAccountForSetup({
        clientSecret: data.clientSecret,
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

      if (result.error) throw new Error(result.error.message);
      if (result.setupIntent?.status === "requires_payment_method") {
        setAutopayStep("idle");
        return;
      }

      // Confirm the setup intent
      const confirm = await stripe.confirmUsBankAccountSetup(data.clientSecret);
      if (confirm.error) throw new Error(confirm.error.message);

      const paymentMethodId = confirm.setupIntent?.payment_method;

      // Save to Supabase
      await supabase.from("tenants").update({
        autopay_enabled: true,
        stripe_payment_method_id: typeof paymentMethodId === "string" ? paymentMethodId : paymentMethodId?.id,
      }).eq("id", tenant.id);

      setAutopayEnabled(true);
      setAutopayStep("success");
    } catch (err) {
      setAutopayError(err.message || "Could not set up autopay. Please try again.");
      setAutopayStep("idle");
    }
  };

  const handleDisableAutopay = async () => {
    setAutopayStep("disabling");
    try {
      await supabase.functions.invoke("setup-autopay", {
        body: { tenantId: tenant.id, action: "disable" },
      });
      await supabase.from("tenants").update({
        autopay_enabled: false,
        stripe_payment_method_id: null,
      }).eq("id", tenant.id);
      setAutopayEnabled(false);
      setAutopayStep("idle");
    } catch (err) {
      setAutopayError("Could not disable autopay. Please try again.");
      setAutopayStep("idle");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginTop: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>🔄 Autopay</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {autopayEnabled
              ? "Your rent is automatically paid on the 1st of each month."
              : "Automatically pay rent on the 1st of each month."}
          </div>
        </div>
        <div style={{
          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
          background: autopayEnabled ? "#4caf7d" : "#d1d5db",
          position: "relative", transition: "background 0.2s",
          flexShrink: 0,
        }} onClick={autopayEnabled ? handleDisableAutopay : handleEnableAutopay}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 3,
            left: autopayEnabled ? 23 : 3,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </div>
      </div>

      {autopayEnabled && autopayStep !== "success" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#166534" }}>
          ✅ Autopay is active — your rent will be automatically charged on the 1st of each month via ACH bank transfer.
        </div>
      )}

      {autopayStep === "connecting" && (
        <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#1e40af" }}>
          ⏳ Connecting your bank account... please follow the prompts.
        </div>
      )}

      {autopayStep === "success" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#166534" }}>
          ✅ Autopay enabled! Your rent will be automatically paid on the 1st of each month.
        </div>
      )}

      {autopayStep === "disabling" && (
        <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 0" }}>Disabling autopay...</div>
      )}

      {autopayError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginTop: 8 }}>
          ⚠️ {autopayError}
        </div>
      )}

      {!autopayEnabled && autopayStep === "idle" && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>
          By enabling autopay, you authorize G&I Holdings LLC to debit your rent amount via ACH on the 1st of each month. You can disable at any time.
        </div>
      )}
    </div>
  );
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

  const lateFeeRules = tenant?.custom_late_fee ? {
    startDay: Number(tenant.late_fee_start_day) || 5,
    initialFee: tenant.initial_late_fee != null ? Number(tenant.initial_late_fee) : 35,
    dailyFee: tenant.daily_late_fee != null ? Number(tenant.daily_late_fee) : 10,
  } : {};

  const [step, setStep] = useState("summary");
  const [payMode, setPayMode] = useState(defaultPayMode);
  const [payMethod, setPayMethod] = useState("ach");
  const [prepayMonths, setPrepayMonths] = useState(1);
  const [prepayAll, setPrepayAll] = useState(false);
  const [error, setError] = useState(null);
  const [customInvoices, setCustomInvoices] = useState([]);
  const [payingCustomInvoice, setPayingCustomInvoice] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paying, setPaying] = useState(false);
  const [resultInfo, setResultInfo] = useState(null);
  const [selectedChargeIds, setSelectedChargeIds] = useState(null); // null = not yet initialized

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const cardMountedRef = useRef(false);

  const cardFee = (amt) => Math.round((amt * 0.029 + 0.30) * 100) / 100;
  const cardTotal = (amt) => Math.round((amt + cardFee(amt)) * 100) / 100;

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from("custom_invoices").select("*").eq("tenant_id", tenant.id).eq("paid", false)
      .then(({ data }) => { if (data) setCustomInvoices(data); });
  }, [tenant?.id]);

  useEffect(() => {
    if (step !== "checkout" || !paymentData || paymentData.payMethod !== "card") return;
    if (cardMountedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const stripe = await getStripe();
        if (cancelled) return;
        const elements = stripe.elements({ clientSecret: paymentData.clientSecret });
        const paymentElement = elements.create("payment");
        setTimeout(() => {
          const mountDiv = document.getElementById("stripe-card-mount");
          if (!mountDiv || cancelled) return;
          paymentElement.mount(mountDiv);
          stripeRef.current = stripe;
          elementsRef.current = elements;
          cardMountedRef.current = true;
        }, 100);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load card form.");
      }
    })();

    return () => { cancelled = true; };
  }, [step, paymentData]);

  useEffect(() => {
    if (step !== "checkout") {
      cardMountedRef.current = false;
      stripeRef.current = null;
      elementsRef.current = null;
    }
  }, [step]);

  const classified = invoices.map(inv => ({
    ...inv,
    _type: classifyInvoice(inv, now),
    liveFee: inv.is_custom || inv.payment_status === "processing" ? 0 : calcLateFee(inv.due_date, lateFeeRules),
    liveTotal: inv.payment_status === "processing" ? Number(inv.total || inv.rent || 0) : inv.is_custom ? Number(inv.rent || 0) : Number(inv.rent || 0) + calcLateFee(inv.due_date, lateFeeRules),
  }));

  const processingInvoices = classified.filter(inv => inv.payment_status === "processing" && !inv.paid);

  const payableInvoices = classified
    .filter(inv => (inv._type === "overdue" || inv._type === "current") && inv.payment_status !== "processing")
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const futureInvoices = classified
    .filter(inv => inv._type === "future" && inv.payment_status !== "processing" && !inv.is_custom)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const totalFutureMonths = futureInvoices.length;
  const prepayOptions = [1, 2, 3, 4, 5, 6].filter(n => n <= totalFutureMonths);
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

  // All payable charges combined (regular invoices + custom charges)
  const calcCustomLateFeeFor = (inv) => {
    if (!inv.late_fee_enabled) return 0;
    const startDay = inv.late_fee_start_day;
    const initialFee = Number(inv.initial_late_fee || 0);
    const dailyFee = Number(inv.daily_late_fee || 0);
    const dateStr = inv.due_date || inv.created_at;
    if (!dateStr || !startDay) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const parts = dateStr.split("T")[0].split("-");
    const due = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
    const feeStart = new Date(due.getFullYear(), due.getMonth(), startDay);
    if (today < feeStart) return 0;
    const msPerDay = 1000*60*60*24;
    const daysLate = Math.floor((today.getTime() - feeStart.getTime()) / msPerDay);
    return initialFee + (daysLate * dailyFee);
  };

  const payableCustomInvoicesWithFee = customInvoices
    .filter(i => i.payment_status !== "processing" && !i.paid)
    .map(inv => ({ ...inv, _liveTotal: Number(inv.amount || 0) + calcCustomLateFeeFor(inv), _isCustom: true }));

  // Initialize selectedChargeIds to all charges selected by default
  const allChargeIds = [
    ...payableInvoices.map(i => `inv_${i.id}`),
    ...payableCustomInvoicesWithFee.map(i => `cust_${i.id}`),
  ];
  const effectiveSelectedIds = selectedChargeIds ?? new Set(allChargeIds);

  const toggleCharge = (chargeId) => {
    const next = new Set(effectiveSelectedIds);
    if (next.has(chargeId)) { next.delete(chargeId); } else { next.add(chargeId); }
    setSelectedChargeIds(next);
    setPaymentData(null);
  };

  const selectedRegularInvoices = payableInvoices.filter(i => effectiveSelectedIds.has(`inv_${i.id}`));
  const selectedCustomInvoices = payableCustomInvoicesWithFee.filter(i => effectiveSelectedIds.has(`cust_${i.id}`));

  const multiTotal = selectedRegularInvoices.reduce((s, i) => s + i.liveTotal, 0)
    + selectedCustomInvoices.reduce((s, i) => s + i._liveTotal, 0);

  const total = payingCustomInvoice
    ? Number(payingCustomInvoice._liveTotal || payingCustomInvoice.amount)
    : payMode === "prepay" ? prepayTotal
    : payMode === "current" ? multiTotal
    : invoiceTotal;

  const currentRequest = () => ({
    tenantId: tenant.id,
    invoiceIds: payMode === "prepay"
      ? activePrepayInvoices.map(i => i.id)
      : selectedRegularInvoices.map(i => i.id),
    customInvoiceIds: payMode === "current" ? selectedCustomInvoices.map(i => i.id) : [],
    customInvoiceId: null,
  });

  const markCustomInvoiceProcessing = (invoiceId) => {
    setCustomInvoices(prev => prev.map(inv =>
      inv.id === invoiceId ? { ...inv, payment_status: "processing" } : inv
    ));
  };

  const startCheckout = async () => {
    setError(null);
    setStep("processing");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-rent-payment", {
        body: { ...currentRequest(), paymentMethod: payMethod },
      });
      if (fnErr) throw new Error(fnErr.message || "Could not start payment");
      if (data?.error) throw new Error(data.error);
      setPaymentData({ ...data, payMethod });
      setStep("checkout");
    } catch (err) {
      setError(err.message || "Could not start payment. Please try again.");
      setStep("summary");
    }
  };

  const handleSuccess = (refId, microdeposits, isCard) => {
    if (payingCustomInvoice) {
      markCustomInvoiceProcessing(payingCustomInvoice.id);
    } else if (payMode === "current") {
      selectedCustomInvoices.forEach(inv => markCustomInvoiceProcessing(inv.id));
    }
    setResultInfo({ refId, microdeposits, isCard });
    setStep("success");
    const paidInvoiceIds = payMode === "prepay"
      ? activePrepayInvoices.map(i => i.id)
      : selectedRegularInvoices.map(i => i.id);
    const paidCustomIds = payMode === "current" ? selectedCustomInvoices.map(i => i.id) : [];
    if (onPaymentSuccess) onPaymentSuccess(tenant.id, paidInvoiceIds, paidCustomIds);
  };

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
        setPaying(false);
        return;
      }
      const confirm = await stripe.confirmUsBankAccountPayment(paymentData.clientSecret);
      if (confirm.error) throw new Error(confirm.error.message);
      const status = confirm.paymentIntent?.status;
      handleSuccess(paymentData.paymentIntentId, status === "requires_action", false);
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const payWithSavedBank = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-rent-payment", {
        body: { ...currentRequest(), useSaved: true },
      });
      if (fnErr) throw new Error(fnErr.message || "Could not start payment");
      if (data?.error) throw new Error(data.error);
      handleSuccess(data.paymentIntentId, false, false);
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const payWithCard = async () => {
    if (!stripeRef.current || !elementsRef.current) {
      setError("Card form not ready yet. Please wait a moment and try again.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const { error: confirmError } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: window.location.href,
          payment_method_data: {
            billing_details: {
              name: tenant?.name || "Tenant",
              email: tenant?.login_email || tenant?.email || undefined,
            },
          },
        },
        redirect: "if_required",
      });
      if (confirmError) throw new Error(confirmError.message);
      handleSuccess(paymentData.paymentIntentId, false, true);
    } catch (err) {
      setError(err.message || "Card payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const hasUnpaidCustomInvoices = customInvoices.filter(i => i.payment_status !== "processing").length > 0;

  if (invoices.length === 0 && tenant?.paid && !hasUnpaidCustomInvoices) {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 8 }}>You're all paid up!</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Your {month} rent has been received. Thank you!</div>
        </div>
        <AutopaySection tenant={tenant} />
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
          {fmt(resultInfo?.isCard ? cardTotal(total) : total)} — {resultInfo?.isCard ? "card payments clear in 1–2 business days." : "bank transfers take 3–5 business days to clear."}
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
              : <div>Charges: <strong>{[...selectedRegularInvoices.map(i => i.month), ...selectedCustomInvoices.map(i => i.title)].join(", ") || "—"}</strong></div>
          }
          <div>Property: {tenant?.address}</div>
          <div>Method: {resultInfo?.isCard ? "💳 Debit/Credit Card" : "🏦 ACH Bank Transfer"}</div>
          <div>Ref: {resultInfo?.refId || "—"}</div>
          <div>Date: {new Date().toLocaleDateString()}</div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 14 }}>
          Your invoice will show as paid once the transfer clears.
        </div>
      </div>
      <AutopaySection tenant={tenant} />
    </div>
  );

  const processingCustomInvoices = customInvoices.filter(i => i.payment_status === "processing");
  const payableCustomInvoices = customInvoices.filter(i => i.payment_status !== "processing");

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

      {processingCustomInvoices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {processingCustomInvoices.map(inv => {
            const calcFee = () => {
              if (!inv.late_fee_enabled) return 0;
              const startDay = inv.late_fee_start_day;
              const initialFee = Number(inv.initial_late_fee || 0);
              const dailyFee = Number(inv.daily_late_fee || 0);
              const dateStr = inv.due_date || inv.created_at;
              if (!dateStr || !startDay) return 0;
              const today = new Date(); today.setHours(0,0,0,0);
              const parts = dateStr.split("T")[0].split("-");
              const due = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
              const feeStart = new Date(due.getFullYear(), due.getMonth(), startDay);
              if (today < feeStart) return 0;
              const msPerDay = 1000*60*60*24;
              const daysLate = Math.floor((today.getTime() - feeStart.getTime()) / msPerDay);
              return initialFee + (daysLate * dailyFee);
            };
            const liveTotal = Number(inv.amount || 0); // frozen — no late fees while processing
            return (
            <div key={inv.id} style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 12, padding: "12px 16px", marginBottom: 8, fontSize: 13, color: "#1e40af", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⏳ <strong>{inv.title}</strong> — payment processing (3–5 business days)</span>
              <span style={{ fontWeight: 700 }}>{fmt(liveTotal)}</span>
            </div>
            );
          })}
        </div>
      )}

      {payingCustomInvoice && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 2 }}>Paying charge</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 2 }}>{payingCustomInvoice.title}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{fmt(payingCustomInvoice._liveTotal || payingCustomInvoice.amount)}</div>
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
          {payableInvoices.length === 0 && payableCustomInvoicesWithFee.length === 0 && processingInvoices.length > 0 && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "16px", marginBottom: 14, fontSize: 14, color: "#166534", textAlign: "center" }}>
              ✅ Nothing due — your payment is processing.
            </div>
          )}

          {(payableInvoices.length > 0 || payableCustomInvoicesWithFee.length > 0) && (
            <>
              <SL>Select charges to pay</SL>
              {payableInvoices.map(inv => {
                const chargeId = `inv_${inv.id}`;
                const isSelected = effectiveSelectedIds.has(chargeId);
                const isOverdue = inv._type === "overdue";
                const rent = Number(inv.rent || 0);
                const fee = inv.liveFee || 0;
                const startDay = lateFeeRules.startDay || 5;
                const initialFee = lateFeeRules.initialFee ?? 35;
                const dailyFee = lateFeeRules.dailyFee ?? 10;
                const daysOfDaily = fee > initialFee ? Math.round((fee - initialFee) / dailyFee) : 0;
                const feeStartDate = (() => {
                  if (!inv.due_date) return null;
                  const parts = inv.due_date.split("T")[0].split("-");
                  const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, startDay));
                  return new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                })();
                return (
                  <div key={inv.id} style={{ marginBottom: 8 }}>
                    <div onClick={() => toggleCharge(chargeId)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 14px", borderRadius: fee > 0 ? "10px 10px 0 0" : 10, cursor: "pointer",
                      border: isSelected ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                      borderBottom: fee > 0 ? "none" : undefined,
                      background: isSelected ? "#f0fdf4" : "#fff",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                          background: isSelected ? "#1b3d2a" : "#fff",
                          border: isSelected ? "none" : "1.5px solid #d1d5db",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isSelected && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{inv.month}</div>
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 1 }}>{isOverdue ? "Overdue" : "Due now"}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{fmt(inv.liveTotal)}</div>
                    </div>
                    {fee > 0 && (
                      <div style={{
                        background: "#fef2f2",
                        border: isSelected ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                        borderTop: "0.5px solid #fca5a5",
                        borderRadius: "0 0 10px 10px",
                        padding: "10px 14px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: "#6b7280" }}>Rent</span>
                          <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{fmt(rent)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: daysOfDaily > 0 ? 4 : 6 }}>
                          <span style={{ color: "#dc2626" }}>One-time late fee{feeStartDate ? ` (added ${feeStartDate})` : ""}</span>
                          <span style={{ color: "#dc2626", fontWeight: 500 }}>+{fmt(initialFee)}</span>
                        </div>
                        {daysOfDaily > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                            <span style={{ color: "#dc2626" }}>{fmt(dailyFee)}/day × {daysOfDaily} day{daysOfDaily !== 1 ? "s" : ""}</span>
                            <span style={{ color: "#dc2626", fontWeight: 500 }}>+{fmt(daysOfDaily * dailyFee)}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#dc2626", paddingTop: 6, borderTop: "0.5px solid #fca5a5" }}>
                          {fmt(dailyFee)} added each day until paid
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {payableCustomInvoicesWithFee.map(inv => {
                const chargeId = `cust_${inv.id}`;
                const isSelected = effectiveSelectedIds.has(chargeId);
                return (
                  <div key={inv.id} onClick={() => toggleCharge(chargeId)} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", borderRadius: 10, marginBottom: 8, cursor: "pointer",
                    border: isSelected ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                    background: isSelected ? "#f0fdf4" : "#fff",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: isSelected ? "#1b3d2a" : "#fff",
                        border: isSelected ? "none" : "1.5px solid #d1d5db",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSelected && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{inv.title}</div>
                        <div style={{ fontSize: 11, color: "#dc2626", marginTop: 1 }}>Other charge · due immediately</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{fmt(inv._liveTotal)}</div>
                  </div>
                );
              })}

              {(selectedRegularInvoices.length > 0 || selectedCustomInvoices.length > 0) && (
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{selectedRegularInvoices.length + selectedCustomInvoices.length} charge{selectedRegularInvoices.length + selectedCustomInvoices.length !== 1 ? "s" : ""} selected</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3d2a" }}>{fmt(multiTotal)}</div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {payMode === "prepay" && step === "summary" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📅 Prepay upcoming rent</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>Select the months you want to pay — total updates automatically.</div>
          {totalFutureMonths === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "12px 0" }}>No upcoming invoices found. Contact your landlord.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
                <button onClick={() => { setPrepayAll(true); setPrepayMonths(totalFutureMonths); setPaymentData(null); }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Select all</button>
                <button onClick={() => { setPrepayAll(false); setPrepayMonths(0); setPaymentData(null); }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Clear</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {futureInvoices.map((inv, idx) => {
                  const isChecked = prepayAll || idx < prepayMonths;
                  const invAmt = Number(inv.rent || base);
                  return (
                    <div key={inv.id} onClick={() => {
                      setPaymentData(null);
                      if (prepayAll) {
                        setPrepayAll(false);
                        setPrepayMonths(idx);
                      } else if (idx < prepayMonths) {
                        setPrepayMonths(idx);
                      } else {
                        setPrepayMonths(idx + 1);
                      }
                    }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: isChecked ? "#f0f9f4" : "#fff",
                      border: isChecked ? "2px solid #4caf7d" : "1.5px solid #e5e7eb",
                      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          background: isChecked ? "#1b3d2a" : "#fff",
                          border: isChecked ? "none" : "1.5px solid #d1d5db",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isChecked && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{inv.month}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Due {inv.due_date?.split("T")[0]}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: isChecked ? "#1b3d2a" : "#374151" }}>{fmt(invAmt)}</div>
                    </div>
                  );
                })}
              </div>
              {activePrepayInvoices.length > 0 && (
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{activePrepayInvoices.length} month{activePrepayInvoices.length !== 1 ? "s" : ""} selected</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3d2a" }}>{fmt(prepayTotal)}</div>
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
          {total > 0 && (payingCustomInvoice || (payMode === "current" && (selectedRegularInvoices.length > 0 || selectedCustomInvoices.length > 0)) || (payMode === "prepay" && activePrepayInvoices.length > 0)) && (
            <>
              <SL>How would you like to pay?</SL>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <button onClick={() => setPayMethod("ach")} style={{
                  padding: "12px 10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                  border: payMethod === "ach" ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                  background: payMethod === "ach" ? "#f0f9f4" : "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🏦</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: payMethod === "ach" ? "#1b3d2a" : "#1a1a1a" }}>Bank transfer</div>
                  <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>No extra fee</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>3–5 business days</div>
                </button>
                <button onClick={() => setPayMethod("card")} style={{
                  padding: "12px 10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                  border: payMethod === "card" ? "2px solid #2563eb" : "1.5px solid #e5e7eb",
                  background: payMethod === "card" ? "#eff6ff" : "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: payMethod === "card" ? "#1d4ed8" : "#1a1a1a" }}>Debit / Credit card</div>
                  <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>+{fmt(cardFee(total))} fee</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>1–2 business days</div>
                </button>
              </div>
              {payMethod === "card" && (
                <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#1e40af" }}>
                  💳 Card total: <strong>{fmt(cardTotal(total))}</strong> (includes {fmt(cardFee(total))} processing fee)
                </div>
              )}
              <button onClick={startCheckout} style={payMethod === "card" ? cardPayBtnStyle : payBtnStyle}>
                {payMethod === "card" ? `💳 Pay ${fmt(cardTotal(total))} by card →` : `🏦 Pay ${fmt(total)} by bank transfer →`}
              </button>
            </>
          )}
          {/* Autopay section always visible at bottom */}
          <AutopaySection tenant={tenant} />
        </>
      )}

      {step === "checkout" && paymentData && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          {paymentData.payMethod === "card" ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#1d4ed8" }}>💳 Pay {fmt(cardTotal(total))} by card</div>
              <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                Card payments clear in 1–2 business days. Includes {fmt(cardFee(total))} processing fee.
              </div>
              <div id="stripe-card-mount" style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px", marginBottom: 14, minHeight: 44 }} />
              <button onClick={payWithCard} disabled={paying} style={{ ...cardPayBtnStyle, opacity: paying ? 0.6 : 1 }}>
                {paying ? "Processing..." : `💳 Pay ${fmt(cardTotal(total))} →`}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
const cardPayBtnStyle = { width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: 13, padding: "15px", fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10, marginTop: 4 };
const backBtnStyle = { width: "100%", background: "none", border: "none", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", padding: "8px" };




