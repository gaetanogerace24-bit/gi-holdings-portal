import { useState } from "react";
import { supabase } from "../supabase";
import { calcLateFee } from "./AdminOverview";

const EMPTY_FORM = { name: "", email: "", phone: "", unit: "", address: "", rent: "", leaseStart: "", leaseEnd: "", notes: "", public_note: "", deposit: "", section8: false, section8Amount: "", tenantPortion: "" };
const DOC_CATEGORIES = ["Lease agreement", "Move-in inspection", "Community rules", "Other"];

export default function AdminTenants({ tenants, setTenants }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedDocs, setExpandedDocs] = useState(null); // tenant id
  const [docForm, setDocForm] = useState({ name: "", category: "Lease agreement", url: "" });

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ ...t, rent: String(t.rent), deposit: String(t.deposit || "") }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.rent) return;
    
    const tenantData = {
      name: form.name,
      email: form.email || "",
      phone: form.phone || "",
      unit: form.unit || "",
      address: form.address || "",
      rent: Number(form.rent) || 0,
      deposit: Number(form.deposit) || 0,
      lease_start: form.leaseStart || form.lease_start || "",
      lease_end: form.leaseEnd || form.lease_end || "",
      notes: form.notes || "",
      public_note: form.public_note || "",
      section8: Boolean(form.section8),
      section8_amount: Number(form.section8Amount || form.section8_amount) || 0,
      tenant_portion: Number(form.tenantPortion || form.tenant_portion) || 0,
      emergency: "(330) 969-6464",
      contact_email: "tenants@giholdings.com",
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      // Update existing tenant in Supabase
      await supabase.from("tenants").update(tenantData).eq("id", editing);
      setTenants(tenants.map(t => t.id === editing ? { ...t, ...form, ...tenantData, rent: Number(form.rent), deposit: Number(form.deposit) || 0 } : t));
    } else {
      // Insert new tenant in Supabase
      const { data, error } = await supabase.from("tenants").insert({ ...tenantData, paid: false, documents: [] }).select().single();
      if (data) {
        setTenants([...tenants, { ...data, leaseStart: data.lease_start, leaseEnd: data.lease_end, section8Amount: data.section8_amount, tenantPortion: data.tenant_portion }]);
      }
    }
    closeForm();
  };

  const handleRemove = (id, name) => {
    if (window.confirm(`Remove ${name}? This cannot be undone.`)) setTenants(tenants.filter(t => t.id !== id));
  };

  const togglePaid = async (id) => {
    const tenant = tenants.find(t => t.id === id);
    const newPaid = !tenant.paid;
    const paidDate = newPaid ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
    await supabase.from("tenants").update({ paid: newPaid, paid_date: paidDate, updated_at: new Date().toISOString() }).eq("id", id);
    setTenants(tenants.map(t => t.id === id ? { ...t, paid: newPaid, paidDate } : t));
  };

  const addDocument = async (tenantId) => {
    if (!docForm.name.trim()) return;
    const doc = { ...docForm, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), id: Date.now() };
    const tenant = tenants.find(t => t.id === tenantId);
    const newDocs = [...(tenant?.documents || []), doc];
    await supabase.from("tenants").update({ documents: newDocs, updated_at: new Date().toISOString() }).eq("id", tenantId);
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, documents: newDocs } : t));
    setDocForm({ name: "", category: "Lease agreement", url: "" });
  };

  const removeDocument = async (tenantId, docId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    const newDocs = (tenant?.documents || []).filter(d => d.id !== docId);
    await supabase.from("tenants").update({ documents: newDocs, updated_at: new Date().toISOString() }).eq("id", tenantId);
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, documents: newDocs } : t));
  };

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Tenants & Units</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {tenants.length === 0 ? "No tenants yet" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} · ${tenants.filter(t => t.paid).length} paid this month`}
          </div>
        </div>
        <button onClick={openAdd} style={greenBtn}>+ Add tenant</button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "2px solid #4caf7d", marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a", marginBottom: 20 }}>{editing ? "✏️ Edit tenant" : "➕ Add new tenant"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <FormField label="Full name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Gary Thornton" />
            <FormField label="Monthly rent ($) *" value={form.rent} onChange={v => setForm({ ...form, rent: v })} placeholder="e.g. 900" type="number" />
            <FormField label="Property address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="510 W Evergreen Ave, Youngstown OH" />
            <FormField label="Security deposit ($)" value={form.deposit} onChange={v => setForm({ ...form, deposit: v })} placeholder="e.g. 850" type="number" />
            <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="tenant@email.com" type="email" />
            <FormField label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="(330) 555-0000" />
            <FormField label="Lease start" value={form.leaseStart} onChange={v => setForm({ ...form, leaseStart: v })} type="date" />
            <FormField label="Lease end" value={form.leaseEnd} onChange={v => setForm({ ...form, leaseEnd: v })} type="date" />
          </div>

          {/* Section 8 */}
          <div style={{ padding: "14px 16px", background: "#f0f9f4", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1b3d2a" }}>Section 8 / Housing voucher</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Housing authority pays part of rent</div>
              </div>
              <Toggle on={form.section8} onToggle={() => setForm({ ...form, section8: !form.section8 })} />
            </div>
            {form.section8 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <FormField label="Housing pays ($/mo)" value={form.section8Amount} onChange={v => setForm({ ...form, section8Amount: v })} placeholder="e.g. 1014" type="number" />
                <FormField label="Tenant pays ($/mo)" value={form.tenantPortion} onChange={v => setForm({ ...form, tenantPortion: v })} placeholder="e.g. 261" type="number" />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>
              🔒 Private notes <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>(only you see this)</span>
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Private notes — tenant cannot see this..."
              rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>
              💬 Tenant message <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>(tenant sees this in their portal)</span>
            </div>
            <textarea value={form.public_note || ""} onChange={e => setForm({ ...form, public_note: e.target.value })} placeholder="Message for tenant — they will see this in their My Unit tab..."
              rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #bbf7d0", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none", background: "#f0f9f4" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={handleSave} style={{ ...greenBtn, opacity: form.name && form.rent ? 1 : 0.5 }}>{editing ? "Save changes" : "Add tenant"}</button>
            <button onClick={closeForm} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tenants.length === 0 && !showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>No tenants added yet</div>
          <button onClick={openAdd} style={greenBtn}>+ Add your first tenant</button>
        </div>
      )}

      {/* Tenant cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tenants.map(t => {
          const lateFee = calcLateFee(t.paid);
          const docsOpen = expandedDocs === t.id;
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
              {/* Main row */}
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.section8 && <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5 }}>SECTION 8</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{t.address}{t.email ? ` · ${t.email}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", marginRight: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a" }}>${(t.rent || 0).toLocaleString()}/mo</div>
                  {t.section8 && <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>Housing: ${t.section8Amount} / Tenant: ${t.tenantPortion}</div>}
                  {lateFee > 0 && !t.paid && !t.section8 && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>+${lateFee} late fee</div>}
                  {t.deposit > 0 && <div style={{ fontSize: 11, color: "#9ca3af" }}>Deposit: ${(t.deposit || 0).toLocaleString()}</div>}
                </div>

                {/* Paid toggle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>Paid</div>
                  <Toggle on={t.paid} onToggle={() => togglePaid(t.id)} />
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setExpandedDocs(docsOpen ? null : t.id)} style={{ ...outlineBtn, borderColor: docsOpen ? "#1b3d2a" : "#e5e7eb", color: docsOpen ? "#1b3d2a" : "#6b7280" }}>
                    📄 Docs {t.documents?.length > 0 ? `(${t.documents.length})` : ""}
                  </button>
                  <button onClick={() => openEdit(t)} style={outlineBtn}>Edit</button>
                  <button onClick={() => handleRemove(t.id, t.name)} style={{ ...outlineBtn, borderColor: "#fee2e2", color: "#dc2626" }}>Remove</button>
                </div>
              </div>

              {t.notes && (
                <div style={{ margin: "0 20px 14px 20px", fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>📝 {t.notes}</div>
              )}

              {/* Documents panel */}
              {docsOpen && (
                <div style={{ borderTop: "1px solid #f3f4f6", padding: "16px 20px", background: "#fafafa" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#1b3d2a" }}>📄 Documents for {t.name}</div>

                  {/* Add document form */}
                  <div style={{ background: "#fff", borderRadius: 12, padding: "14px", border: "1px solid #e5e7eb", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Add new document</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <Label>Document name</Label>
                        <input value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. Lease 2025-2026" style={inputSt} />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <select value={docForm.category} onChange={e => setDocForm({ ...docForm, category: e.target.value })} style={inputSt}>
                          {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <Label>File URL (Google Drive, Dropbox, etc.)</Label>
                      <input value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })} placeholder="https://drive.google.com/..." style={inputSt} />
                    </div>
                    <button onClick={() => addDocument(t.id)} style={{ ...greenBtn, fontSize: 13, padding: "8px 18px" }}>+ Add document</button>
                  </div>

                  {/* Document list */}
                  {(!t.documents || t.documents.length === 0) ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: 13 }}>No documents yet — add one above</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {DOC_CATEGORIES.map(cat => {
                        const catDocs = (t.documents || []).filter(d => d.category === cat);
                        if (catDocs.length === 0) return null;
                        return (
                          <div key={cat}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{cat}</div>
                            {catDocs.map(doc => (
                              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 9, padding: "10px 14px", border: "1px solid #f3f4f6", marginBottom: 6 }}>
                                <span style={{ fontSize: 16 }}>{docIcon(doc.category)}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.name}</div>
                                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Added {doc.date}</div>
                                </div>
                                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4caf7d", fontWeight: 600, textDecoration: "none" }}>View →</a>}
                                <button onClick={() => removeDocument(t.id, doc.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✕</button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: on ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.2s" }} />
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" }} />
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function docIcon(cat) {
  if (cat === "Lease agreement") return "📄";
  if (cat === "Move-in inspection") return "🔑";
  if (cat === "Community rules") return "📜";
  return "📋";
}

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const outlineBtn = { padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#6b7280" };
const inputSt = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1a1a1a", boxSizing: "border-box" };
