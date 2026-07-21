import { useState } from "react";
import { supabase } from "../supabase";

const PORTAL_URL = "https://giholdingsllc.com";

export default function SendInvoiceModal({ tenants, onClose, onSent }) {
  const [tenantId, setTenantId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);

  const handleSend = async () => {
    if (!tenantId || !title.trim() || !amount) return;
    setSaving(true);
    setInvoiceError(null);

    const now = new Date().toISOString();
    const numAmount = Number(amount);
    const today = new Date();

    // Insert into custom_invoices ONLY — never into invoices table
    const { error: customError } = await supabase.from("custom_invoices").insert({
      tenant_id: tenantId,
      title: title.trim(),
      amount: numAmount,
      notes: notes.trim() || null,
      paid: false,
      due_date: now,
      created_at: now,
    });

    if (customError) {
      setSaving(false);
      setInvoiceError("Failed to send invoice: " + customError.message);
      return;
    }

    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      const firstName = tenant.name.split(" ")[0];
      const subject = `📋 New charge: ${title.trim()} — $${numAmount.toLocaleString()}`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:linear-gradient(160deg,#1b3d2a,#2d5c42);padding:28px 24px;border-radius:12px 12px 0 0;">
            <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">Tenant Portal</div>
          </div>
          <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.6;">
              A new charge has been added to your account at <strong>${tenant.address}</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:20px 0;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Charge Details</div>
              <div style="font-size:22px;font-weight:800;color:#1a1a1a;margin-bottom:12px;">$${numAmount.toLocaleString()}</div>
              <div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Title:</strong> ${title.trim()}</div>
              <div style="font-size:14px;color:#374151;margin-bottom:4px;"><strong>Due:</strong> ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
              ${notes.trim() ? `<div style="font-size:14px;color:#6b7280;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;"><strong>Note:</strong> ${notes.trim()}</div>` : ""}
            </div>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;">
              ℹ️ This charge does <strong>not</strong> accrue late fees. Please pay at your earliest convenience.
            </div>
            <a href="${PORTAL_URL}" style="display:block;background:#4caf7d;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px;">
              Log in to pay now → giholdingsllc.com
            </a>
          </div>
        </div>
      `;

      const smsMessage = `G&I Holdings: Hi ${firstName}, a new charge of $${numAmount.toLocaleString()} has been added to your account for "${title.trim()}".${notes.trim() ? ` Note: ${notes.trim()}.` : ""} Log in to pay: ${PORTAL_URL}`;

      try {
        await supabase.functions.invoke("send-custom-invoice-email", {
          body: {
            to: tenant.email,
            subject,
            html,
            smsTo: tenant.phone,
            smsMessage,
          },
        });
      } catch (emailErr) {
        console.error("Email/SMS send failed:", emailErr);
      }
    }

    setSaving(false);
    setSent(true);
    if (onSent) onSent();
  };

  const tenant = tenants.find(t => t.id === tenantId);

  if (sent) return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{invoiceError ? "⚠️" : "✅"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Invoice sent!</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            <strong>{tenant?.name}</strong> will see "{title}" in their portal and received an email and text notification.
          </div>
          {invoiceError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#dc2626", marginBottom: 16, textAlign: "left" }}>
              {invoiceError}
            </div>
          )}
          <button onClick={onClose} style={greenBtn}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Send Invoice</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Send to tenant</Label>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={inputSt}>
            <option value="">— Select tenant —</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} · {t.address}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Invoice title</Label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Lawn care, Broken window repair, Parking fee"
            style={inputSt} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <Label>Amount ($)</Label>
          <input value={amount} onChange={e => setAmount(e.target.value)}
            type="number" placeholder="e.g. 150"
            style={inputSt} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Label>Notes (optional)</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional details for the tenant..."
            rows={2}
            style={{ ...inputSt, resize: "none", lineHeight: 1.5 }} />
        </div>

        {invoiceError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
            ⚠️ {invoiceError}
          </div>
        )}

        {tenantId && title && amount && (
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
            📤 <strong>{tenant?.name}</strong> will be charged <strong>${Number(amount).toLocaleString()}</strong> for "<strong>{title}</strong>" and receive an email and text notification immediately.
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={saving || !tenantId || !title.trim() || !amount}
          style={{ ...greenBtn, opacity: (!tenantId || !title.trim() || !amount) ? 0.5 : 1, width: "100%" }}>
          {saving ? "Sending..." : "Send invoice →"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const overlay = { position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const modal = { background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 };
const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const inputSt = { width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" };
