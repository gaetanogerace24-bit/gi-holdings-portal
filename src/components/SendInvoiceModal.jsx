import { useState } from "react";
import { supabase } from "../supabase";

const PORTAL_URL = "https://giholdingsllc.com";

export default function SendInvoiceModal({ tenants, onClose, onSent }) {
  const [tenantId, setTenantId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
  const [lateFeeStartDay, setLateFeeStartDay] = useState("5");
  const [initialLateFee, setInitialLateFee] = useState("35");
  const [dailyLateFee, setDailyLateFee] = useState("10");
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

    const { error: customError } = await supabase.from("custom_invoices").insert({
      tenant_id: tenantId,
      title: title.trim(),
      amount: numAmount,
      notes: notes.trim() || null,
      paid: false,
      due_date: now,
      created_at: now,
      late_fee_enabled: lateFeeEnabled,
      late_fee_start_day: lateFeeEnabled ? Number(lateFeeStartDay) || 5 : null,
      initial_late_fee: lateFeeEnabled ? Number(initialLateFee) || 35 : null,
      daily_late_fee: lateFeeEnabled ? Number(dailyLateFee) || 10 : null,
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

      const lateFeeNote = lateFeeEnabled
        ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#92400e;">
            ⚠️ Late fees apply if not paid by the ${Number(lateFeeStartDay)}${Number(lateFeeStartDay) === 1 ? "st" : Number(lateFeeStartDay) === 2 ? "nd" : Number(lateFeeStartDay) === 3 ? "rd" : "th"} of the month. Initial fee: $${initialLateFee}, then $${dailyLateFee}/day.
           </div>`
        : `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;">
            ℹ️ This charge does <strong>not</strong> accrue late fees. Please pay at your earliest convenience.
           </div>`;

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
            ${lateFeeNote}
            <a href="${PORTAL_URL}" style="display:block;background:#4caf7d;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px;">
              Log in to pay now → giholdingsllc.com
            </a>
          </div>
        </div>
      `;

      const smsMessage = `G&I Holdings: Hi ${firstName}, a new charge of $${numAmount.toLocaleString()} has been added for "${title.trim()}".${lateFeeEnabled ? ` Late fees of $${dailyLateFee}/day apply after the ${lateFeeStartDay}th.` : ""} Log in to your tenant portal to pay.`;

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
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Invoice sent!</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            <strong>{tenant?.name}</strong> received an email and text notification.
          </div>
          <button onClick={onClose} style={greenBtn}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxHeight: "90vh", overflowY: "auto" }}>
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

        <div style={{ marginBottom: 14 }}>
          <Label>Notes (optional)</Label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional details for the tenant..."
            rows={2}
            style={{ ...inputSt, resize: "none", lineHeight: 1.5 }} />
        </div>

        {/* Late fee rules */}
        <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>⚙️ Late fee rules</div>
            <div onClick={() => setLateFeeEnabled(!lateFeeEnabled)} style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer",
              background: lateFeeEnabled ? "#d97706" : "#d1d5db",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3,
                left: lateFeeEnabled ? 21 : 3,
                transition: "left 0.2s",
              }} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: lateFeeEnabled ? 12 : 0 }}>
            Add late fees if not paid on time
          </div>
          {lateFeeEnabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Start day</div>
                <input type="number" value={lateFeeStartDay} onChange={e => setLateFeeStartDay(e.target.value)}
                  placeholder="5" style={{ ...inputSt, borderColor: "#fcd34d" }} />
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Day of month</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Initial fee ($)</div>
                <input type="number" value={initialLateFee} onChange={e => setInitialLateFee(e.target.value)}
                  placeholder="35" style={{ ...inputSt, borderColor: "#fcd34d" }} />
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>One-time</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Daily fee ($)</div>
                <input type="number" value={dailyLateFee} onChange={e => setDailyLateFee(e.target.value)}
                  placeholder="10" style={{ ...inputSt, borderColor: "#fcd34d" }} />
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Per day after</div>
              </div>
            </div>
          )}
        </div>

        {invoiceError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
            ⚠️ {invoiceError}
          </div>
        )}

        {tenantId && title && amount && (
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
            📤 <strong>{tenant?.name}</strong> will be charged <strong>${Number(amount).toLocaleString()}</strong> for "<strong>{title}</strong>"
            {lateFeeEnabled && ` with late fees of $${dailyLateFee}/day after day ${lateFeeStartDay}.`}
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
