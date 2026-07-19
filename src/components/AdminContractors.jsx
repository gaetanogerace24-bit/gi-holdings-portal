import { useState } from "react";
import { supabase } from "../supabase";

const TRADES = ["General contractor", "Plumber", "Electrician", "HVAC", "Roofer", "Painter", "Landscaper", "Cleaner", "Handyman", "Other"];

const EMPTY_CONTRACTOR = { name: "", company: "", trade: "General contractor", email: "", phone: "", notes: "" };

function fmt(n) {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" }} />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", background: "#fff" }}>
      {children}
    </select>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    "not_connected": { color: "#6b7280", bg: "#f3f4f6", label: "Not connected" },
    "pending":       { color: "#d97706", bg: "#fffbeb", label: "Stripe pending" },
    "connected":     { color: "#16a34a", bg: "#f0fdf4", label: "Stripe connected" },
  }[status] || { color: "#6b7280", bg: "#f3f4f6", label: "Not connected" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 20, padding: "3px 10px", display: "inline-block" }}>
      {cfg.label}
    </span>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "rgba(0,0,0,0.4)", position: "absolute", inset: 0 }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "92vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminContractors() {
  const [tab, setTab] = useState("contractors");
  const [contractors, setContractors] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_CONTRACTOR);
  const [saving, setSaving] = useState(false);

  // Send invoice state
  const [invoiceContractorId, setInvoiceContractorId] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [sendingSent, setSendingSent] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [sentInvoices, setSentInvoices] = useState([]);

  // Pay contractor state
  const [payContractorId, setPayContractorId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payRecords, setPayRecords] = useState([]);
  const [payingSaving, setPayingSaving] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_CONTRACTOR); setShowAddForm(true); };
  const openEdit = (c) => { setEditingId(c.id); setForm({ ...c }); setShowAddForm(true); };
  const closeForm = () => { setShowAddForm(false); setEditingId(null); setForm(EMPTY_CONTRACTOR); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { name: form.name, company: form.company || "", trade: form.trade, email: form.email || "", phone: form.phone || "", notes: form.notes || "", stripe_status: "not_connected", updated_at: new Date().toISOString() };
    if (editingId) {
      setContractors(contractors.map(c => c.id === editingId ? { ...c, ...data } : c));
    } else {
      const newC = { ...data, id: Date.now(), created_at: new Date().toISOString() };
      setContractors([...contractors, newC]);
    }
    setSaving(false);
    closeForm();
  };

  const handleRemove = (id, name) => {
    if (window.confirm(`Remove ${name}?`)) setContractors(contractors.filter(c => c.id !== id));
  };

  const handleSendInvoice = async () => {
    if (!invoiceContractorId || !invoiceTitle || !invoiceAmount) return;
    setInvoiceSaving(true);
    const contractor = contractors.find(c => c.id === Number(invoiceContractorId));
    const inv = {
      id: Date.now(),
      contractor_id: Number(invoiceContractorId),
      contractor_name: contractor?.name,
      title: invoiceTitle,
      amount: Number(invoiceAmount),
      due_date: invoiceDueDate || new Date().toISOString().split("T")[0],
      notes: invoiceNotes,
      paid: false,
      created_at: new Date().toISOString(),
    };
    setSentInvoices([inv, ...sentInvoices]);
    setInvoiceContractorId(""); setInvoiceTitle(""); setInvoiceAmount(""); setInvoiceDueDate(""); setInvoiceNotes("");
    setInvoiceSaving(false);
    setSendingSent(true);
    setTimeout(() => setSendingSent(false), 3000);
  };

  const handlePayContractor = async () => {
    if (!payContractorId || !payAmount || !payDescription) return;
    setPayingSaving(true);
    const contractor = contractors.find(c => c.id === Number(payContractorId));
    const record = {
      id: Date.now(),
      contractor_id: Number(payContractorId),
      contractor_name: contractor?.name,
      amount: Number(payAmount),
      description: payDescription,
      date: payDate || new Date().toISOString().split("T")[0],
      status: contractor?.stripe_status === "connected" ? "processing" : "manual",
      created_at: new Date().toISOString(),
    };
    setPayRecords([record, ...payRecords]);
    setPayContractorId(""); setPayAmount(""); setPayDescription(""); setPayDate("");
    setPayingSaving(false);
    setPaidSuccess(true);
    setTimeout(() => setPaidSuccess(false), 3000);
  };

  const totalOwedToContractors = payRecords.filter(r => r.status !== "completed").reduce((s, r) => s + r.amount, 0);
  const totalReceivedFromContractors = sentInvoices.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  const totalSentUnpaid = sentInvoices.filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif", maxWidth: 680 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Contractors</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{contractors.length} contractor{contractors.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>💸 Owed to contractors</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626" }}>{fmt(totalOwedToContractors)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{payRecords.filter(r => r.status !== "completed").length} pending payments</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>📤 Invoices sent</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>{fmt(totalSentUnpaid)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sentInvoices.filter(i => !i.paid).length} unpaid invoices</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>✓ Received</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{fmt(totalReceivedFromContractors)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sentInvoices.filter(i => i.paid).length} paid invoices</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {[
          { key: "contractors", label: "🔧 Contractors" },
          { key: "send", label: "📤 Send Invoice" },
          { key: "pay", label: "💸 Pay Contractor" },
          { key: "history", label: "📋 History" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === t.key ? "#fff" : "transparent",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
            color: tab === t.key ? "#1f2937" : "#6b7280",
            boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* CONTRACTORS TAB */}
      {tab === "contractors" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={openAdd} style={greenBtn}>+ Add contractor</button>
          </div>

          {showAddForm && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "2px solid #4caf7d", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a", marginBottom: 18 }}>{editingId ? "Edit contractor" : "Add contractor"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div><Label>Full name *</Label><Input value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Mike Johnson" /></div>
                <div><Label>Company</Label><Input value={form.company} onChange={v => setForm({ ...form, company: v })} placeholder="e.g. Johnson Plumbing LLC" /></div>
                <div>
                  <Label>Trade</Label>
                  <Select value={form.trade} onChange={v => setForm({ ...form, trade: v })}>
                    {TRADES.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div><Label>Email</Label><Input value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="contractor@email.com" type="email" /></div>
                <div><Label>Phone (add +1)</Label><Input value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+1 (330) 555-0000" /></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Label>Notes</Label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this contractor..."
                  rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleSave} disabled={saving || !form.name} style={{ ...greenBtn, opacity: form.name ? 1 : 0.5 }}>{saving ? "Saving..." : editingId ? "Save changes" : "Add contractor"}</button>
                <button onClick={closeForm} style={cancelBtn}>Cancel</button>
              </div>
            </div>
          )}

          {contractors.length === 0 && !showAddForm && (
            <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No contractors yet</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Add contractors to send them invoices or pay them via Stripe</div>
              <button onClick={openAdd} style={greenBtn}>+ Add your first contractor</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {contractors.map(c => (
              <div key={c.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                      {c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{c.name}</div>
                      {c.company && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{c.company}</div>}
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{c.trade}</div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                        {c.email && <div style={{ fontSize: 12, color: "#374151" }}>✉️ {c.email}</div>}
                        {c.phone && <div style={{ fontSize: 12, color: "#374151" }}>📱 {c.phone}</div>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <StatusBadge status={c.stripe_status || "not_connected"} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setTab("send"); setInvoiceContractorId(String(c.id)); }} style={{ ...outlineBtn, fontSize: 11 }}>📤 Invoice</button>
                      <button onClick={() => { setTab("pay"); setPayContractorId(String(c.id)); }} style={{ ...outlineBtn, fontSize: 11 }}>💸 Pay</button>
                      <button onClick={() => openEdit(c)} style={outlineBtn}>Edit</button>
                      <button onClick={() => handleRemove(c.id, c.name)} style={{ ...outlineBtn, borderColor: "#fee2e2", color: "#dc2626" }}>Remove</button>
                    </div>
                  </div>
                </div>
                {c.notes && <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>📝 {c.notes}</div>}
                {(c.stripe_status === "not_connected" || !c.stripe_status) && (
                  <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "#92400e" }}>⚠️ Not connected to Stripe — can't pay via bank transfer yet</div>
                    <button style={{ fontSize: 12, color: "#d97706", fontWeight: 700, background: "none", border: "1.5px solid #fcd34d", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Connect Stripe →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEND INVOICE TAB */}
      {tab === "send" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 18 }}>📤 Send invoice to contractor</div>
            <div style={{ fontSize: 13, color: "#6b7280", background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
              The contractor receives an email + SMS with a Stripe payment link. When they pay, the money goes directly into your G&I Holdings Stripe account.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Send to contractor</Label>
                <Select value={invoiceContractorId} onChange={setInvoiceContractorId}>
                  <option value="">— Select contractor —</option>
                  {contractors.map(c => <option key={c.id} value={String(c.id)}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
                </Select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Invoice title / description</Label>
                <Input value={invoiceTitle} onChange={setInvoiceTitle} placeholder="e.g. Roof repair — 450 Cleveland St" />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input value={invoiceAmount} onChange={setInvoiceAmount} placeholder="e.g. 1500" type="number" />
              </div>
              <div>
                <Label>Due date</Label>
                <Input value={invoiceDueDate} onChange={setInvoiceDueDate} type="date" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Notes (optional)</Label>
                <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="Any additional details..."
                  rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none" }} />
              </div>
            </div>

            {invoiceContractorId && invoiceTitle && invoiceAmount && (
              <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#1b3d2a" }}>
                📤 <strong>{contractors.find(c => c.id === Number(invoiceContractorId))?.name}</strong> will receive an email + SMS with a Stripe link to pay <strong>{fmt(Number(invoiceAmount))}</strong> for "<strong>{invoiceTitle}</strong>"
              </div>
            )}

            {sendingSent && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                ✅ Invoice sent! Contractor will receive email + SMS shortly.
              </div>
            )}

            <button onClick={handleSendInvoice} disabled={invoiceSaving || !invoiceContractorId || !invoiceTitle || !invoiceAmount}
              style={{ ...greenBtn, width: "100%", opacity: (!invoiceContractorId || !invoiceTitle || !invoiceAmount) ? 0.5 : 1 }}>
              {invoiceSaving ? "Sending..." : "Send invoice →"}
            </button>
          </div>

          {/* Sent invoices list */}
          {sentInvoices.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6", fontSize: 14, fontWeight: 700 }}>Sent invoices</div>
              {sentInvoices.map((inv, i) => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < sentInvoices.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{inv.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{inv.contractor_name} · Due {inv.due_date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(inv.amount)}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {inv.paid ? <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Paid</span> : <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Unpaid</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAY CONTRACTOR TAB */}
      {tab === "pay" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.07)", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>💸 Pay a contractor</div>
            <div style={{ fontSize: 13, color: "#6b7280", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
              ⚡ Stripe Connect required — contractors need to connect their bank account once before you can send money directly. Use "Connect Stripe →" on their card in the Contractors tab.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Pay contractor</Label>
                <Select value={payContractorId} onChange={setPayContractorId}>
                  <option value="">— Select contractor —</option>
                  {contractors.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}{c.company ? ` · ${c.company}` : ""} {c.stripe_status !== "connected" ? "(not connected)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Label>Description / job</Label>
                <Input value={payDescription} onChange={setPayDescription} placeholder="e.g. Plumbing repair — 510 W Evergreen" />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input value={payAmount} onChange={setPayAmount} placeholder="e.g. 850" type="number" />
              </div>
              <div>
                <Label>Payment date</Label>
                <Input value={payDate} onChange={setPayDate} type="date" />
              </div>
            </div>

            {payContractorId && payAmount && payDescription && (() => {
              const c = contractors.find(x => x.id === Number(payContractorId));
              return (
                <div style={{ background: c?.stripe_status === "connected" ? "#f0f9f4" : "#fffbeb", border: `1px solid ${c?.stripe_status === "connected" ? "#bbf7d0" : "#fcd34d"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: c?.stripe_status === "connected" ? "#1b3d2a" : "#92400e" }}>
                  {c?.stripe_status === "connected"
                    ? <>💸 Stripe will send <strong>{fmt(Number(payAmount))}</strong> to <strong>{c?.name}</strong>'s bank account. They'll receive it in 1–2 business days.</>
                    : <>⚠️ <strong>{c?.name}</strong> hasn't connected their Stripe account yet. You can still record this payment manually, but bank transfer won't be available until they connect.</>
                  }
                </div>
              );
            })()}

            {paidSuccess && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                ✅ Payment recorded! {contractors.find(c => c.id === Number(payContractorId))?.stripe_status === "connected" ? "Funds will arrive in 1–2 business days." : "Recorded as manual payment."}
              </div>
            )}

            <button onClick={handlePayContractor} disabled={payingSaving || !payContractorId || !payAmount || !payDescription}
              style={{ ...greenBtn, width: "100%", opacity: (!payContractorId || !payAmount || !payDescription) ? 0.5 : 1 }}>
              {payingSaving ? "Processing..." : "Send payment →"}
            </button>
          </div>

          {/* Payment records */}
          {payRecords.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #f3f4f6", fontSize: 14, fontWeight: 700 }}>Payment history</div>
              {payRecords.map((r, i) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < payRecords.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{r.description}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{r.contractor_name} · {r.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>{fmt(r.amount)}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {r.status === "completed" ? <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Completed</span>
                        : r.status === "processing" ? <span style={{ color: "#2563eb", fontWeight: 600 }}>⏳ Processing</span>
                        : <span style={{ color: "#6b7280" }}>📝 Manual</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>All transactions</div>
          {sentInvoices.length === 0 && payRecords.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: "48px 20px", textAlign: "center", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>No transactions yet</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Invoices you send and payments you make will appear here</div>
            </div>
          )}

          {sentInvoices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>Invoices sent to contractors</div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                {sentInvoices.map((inv, i) => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < sentInvoices.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{inv.title}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{inv.contractor_name} · {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#d97706" }}>+{fmt(inv.amount)}</div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>{inv.paid ? <span style={{ color: "#16a34a" }}>✓ Paid</span> : <span style={{ color: "#dc2626" }}>Unpaid</span>}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payRecords.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>Payments to contractors</div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                {payRecords.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < payRecords.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.description}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{r.contractor_name} · {r.date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>-{fmt(r.amount)}</div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>{r.status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed</span> : r.status === "processing" ? <span style={{ color: "#2563eb" }}>⏳ Processing</span> : <span style={{ color: "#6b7280" }}>📝 Manual</span>}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const cancelBtn = { background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const outlineBtn = { padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#6b7280" };
