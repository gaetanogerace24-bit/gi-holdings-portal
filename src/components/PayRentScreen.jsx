import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Load Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Late fee logic — $35 on day 5, $10/day after
function calcLateFee(paid) {
  if (paid) return 0;
  const day = new Date().getDate();
  if (day < 5) return 0;
  return 35 + Math.max(0, day - 5) * 10;
}

function getDaysUntilFive() {
  return Math.max(0, 5 - new Date().getDate());
}

// ─── Inner checkout form (uses Stripe hooks) ─────────────────
function CheckoutForm({ tenant, total, method, onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nameOnCard, setNameOnCard] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create payment intent on our server
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          tenantId: tenant.id,
          tenantName: tenant.name,
          address: tenant.address,
          paymentType: method,
        }),
      });

      const { clientSecret, error: serverError } = await res.json();

      if (serverError) {
        setError(serverError);
        setLoading(false);
        return;
      }

      // Step 2: Confirm payment with Stripe
      let result;
      if (method === "card") {
        result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { name: nameOnCard || tenant.name },
          },
        });
      } else {
        result = await stripe.confirmUsBankAccountPayment(clientSecret, {
          payment_method: {
            us_bank_account: elements.getElement(PaymentElement),
            billing_details: { name: nameOnCard || tenant.name },
          },
        });
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
      } else {
        onSuccess(result.paymentIntent.id);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 14 }}>
        <Label>Name on {method === "card" ? "card" : "account"}</Label>
        <input
          value={nameOnCard}
          onChange={e => setNameOnCard(e.target.value)}
          placeholder={tenant.name}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>{method === "card" ? "Card details" : "Bank account"}</Label>
        <div style={{ padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
          <CardElement options={{
            style: {
              base: { fontSize: "15px", color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif", "::placeholder": { color: "#9ca3af" } },
              invalid: { color: "#dc2626" },
            },
          }} />
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>
          ⚠️ {error}
        </div>
      )}

      <button type="submit" disabled={!stripe || loading} style={{
        width: "100%", background: loading ? "#9ca3af" : "#4caf7d",
        color: "#fff", border: "none", borderRadius: 13,
        padding: "16px", fontFamily: "'DM Sans', sans-serif",
        fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
        marginBottom: 10,
      }}>
        {loading ? "Processing..." : `Pay $${total.toLocaleString()} now →`}
      </button>

      <button type="button" onClick={onBack} style={{
        width: "100%", background: "none", border: "none", color: "#9ca3af",
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer", padding: "8px",
      }}>← Back</button>
    </form>
  );
}

// ─── Main PayRentScreen ───────────────────────────────────────
export default function PayRentScreen({ tenant, onPaymentSuccess }) {
  const [step, setStep] = useState("summary"); // summary | checkout | success
  const [method, setMethod] = useState("card");
  const [txnId, setTxnId] = useState(null);

  const lateFee = calcLateFee(tenant?.paid);
  const base = tenant?.section8 ? (tenant.tenantPortion || 0) : (tenant?.rent || 0);
  const extraOwed = (tenant?.amountOwed && tenant.amountOwed > tenant.rent) ? tenant.amountOwed - tenant.rent : 0;
  const total = base + lateFee + extraOwed;
  const day = new Date().getDate();
  const daysLeft = getDaysUntilFive();
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const handleSuccess = (paymentIntentId) => {
    setTxnId(paymentIntentId);
    setStep("success");
    if (onPaymentSuccess) onPaymentSuccess(tenant.id, total);
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

  // Success screen
  if (step === "success") {
    return (
      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 28px", textAlign: "center", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#166634", marginBottom: 6 }}>Payment received!</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
            ${total.toLocaleString()} sent to G&I Holdings LLC
          </div>
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", textAlign: "left", fontSize: 13, lineHeight: 2 }}>
            <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>Payment confirmation</div>
            <div>Amount: <strong>${total.toLocaleString()}</strong></div>
            <div>Property: {tenant.address}</div>
            <div>Month: {month}</div>
            <div>Method: {method === "card" ? "Credit / Debit Card" : "ACH Bank Transfer"}</div>
            {txnId && <div>Ref: {txnId.slice(0, 24)}...</div>}
            <div>Date: {new Date().toLocaleDateString()}</div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
            {method === "card" ? "Funds deposited in 1–2 business days" : "ACH takes 3–5 business days"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Grace period / late fee banner */}
      {day < 5 && daysLeft > 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#166534", display: "flex", gap: 8 }}>
          <span>✅</span>
          <span>No late fees yet — pay before the 5th to avoid $35. <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left.</strong></span>
        </div>
      ) : lateFee > 0 ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#991b1b", display: "flex", gap: 8 }}>
          <span>⚠️</span>
          <div>
            <strong>Late fee applied.</strong> $35 base + ${Math.max(0, lateFee - 35)} daily = <strong>${lateFee}</strong>
            <div style={{ marginTop: 2 }}>$10/day added every day until paid.</div>
          </div>
        </div>
      ) : null}

      {/* Summary */}
      <SectionLabel>Payment breakdown</SectionLabel>
      <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid rgba(0,0,0,0.07)" }}>
        <Row label={tenant?.section8 ? "Your portion (Section 8)" : "Monthly rent"} value={`$${base.toLocaleString()}.00`} />
        {extraOwed > 0 && <Row label="Prior balance owed" value={`+ $${extraOwed.toLocaleString()}.00`} danger />}
        <Row label={lateFee > 0 ? `Late fee (Day ${day - 4} late)` : "Late fee"} value={lateFee > 0 ? `+ $${lateFee}.00` : "$0.00"} danger={lateFee > 0} />
        <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 10, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Total due</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#1b3d2a" }}>${total.toLocaleString()}.00</span>
        </div>
      </div>

      {step === "summary" && (
        <>
          <SectionLabel>Choose payment method</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { key: "card", icon: "💳", label: "Credit / Debit", sub: "Visa, Mastercard, Amex" },
              { key: "ach", icon: "🏦", label: "Bank Transfer", sub: "ACH · 3–5 business days" },
            ].map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)} style={{
                padding: "14px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                border: method === m.key ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                background: method === m.key ? "#f0f9f4" : "#fff",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: method === m.key ? "#1b3d2a" : "#1a1a1a" }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{m.sub}</div>
              </button>
            ))}
          </div>

          <button onClick={() => setStep("checkout")} style={{
            width: "100%", background: "#4caf7d", color: "#fff", border: "none",
            borderRadius: 13, padding: "16px", fontFamily: "'DM Sans', sans-serif",
            fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10,
          }}>
            Continue to payment →
          </button>
        </>
      )}

      {step === "checkout" && (
        <Elements stripe={stripePromise}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1b3d2a" }}>
              {method === "card" ? "💳 Enter card details" : "🏦 Enter bank details"}
            </div>
            <CheckoutForm
              tenant={tenant}
              total={total}
              method={method}
              onSuccess={handleSuccess}
              onBack={() => setStep("summary")}
            />
          </div>
        </Elements>
      )}

      <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 8 }}>
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

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8 }}>{children}</div>;
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const inputStyle = {
  width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e5e7eb",
  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
  boxSizing: "border-box", marginBottom: 14, display: "block",
};
