import { useState } from "react";
import { supabase } from "../supabase";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe("pk_live_51TRuS9EDXH0jLhRl3r3VOAZTHWcRblzWGIy6xnorvIJheDJe5aAxCs172jinrbAQ5jJ7aLPoMxOabJ50MNLpjEmd009fTYe9Gg");

function PaymentForm({ listing, onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  const fee = Number(listing?.application_fee || 30);
  const chargeAmount = ((fee + 0.30) / (1 - 0.029)).toFixed(2);

  async function handlePay() {
    if (!name || !email || !phone) { setError("Please fill in all fields"); return; }
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-application-payment", {
        body: { listingId: listing?.id, amount: Math.round(fee * 100), name, email, phone, listingAddress: listing?.address || "Unknown property" }
      });
      if (fnError || !data?.clientSecret) throw new Error(fnError?.message || "Failed to create payment");

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: elements.getElement(CardElement), billing_details: { name, email, phone } }
      });

      if (result.error) { setError(result.error.message); setPaying(false); return; }
      // Payment succeeded — now notify owner via direct fetch
      // Normalize phone to E.164
      const rawPhone = (phone || "").replace(/\D/g, "");
      const normalizedPhone = rawPhone.length === 10 ? `+1${rawPhone}` : rawPhone.length === 11 && rawPhone.startsWith("1") ? `+${rawPhone}` : phone;
      fetch("https://hcakrtkqjxtyfmakaxkq.supabase.co/functions/v1/notify-application-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWtydGtxanh0eWZtYWtheGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMjMzODUsImV4cCI6MjA1Nzg5OTM4NX0.p-bkCwQBMxP8EMKSwlHtaHuXFMiMiqlZIFYFflbEPhE", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWtydGtxanh0eWZtYWtheGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMjMzODUsImV4cCI6MjA1Nzg5OTM4NX0.p-bkCwQBMxP8EMKSwlHtaHuXFMiMiqlZIFYFflbEPhE" },
        body: JSON.stringify({ name, email, phone: normalizedPhone, address: listing?.address || "Unknown property" })
      }).catch(e => console.error("notify failed:", e));
      onSuccess({ name, email, phone });
    } catch (e) {
      setError(e.message);
      setPaying(false);
    }
  }

  const inp = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ background: "#1b3d2a", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Application Fee</div>
          {listing && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{listing.address}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Application fee for</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{listing?.address}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{listing?.city}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#1b3d2a" }}>${chargeAmount}<span style={{ fontSize: 16, fontWeight: 400, color: "#6b7280" }}> one-time</span></div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Includes ${fee} application fee + card processing fee</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Full name *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email address *</label>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@email.com" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Phone number *</label>
            <input style={inp} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(330) 555-0000" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Card details *</label>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "13px 14px", background: "#fff" }}>
              <CardElement options={{ style: { base: { fontSize: "15px", color: "#1a1a1a", "::placeholder": { color: "#9ca3af" } } } }} />
            </div>
          </div>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginTop: 16 }}>{error}</div>}

        <button onClick={handlePay} disabled={paying || !stripe} style={{ width: "100%", background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: paying ? "not-allowed" : "pointer", marginTop: 24, opacity: paying ? 0.7 : 1 }}>
          {paying ? "Processing..." : `Pay $${chargeAmount} & Continue`}
        </button>
        <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>Secure payment powered by Stripe. Non-refundable application fee.</p>
      </div>
    </div>
  );
}

export default function ApplicationPayment({ listing, onSuccess, onBack }) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm listing={listing} onSuccess={onSuccess} onBack={onBack} />
    </Elements>
  );
}
