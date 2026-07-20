import { useState } from "react";
import { supabase } from "../supabase";

const TEST_MODE = false;
const TEST_EMAIL = "giholdingsllc8@gmail.com";
const TEST_PHONE = "+13304804819";

const TELNYX_API_KEY = import.meta.env.VITE_TELNYX_API_KEY;
const TELNYX_PHONE_NUMBER = import.meta.env.VITE_TELNYX_PHONE_NUMBER || "+13309181957";

async function sendSMS(to, message) {
  try {
    await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
      body: JSON.stringify({ from: TELNYX_PHONE_NUMBER, to, text: message }),
    });
  } catch (err) { console.error("SMS failed:", err); }
}

export default function PayContractorModal({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!name.trim() || !amount || !description.trim()) return;
    setSaving(true);
    setError(null);

    try {
      // Create Stripe payment link via edge function
      const { data, error: fnErr } = await supabase.functions.invoke("pay-contractor", {
        body: {
          amount: Number(amount),
          description: description.trim(),
          name: name.trim(),
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Could not create payment link");
      if (data?.error) throw new Error(data.error);

      const link = data.url;
      setPaymentLink(link);

      // Save to contractor_payments table
      await supabase.from("contractor_payments").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        amount: Number(amount),
        description: description.trim(),
        date: date || new Date().toISOString().split("T")[0],
        method: "stripe",
        status: "pending",
        stripe_payment_link: link,
        created_at: new Date().toISOString(),
      });

      const firstName = name.trim().split(" ")[0];
      const toEmail = TEST_MODE ? TEST_EMAIL : email;
      const toPhone = TEST_MODE ? TEST_PHONE : phone;

      // Send email
      if (toEmail) {
        const subject = `💸 Payment from G&I Holdings — $${Number(amount).toLocaleString()}`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
            <div style="background:linear-gradient(160deg,#1b3d2a,#2d5c42);padding:28px 24px;border-radius:12px 12px 0 0;">
              <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
            </div>
            <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
              <p style="font-size:14px;color:#4b5563;line-height:1.6;">
                G&I Holdings LLC is sending you a payment of <strong>$${Number(amount).toLocaleString()}</strong> for:
              </p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:20px 0;">
                <div style="font-size:22px;font-weight:800;color:#1a1a1a;margin-bottom:8px;">$${Number(amount).toLocaleString()}</div>
                <div style="font-size:14px;color:#374151;"><strong>For:</strong> ${description.trim()}</div>
                ${date ? `<div style="font-size:14px;color:#374151;margin-top:4px;"><strong>Date:</strong> ${date}</div>` : ""}
              </div>
              <p style="font-size:14px;color:#4b5563;">Click below to enter your bank or card details and collect your payment. It takes about 2 minutes and the money arrives quickly.</p>
              <a href="${link}" style="display:block;background:#1b3d2a;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px;">
                Collect $${Number(amount).toLocaleString()} →
              </a>
              <p style="font-size:12px;color:#9ca3af;">This payment link is secure and powered by Stripe.</p>
            </div>
          </div>
        `;

        await supabase.functions.invoke("send-custom-invoice-email", {
          body: { to: toEmail, subject, html },
        });
      }

      // Send SMS
      if (toPhone) {
        await sendSMS(toPhone, `G&I Holdings: Hi ${firstName}, you have a payment of $${Number(amount).toLocaleString()} for "${description.trim()}". Click to collect it: ${link}`);
      }

      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }

    setSaving(false);
  };

  const handleManual = async () => {
    if (!name.trim() || !amount || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await supabase.from("contractor_payments").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        amount: Number(amount),
        description: description.trim(),
        date: date || new Date().toISOString().split("T")[0],
        method: "manual",
        status: "paid",
        created_at: new Date().toISOString(),
      });
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not record payment.");
    }
    setSaving(false);
  };

  if (done) return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {paymentLink ? "Payment link sent!" : "Payment recorded!"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            {paymentLink
              ? `${name} received an email + SMS with a secure link to collect $${Number(amount).toLocaleString()}.`
              : `$${Number(amount).toLocaleString()} payment to ${name} logged as paid.`}
          </div>
          {paymentLink && (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 16, wordBreak: "break-all" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Payment link</div>
              <a href={paymentLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>{paymentLink}</a>
            </div>
          )}
          <button onClick={onClose} style={greenBtn}>Done</button>
        </div>
      </div>
    </div>
  );

  const canSubmit = name.trim() && amount && description.trim();

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>💸 Pay contractor</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
          Contractor gets a secure Stripe link via email + SMS. They enter their bank or card details (2 min) and get paid.
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Contractor name *</Label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mike's Lawn Care" style={inputSt} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Email</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="contractor@email.com" type="email" style={inputSt} />
          </div>
          <div>
            <Label>Phone</Label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (330) 555-0000" style={inputSt} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Amount ($) *</Label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 150" type="number" style={inputSt} />
          </div>
          <div>
            <Label>Date</Label>
            <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inputSt} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>What's this for? *</Label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Lawn care — 510 W Evergreen St" style={inputSt} />
        </div>

        {amount && description && (
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
            💸 Stripe will create a payment link for <strong>${Number(amount || 0).toLocaleString()}</strong> and send it to {name || "the contractor"} via email + SMS.
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={handleSend} disabled={saving || !canSubmit}
            style={{ ...greenBtn, opacity: canSubmit ? 1 : 0.5 }}>
            {saving ? "Creating link..." : "💸 Send payment link"}
          </button>
          <button onClick={handleManual} disabled={saving || !canSubmit}
            style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: canSubmit ? 1 : 0.5 }}>
            📝 Mark paid manually
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const overlay = { position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const modal = { background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 };
const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const inputSt = { width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" };
