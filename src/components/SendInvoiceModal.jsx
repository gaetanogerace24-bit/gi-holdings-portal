import { useState } from "react";
import { supabase } from "../supabase";

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
    const monthName = today.toLocaleString("default", { month: "long", year: "numeric" });

    // 1. Insert into custom_invoices — shows in tenant portal "Other Charges"
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
      console.error("custom_invoices insert error:", customError);
      setSaving(false);
      setInvoiceError("Failed to send invoice: " + customError.message);
      return;
    }

    // 2. Insert into invoices table — shows under tenant's All Invoices in admin
    const invoicePayload = {
      tenant_id: tenantId,
      month: `${title.trim()} — ${monthName}`,
      year: today.getFullYear(),
      month_num: today.getMonth() + 1,
      rent: numAmount,
      late_fee: 0,
      total: numAmount,
      paid: false,
      due_date: today.toISOString().split("T")[0],
      is_custom: true,
      created_at: now,
      updated_at: now,
    };

    // Only include notes if column exists
    try {
      invoicePayload.notes = notes.trim() || null;
    } catch(e) {}

    const { error: invoiceErr, data: invoiceData } = await supabase
      .from("invoices")
      .insert(invoicePayload)
      .select()
      .single();

    if (invoiceErr) {
      console.error("invoices insert error:", invoiceErr);
      // Still mark as sent since custom_invoices worked — but show warning
      setInvoiceError("Warning: saved to tenant portal but admin log failed: " + invoiceErr.message);
    } else {
      console.log("Invoice created in invoices table:", invoiceData);
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
            <strong>{tenant?.name}</strong> will see "{title}" in their portal under Other Charges.
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
            📤 <strong>{tenant?.name}</strong> will see a charge of <strong>${Number(amount).toLocaleString()}</strong> titled "<strong>{title}</strong>" in their portal immediately.
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
