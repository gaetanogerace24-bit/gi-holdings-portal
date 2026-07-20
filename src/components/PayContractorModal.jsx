import { useState } from "react";
import { supabase } from "../supabase";

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
      const { data, error: fnErr } = await supabase.functions.invoke("pay-contractor", {
        body: {
          amount: Number(amount),
          description: description.trim(),
          name: name.trim(),
          phone: phone.trim() || null,
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Could not create invoice");
      if (data?.error) throw new Error(data.error);

      const link = data.url;
      setPaymentLink(link);

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

      if (email.trim()) {
        const firstName = name.trim().split(" ")[0];
        const subject = `📋 Invoice from G&I Holdings LLC — $${Number(amount).toLocaleString()}`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
            <div style="background:linear-gradient(160deg,#1b3d2a,#2d5c42);padding:28px 24px;border-radius:12px 12px 0 0;">
              <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">Invoice</div>
            </div>
            <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
              <p style="font-size:14px;color:#4b5563;line-height:1.6;">
                G&I Holdings LLC has sent you an invoice for services rendered. Please review the details below and submit your payment at your earliest convenience.
              </p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:20px 0;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Invoice Details</div>
                <div style="font-size:28px;font-weight:800;color:#1a1a1a;margin-bottom:12px;">$${Number(amount).toLocaleString()}</div>
                <div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Description:</strong> ${description.trim()}</div>
                ${date ? `<div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Date:</strong> ${date}</div>` : ""}
                <div style="font-size:14px;color:#374151;"><strong>Billed by:</strong> G&I Holdings LLC</div>
              </div>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:13px;color:#991b1b;">
                ⚠️ Payment is due upon receipt. Please pay promptly to avoid any delays.
              </div>
              <a href="${link}" style="display:block;background:#1b3d2a;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px;">
                Pay Invoice — $${Number(amount).toLocaleString()} →
              </a>
              <p style="font-size:12px;color:#9ca3af;text-align:center;">Secured by Stripe · G&I Holdings LLC</p>
            </div>
          </div>
        `;
        await supabase.functions.invoke("send-custom-invoice-email", {
          body: { to: email.trim(), subject, html },
        });
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
            {paymentLink ? "Invoice sent!" : "Payment recorded!"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            {paymentLink
              ? `${name} received an email + SMS with a Stripe payment link for $${Number(amount).toLocaleString()}.`
              : `$${Number(amount).toLocaleString()} payment from ${name} logged manually.`}
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
          <div style={{ fontSize: 17, fontWeight: 700 }}>📋 Send Invoice to Client</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
          Send a payment invoice to a client or contractor. They get an email + SMS with a Stripe link to pay you directly.
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Client / company name *</Label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Property Management" style={inputSt} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Email</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="client@email.com" type="email" style={inputSt} />
          </div>
          <div>
            <Label>Phone</Label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (330) 555-0000" style={inputSt} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Amount ($) *</Label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" type="number" style={inputSt} />
          </div>
          <div>
            <Label>Invoice date</Label>
            <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inputSt} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>Description / services rendered *</Label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Property management services — July 2026" style={inputSt} />
        </div>

        {amount && description && (
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
            📋 <strong>{name || "Client"}</strong> will receive an invoice for <strong>${Number(amount || 0).toLocaleString()}</strong> via email + SMS with a Stripe payment link.
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
            {saving ? "Sending..." : "📋 Send invoice"}
          </button>
          <button onClick={handleManual} disabled={saving || !canSubmit}
            style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: canSubmit ? 1 : 0.5 }}>
            📝 Mark as paid
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
