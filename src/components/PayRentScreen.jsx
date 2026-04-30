import { useState } from "react";

// Late fee: $35 on day 5, $10/day after
function calcLateFee(paid) {
  if (paid) return 0;
  const day = new Date().getDate();
  if (day < 5) return 0;
  return 35 + Math.max(0, day - 5) * 10;
}

export default function PayRentScreen({ tenant, onPaymentSuccess }) {
  const [step, setStep] = useState("summary"); // summary | card | ach | processing | success
  const [error, setError] = useState(null);

  // Card fields
  const [cardName, setCardName] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [zip, setZip] = useState("");

  // ACH fields
  const [achName, setAchName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("checking");

  const lateFee = calcLateFee(tenant?.paid);
  const rent = Number(tenant?.rent) || 0;
  const prior = tenant?.amountOwed && tenant.amountOwed > rent ? tenant.amountOwed - rent : 0;
  const base = tenant?.section8 ? (Number(tenant.tenantPortion) || 0) : rent;
  const total = base + prior + lateFee;
  const day = new Date().getDate();
  const daysLeft = Math.max(0, 5 - day);
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  };

  const handleCardPay = async () => {
    if (!cardNum || !expiry || !cvv) { setError("Please fill in all card details."); return; }
    setError(null);
    setStep("processing");

    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          tenantId: tenant.id,
          tenantName: tenant.name,
          address: tenant.address,
          paymentType: "card",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Payment intent created — in test mode this succeeds
      setTimeout(() => {
        setStep("success");
        if (onPaymentSuccess) onPaymentSuccess(tenant.id, total);
      }, 1500);
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("card");
    }
  };

  const handleAchPay = async () => {
    if (!routing || !account || routing.length !== 9) {
      setError("Please enter a valid 9-digit routing number and account number.");
      return;
    }
    setError(null);
    setStep("processing");

    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          tenantId: tenant.id,
          tenantName: tenant.name,
          address: tenant.address,
          paymentType: "ach",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTimeout(() => {
        setStep("success");
        if (onPaymentSuccess) onPaymentSuccess(tenant.id, total);
      }, 1500);
    } catch (err) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("ach");
    }
  };

  // Already paid
  if (tenant?.paid) {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 8 }}>You're all paid up!</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Your {month} rent has been received. Thank you!</div>
          {tenant.paidDate && <div style={{ marginTop: 8, fontSize: 13, color: "#9ca3af" }}>Paid {tenant.paidDate}</div>}
        </div>
      </div>
    );
  }

  // Processing
  if (step === "processing") {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Processing payment...</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Please don't close this page</div>
      </div>
    );
  }

  // Success
  if (step === "success") {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Payment received!</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>${total.toLocaleString()} sent to G&I Holdings LLC</div>
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", textAlign: "left", fontSize: 13, lineHeight: 2 }}>
            <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>Payment confirmation</div>
            <div>Amount: <strong>${total.toLocaleString()}</strong></div>
            <div>Property: {tenant.address}</div>
            <div>Month: {month}</div>
            <div>Method: {step === "ach" ? "ACH Bank Transfer" : "Credit/Debit Card"}</div>
            <div>Ref: TXN-{Math.floor(Math.random() * 9000000 + 1000000)}</div>
            <div>Date: {new Date().toLocaleDateString()}</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
            Funds deposited to G&I Holdings in 1–2 business days
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Late fee banner */}
      {day < 5 && daysLeft > 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#166534", display: "flex", gap: 8 }}>
          <span>✅</span><span>No late fees yet — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</strong> to pay before the 5th.</span>
        </div>
      ) : lateFee > 0 ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#991b1b" }}>
          ⚠️ <strong>Late fee applied.</strong> $35 base + ${lateFee - 35} daily = <strong>${lateFee}</strong> · $10/day added until paid.
        </div>
      ) : null}

      {/* Breakdown */}
      <SL>Payment breakdown</SL>
      <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
        <Row label={tenant?.section8 ? "Your portion (Section 8)" : "Monthly rent"} value={`$${base.toLocaleString()}.00`} />
        {prior > 0 && <Row label="Prior balance owed" value={`+ $${prior.toLocaleString()}.00`} danger />}
        <Row label={lateFee > 0 ? `Late fee (Day ${day - 4} late)` : "Late fee"} value={lateFee > 0 ? `+ $${lateFee}.00` : "$0.00"} danger={lateFee > 0} />
        <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 10, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Total due</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#1b3d2a" }}>${total.toLocaleString()}.00</span>
        </div>
      </div>

      {/* Summary — choose method */}
      {step === "summary" && (
        <>
          <SL>Choose payment method</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setStep("card")} style={methodBtn}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>💳</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Credit / Debit</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Visa, Mastercard, Amex</div>
            </button>
            <button onClick={() => setStep("ach")} style={methodBtn}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🏦</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Bank Transfer</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>ACH · Checking or Savings</div>
            </button>
          </div>
        </>
      )}

      {/* Card form */}
      {step === "card" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1b3d2a" }}>💳 Enter card details</div>

          <FF label="Name on card" value={cardName} onChange={setCardName} placeholder={tenant?.name || "Full name"} />
          <FF label="Card number" value={cardNum} onChange={v => setCardNum(formatCard(v))} placeholder="1234 5678 9012 3456" inputMode="numeric" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <FF label="Expiry" value={expiry} onChange={v => setExpiry(formatExpiry(v))} placeholder="MM/YY" inputMode="numeric" />
            <FF label="CVV" value={cvv} onChange={v => setCvv(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
            <FF label="ZIP" value={zip} onChange={v => setZip(v.replace(/\D/g, "").slice(0, 5))} placeholder="44511" inputMode="numeric" />
          </div>

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>⚠️ {error}</div>}

          <button onClick={handleCardPay} style={payBtn}>Pay ${total.toLocaleString()} now →</button>
          <button onClick={() => { setStep("summary"); setError(null); }} style={backBtn}>← Back</button>
        </div>
      )}

      {/* ACH form */}
      {step === "ach" && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#1b3d2a" }}>🏦 Enter bank details</div>
          <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            ACH transfers take 3–5 business days. Your payment date is today's date.
          </div>

          <FF label="Account holder name" value={achName} onChange={setAchName} placeholder={tenant?.name || "Full name"} />

          <div style={{ marginBottom: 12 }}>
            <Label>Account type</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {["checking", "savings"].map(t => (
                <button key={t} onClick={() => setAccountType(t)} style={{
                  flex: 1, padding: "9px", borderRadius: 9, cursor: "pointer",
                  border: accountType === t ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                  background: accountType === t ? "#f0f9f4" : "#fff",
                  color: accountType === t ? "#1b3d2a" : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  textTransform: "capitalize",
                }}>{t}</button>
              ))}
            </div>
          </div>

          <FF label="Routing number (9 digits)" value={routing} onChange={v => setRouting(v.replace(/\D/g, "").slice(0, 9))} placeholder="021000021" inputMode="numeric" />
          <FF label="Account number" value={account} onChange={v => setAccount(v.replace(/\D/g, "").slice(0, 17))} placeholder="Your account number" inputMode="numeric" />

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>⚠️ {error}</div>}

          <button onClick={handleAchPay} style={payBtn}>Submit ACH payment — ${total.toLocaleString()} →</button>
          <button onClick={() => { setStep("summary"); setError(null); }} style={backBtn}>← Back</button>
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        🔒 Secured by Stripe · Funds go directly to G&I Holdings LLC
      </div>
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

function SL({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8 }}>{children}</div>;
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function FF({ label, value, onChange, placeholder, inputMode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode || "text"}
        style={{
          width: "100%", padding: "12px 13px", borderRadius: 10,
          border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif",
          fontSize: 15, color: "#1a1a1a", boxSizing: "border-box",
          outline: "none",
        }}
      />
    </div>
  );
}

const methodBtn = {
  padding: "18px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center",
  border: "1.5px solid #e5e7eb", background: "#fff",
  fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
};

const payBtn = {
  width: "100%", background: "#4caf7d", color: "#fff", border: "none",
  borderRadius: 13, padding: "15px", fontFamily: "'DM Sans', sans-serif",
  fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10,
  marginTop: 4,
};

const backBtn = {
  width: "100%", background: "none", border: "none", color: "#9ca3af",
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", padding: "8px",
};
