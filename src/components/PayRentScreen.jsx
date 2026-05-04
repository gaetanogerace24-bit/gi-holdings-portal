import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function PayRentScreen({ tenant, invoices = [], onPaymentSuccess }) {
  const [step, setStep] = useState("summary");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoices[0]?.id || null);
  const [payMode, setPayMode] = useState("current");
  const [prepayMonths, setPrepayMonths] = useState(1);
  const [method, setMethod] = useState(null);
  const [error, setError] = useState(null);
  const [cardName, setCardName] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [zip, setZip] = useState("");
  const [achName, setAchName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [customInvoices, setCustomInvoices] = useState([]);
  const [payingCustomInvoice, setPayingCustomInvoice] = useState(null);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from("custom_invoices").select("*").eq("tenant_id", tenant.id).eq("paid", false)
      .then(({ data }) => { if (data) setCustomInvoices(data); });
  }, [tenant?.id]);  const now = new Date();
  const day = now.getDate();
  const daysLeft = Math.max(0, 5 - day);
  const month = now.toLocaleString("default", { month: "long", year: "numeric" });
  const rent = Number(tenant?.rent) || 0;
  const base = tenant?.section8 ? (Number(tenant.tenantPortion || tenant.tenant_portion) || 0) : rent;

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId) || invoices[0];
  const invoiceRent = Number(selectedInvoice?.rent) || rent;
  const invoiceLateFee = Number(selectedInvoice?.late_fee) || 0;
  const invoiceTotal = Number(selectedInvoice?.total) || invoiceRent;
  const daysLate = invoiceLateFee > 35 ? Math.round((invoiceLateFee - 35) / 10) : 0;

  const prepayTotal = base * prepayMonths;
  const total = payingCustomInvoice ? Number(payingCustomInvoice.amount) : payMode === "prepay" ? prepayTotal : invoiceTotal;

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

  const handlePay = async () => {
    if (!method) return;
    if (method === "card" && (!cardNum || !expiry || !cvv)) { setError("Please fill in all card details."); return; }
    if (method === "ach" && (!routing || !account || routing.length !== 9)) { setError("Please enter a valid routing number and account number."); return; }
    setError(null);
    setStep("processing");
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, tenantId: tenant.id, tenantName: tenant.name, address: tenant.address, paymentType: method }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTimeout(async () => {
        // If paying a custom invoice, mark it paid in Supabase
        if (payingCustomInvoice) {
          const paidDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          await supabase.from("custom_invoices").update({ paid: true, paid_date: paidDate }).eq("id", payingCustomInvoice.id);
          setCustomInvoices(prev => prev.filter(i => i.id !== payingCustomInvoice.id));
        }
        setStep("success");
        if (onPaymentSuccess && selectedInvoice) onPaymentSuccess(tenant.id, selectedInvoice.id, total);
      }, 1500);
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("checkout");
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
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Processing payment...</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>Please don't close this page</div>
    </div>
  );

  if (step === "success") return (
    <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Payment received!</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>${total.toLocaleString()} sent to G&I Holdings LLC</div>
        <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", textAlign: "left", fontSize: 13, lineHeight: 2 }}>
          <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>Payment confirmation</div>
          <div>Amount: <strong>${total.toLocaleString()}</strong></div>
          <div>Invoice: {selectedInvoice?.month || month}</div>
          <div>Property: {tenant?.address}</div>
          <div>Method: {method === "card" ? "Credit/Debit Card" : "ACH Bank Transfer"}</div>
          <div>Ref: TXN-{Math.floor(Math.random() * 9000000 + 1000000)}</div>
          <div>Date: {new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── OTHER CHARGES ─────────────────────────────────────────── */}
      {customInvoices.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SL>Other charges</SL>
          {customInvoices.map(inv => (
            <div key={inv.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 10, border: "1.5px solid #fca5a5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{inv.title}</div>
                  {inv.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{inv.notes}</div>}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Due immediately</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>${Number(inv.amount).toLocaleString()}</div>
              </div>
              <button
                onClick={() => {
                  setPayingCustomInvoice(inv);
                  setPayMode("custom");
                  setStep("summary");
                  setMethod(null);
                }}
                style={{ width: "100%", background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Pay ${Number(inv.amount).toLocaleString()} now →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── CUSTOM INVOICE PAYMENT FLOW ───────────────────────────── */}
      {payingCustomInvoice && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 2 }}>Paying charge</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 2 }}>{payingCustomInvoice.title}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>${Number(payingCustomInvoice.amount).toLocaleString()}</div>
            <button onClick={() => { setPayingCustomInvoice(null); setPayMode("current"); setStep("summary"); setMethod(null); }}
              style={{ marginTop: 8, fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              ← Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── RENT PAYMENT ──────────────────────────────────────────── */}
      {!payingCustomInvoice && <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {[{ key: "current", label: "💳 Pay balance" }, { key: "prepay", label: "📅 Prepay rent" }].map(m => (
          <button key={m.key} onClick={() => { setPayMode(m.key); setStep("summary"); setMethod(null); }} style={{
            flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer",
            background: payMode === m.key ? "#fff" : "transparent",
            color: payMode === m.key ? "#1b3d2a" : "#6b7280",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: payMode === m.key ? 700 : 400,
            boxShadow: payMode === m.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
          }}>{m.label}</button>
        ))}
      </div>}

      {payMode === "current" && invoices.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <SL>Select invoice to pay</SL>
          {invoices.map(inv => {
            const fee = Number(inv.late_fee) || 0;
            const days = fee > 35 ? Math.round((fee - 35) / 10) : 0;
            return (
              <button key={inv.id} onClick={() => setSelectedInvoiceId(inv.id)} style={{
                width: "100%", marginBottom: 8, padding: "14px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                border: selectedInvoiceId === inv.id ? "2px solid #dc2626" : "1.5px solid #e5e7eb",
                background: selectedInvoiceId === inv.id ? "#fef2f2" : "#fff",
                fontFamily: "'DM Sans', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{inv.month} — OVERDUE</div>
                  {fee > 0 && <div style={{ fontSize: 12, color: "#dc2626" }}>$35 base + ${days * 10} ({days} days × $10) = ${fee} late fees</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#991b1b" }}>${Number(inv.total).toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      )}

      {payMode === "current" && (day < 5 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#166534" }}>
          ✅ No late fees yet — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</strong> before the 5th.
        </div>
      ) : invoiceLateFee > 0 ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#991b1b" }}>
          ⚠️ <strong>Late fee applied.</strong> ${invoiceLateFee} total late fees on this invoice.
        </div>
      ) : null)}

      {payMode === "prepay" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📅 Prepay upcoming rent</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Lock in now — no late fees, no stress.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[1, 2, 3, 6].map(n => (
              <button key={n} onClick={() => setPrepayMonths(n)} style={{
                padding: "10px 16px", borderRadius: 9, cursor: "pointer",
                border: prepayMonths === n ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                background: prepayMonths === n ? "#f0f9f4" : "#fff",
                color: prepayMonths === n ? "#1b3d2a" : "#6b7280",
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
              }}>{n} mo{n > 1 ? "s" : ""} — ${(base * n).toLocaleString()}</button>
            ))}
          </div>
        </div>
      )}

      {payMode === "current" && selectedInvoice && (
        <>
          <SL>Payment breakdown — {selectedInvoice.month}</SL>
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
            <Row label="Monthly rent" value={`$${invoiceRent.toLocaleString()}.00`} />
            {invoiceLateFee > 0 && <>
              <Row label="Base late fee (day 1 — Apr 5)" value="+ $35.00" danger />
              {daysLate > 0 && <Row label={`Daily fees ($10 × ${daysLate} days)`} value={`+ $${daysLate * 10}.00`} danger />}
            </>}
            {invoiceLateFee === 0 && <Row label="Late fee" value="$0.00" />}
            <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 10, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Total due</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#1b3d2a" }}>${invoiceTotal.toLocaleString()}.00</span>
            </div>
          </div>
        </>
      )}

      {step === "summary" && (
        <>
          <SL>Choose payment method</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[{ key: "card", icon: "💳", label: "Credit / Debit", sub: "Visa, Mastercard, Amex" }, { key: "ach", icon: "🏦", label: "Bank Transfer", sub: "ACH · Checking or Savings" }].map(m => (
              <button key={m.key} onClick={() => { setMethod(m.key); setStep("checkout"); }} style={{ padding: "18px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center", border: "1.5px solid #e5e7eb", background: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "checkout" && method === "card" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1b3d2a" }}>💳 Enter card details</div>
          <FF label="Name on card" value={cardName} onChange={setCardName} placeholder={tenant?.name} />
          <FF label="Card number" value={cardNum} onChange={v => setCardNum(formatCard(v))} placeholder="1234 5678 9012 3456" inputMode="numeric" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <FF label="Expiry" value={expiry} onChange={v => setExpiry(formatExpiry(v))} placeholder="MM/YY" inputMode="numeric" />
            <FF label="CVV" value={cvv} onChange={v => setCvv(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
            <FF label="ZIP" value={zip} onChange={v => setZip(v.replace(/\D/g, "").slice(0, 5))} placeholder="44511" inputMode="numeric" />
          </div>
          {error && <ErrBox msg={error} />}
          <button onClick={handlePay} style={payBtnStyle}>Pay ${total.toLocaleString()} now →</button>
          <button onClick={() => { setStep("summary"); setError(null); }} style={backBtnStyle}>← Back</button>
        </div>
      )}

      {step === "checkout" && method === "ach" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#1b3d2a" }}>🏦 Enter bank details</div>
          <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>ACH transfers take 3–5 business days.</div>
          <FF label="Account holder name" value={achName} onChange={setAchName} placeholder={tenant?.name} />
          <div style={{ marginBottom: 12 }}>
            <Label>Account type</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {["checking", "savings"].map(t => (
                <button key={t} onClick={() => setAccountType(t)} style={{ flex: 1, padding: "9px", borderRadius: 9, cursor: "pointer", border: accountType === t ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb", background: accountType === t ? "#f0f9f4" : "#fff", color: accountType === t ? "#1b3d2a" : "#6b7280", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </div>
          <FF label="Routing number (9 digits)" value={routing} onChange={v => setRouting(v.replace(/\D/g, "").slice(0, 9))} placeholder="021000021" inputMode="numeric" />
          <FF label="Account number" value={account} onChange={v => setAccount(v.replace(/\D/g, "").slice(0, 17))} placeholder="Your account number" inputMode="numeric" />
          {error && <ErrBox msg={error} />}
          <button onClick={handlePay} style={payBtnStyle}>Submit ACH — ${total.toLocaleString()} →</button>
          <button onClick={() => { setStep("summary"); setError(null); }} style={backBtnStyle}>← Back</button>
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
function Label({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>; }
function ErrBox({ msg }) { return <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>⚠️ {msg}</div>; }
function FF({ label, value, onChange, placeholder, inputMode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode || "text"} style={{ width: "100%", padding: "12px 13px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#1a1a1a", boxSizing: "border-box", outline: "none" }} />
    </div>
  );
}
const payBtnStyle = { width: "100%", background: "#4caf7d", color: "#fff", border: "none", borderRadius: 13, padding: "15px", fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10, marginTop: 4 };
const backBtnStyle = { width: "100%", background: "none", border: "none", color: "#9ca3af", fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", padding: "8px" };
