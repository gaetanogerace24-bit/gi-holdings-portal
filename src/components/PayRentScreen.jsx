import { useState } from "react";

export default function PayRentScreen({ tenant }) {
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const total = tenant.rent + tenant.lateFee;

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setPaid(true); }, 1800);
  };

  if (paid) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{
          background: "#fff", borderRadius: 20, padding: "40px 24px",
          border: "1px solid rgba(0,0,0,0.07)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1b3d2a", marginBottom: 6 }}>Payment sent!</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
            ${total.toLocaleString()} received · Deposits in 1–2 business days
          </div>
          <div style={{
            background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 16px",
            fontSize: 13, color: "#166534", textAlign: "left",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Payment confirmation</div>
            <div>Amount: ${total.toLocaleString()}</div>
            <div>Unit: {tenant.unit}</div>
            <div>Date: Apr 29, 2026</div>
            <div>Ref: TXN-{Math.floor(Math.random()*900000+100000)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>May 2026 payment</SectionLabel>

      <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid rgba(0,0,0,0.07)" }}>
        <Row label="Monthly rent" value={`$${tenant.rent.toLocaleString()}.00`} />
        {tenant.lateFee > 0 && <Row label="Late fee" value={`+ $${tenant.lateFee.toLocaleString()}.00`} danger />}
        <Row label="Credits" value="— $0.00" />
        <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 8, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Total due</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#1b3d2a" }}>${total.toLocaleString()}.00</span>
        </div>
      </div>

      <SectionLabel>Payment method</SectionLabel>
      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", marginBottom: 14, border: "1.5px solid #4caf7d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>💳</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Visa ending in 4242</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Expires 08/28</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#4caf7d", fontWeight: 600, background: "#f0f9f4", padding: "3px 8px", borderRadius: 6 }}>Default</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", marginBottom: 18, border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <div style={{ fontSize: 22 }}>🏦</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>+ Add bank account or card</div>
      </div>

      <button onClick={handlePay} disabled={loading} style={{
        width: "100%", background: loading ? "#9ca3af" : "#4caf7d",
        color: "#fff", border: "none", borderRadius: 13, padding: "15px",
        fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.2px",
        transition: "background 0.2s",
      }}>
        {loading ? "Processing..." : `Pay $${total.toLocaleString()} now`}
      </button>

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        🔒 Secured by Stripe · Funds go directly to G&I Holdings
      </div>
    </div>
  );
}

function Row({ label, value, danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: danger ? "#dc2626" : "#1a1a1a" }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8 }}>
      {children}
    </div>
  );
}
