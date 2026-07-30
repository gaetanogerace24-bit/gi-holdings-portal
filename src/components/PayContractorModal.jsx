import { useState } from "react";
import { supabase } from "../supabase";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function PayContractorModal({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [completionDate, setCompletionDate] = useState("");
  const [description, setDescription] = useState("");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeStartDay, setLateFeeStartDay] = useState("");
  const [initialLateFee, setInitialLateFee] = useState("");
  const [dailyLateFee, setDailyLateFee] = useState("");
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

      if (email.trim()) {
        const firstName = name.trim().split(" ")[0];
        const subject = `📋 Invoice from G&I Holdings LLC — $${Number(amount).toLocaleString()}`;
        const lateFeeHtml = lateFeeEnabled && lateFeeStartDay ? `
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#92400e;">
            ⚠️ <strong>Late fees apply:</strong> A $${Number(initialLateFee || 0).toLocaleString()} fee is added on day ${lateFeeStartDay} of the month${dailyLateFee ? `, plus $${Number(dailyLateFee).toLocaleString()}/day after that` : ""}.
          </div>` : "";
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
                <div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Invoice date:</strong> ${invoiceDate}</div>
                ${completionDate ? `<div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Job completed:</strong> ${completionDate}</div>` : ""}
                <div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Due:</strong> Upon receipt</div>
                <div style="font-size:14px;color:#374151;"><strong>Billed by:</strong> G&I Holdings LLC</div>
              </div>
              ${lateFeeHtml}
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
        date: invoiceDate,
        completion_date: completionDate || null,
        late_fee_enabled: lateFeeEnabled,
        late_fee_start_day: lateFeeEnabled ? Number(lateFeeStartDay) || null : null,
        initial_late_fee: lateFeeEnabled ? Number(initialLateFee) || null : null,
        daily_late_fee: lateFeeEnabled ? Number(dailyLateFee) || null : null,
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
      <div style={{ ...modal, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>📋 Send Invoice to Client</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
          Client or contractor gets an email + SMS with a Stripe payment link.
        </div>

        {/* Client name */}
        <div style={{ marginBottom: 14 }}>
          <Label>Client / company name *</Label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ABC Property Management" style={inputSt} />
        </div>

        {/* Email + Phone */}
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

        {/* Amount + Invoice date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Amount ($) *</Label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" type="number" style={inputSt} />
          </div>
          <div>
            <Label>Invoice date</Label>
            <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} type="date" style={inputSt} />
          </div>
        </div>

        {/* Job completion date */}
        <div style={{ marginBottom: 14 }}>
          <Label>Job completion date</Label>
          <input value={completionDate} onChange={e => setCompletionDate(e.target.value)} type="date" style={inputSt} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <Label>Description / services rendered *</Label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Property management services — July 2026" style={inputSt} />
        </div>

        {/* Late fee toggle */}
        <div style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>Late fee rules</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Charge fees if not paid on time</div>
            </div>
            <div onClick={() => setLateFeeEnabled(v => !v)}
              style={{ width: 42, height: 24, borderRadius: 12, background: lateFeeEnabled ? "#1b3d2a" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: lateFeeEnabled ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>
          {lateFeeEnabled && (
            <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <Label>Start day</Label>
                <input value={lateFeeStartDay} onChange={e => setLateFeeStartDay(e.target.value)} type="number" placeholder="e.g. 5" style={inputSt} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Day of month</div>
              </div>
              <div>
                <Label>Initial fee ($)</Label>
                <input value={initialLateFee} onChange={e => setInitialLateFee(e.target.value)} type="number" placeholder="e.g. 50" style={inputSt} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>One-time</div>
              </div>
              <div>
                <Label>Daily fee ($)</Label>
                <input value={dailyLateFee} onChange={e => setDailyLateFee(e.target.value)} type="number" placeholder="e.g. 10" style={inputSt} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Per day after</div>
              </div>
            </div>
          )}
        </div>

        {/* Preview banner */}
        {amount && description && (
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
            📋 <strong>{name || "Client"}</strong> will receive an invoice for <strong>${Number(amount || 0).toLocaleString()}</strong> due immediately via email + SMS.
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
