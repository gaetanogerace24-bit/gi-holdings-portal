import { useState } from "react";
import { calcLateFee } from "./AdminOverview";

const EMPTY_FORM = { name: "", email: "", phone: "", unit: "", address: "", rent: "", leaseStart: "", leaseEnd: "", notes: "", section8: false, section8Amount: "", tenantPortion: "" };

export default function AdminTenants({ tenants, setTenants }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ ...t, rent: String(t.rent) }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = () => {
    if (!form.name.trim() || !form.unit.trim() || !form.rent) return;
    if (editing) {
      setTenants(tenants.map(t => t.id === editing ? { ...t, ...form, rent: Number(form.rent) } : t));
    } else {
      setTenants([...tenants, { id: Date.now(), ...form, rent: Number(form.rent), paid: false }]);
    }
    closeForm();
  };

  const handleRemove = (id, name) => {
    if (window.confirm(`Remove ${name} from the portal? This cannot be undone.`)) {
      setTenants(tenants.filter(t => t.id !== id));
    }
  };

  const togglePaid = (id) => {
    setTenants(tenants.map(t => t.id === id ? { ...t, paid: !t.paid } : t));
  };

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Tenants & Units</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {tenants.length === 0 ? "No tenants yet — add your first one!" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} · ${tenants.filter(t => t.paid).length} paid this month`}
          </div>
        </div>
        <button onClick={openAdd} style={{
          background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10,
          padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>+ Add tenant</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "2px solid #4caf7d", marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a", marginBottom: 20 }}>
            {editing ? "✏️ Edit tenant" : "➕ Add new tenant"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <FormField label="Full name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Marcus Johnson" />
            <FormField label="Monthly rent ($) *" value={form.rent} onChange={v => setForm({ ...form, rent: v })} placeholder="e.g. 1100" type="number" />
            <FormField label="Unit / Apt *" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="e.g. Apt 3A" />
            <FormField label="Property address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="e.g. 824 Elmwood Ave" />
            <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="tenant@email.com" type="email" />
            <FormField label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="(410) 555-0000" />
            <FormField label="Lease start" value={form.leaseStart} onChange={v => setForm({ ...form, leaseStart: v })} type="date" />
            <FormField label="Lease end" value={form.leaseEnd} onChange={v => setForm({ ...form, leaseEnd: v })} type="date" />
          </div>
          <div style={{ padding: "14px 16px", background: "#f0f9f4", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 14, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1b3d2a" }}>Section 8 / Housing voucher</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Enable if housing authority pays part of rent</div>
              </div>
              <div onClick={() => setForm({ ...form, section8: !form.section8 })} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: form.section8 ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: form.section8 ? 23 : 3, transition: "left 0.2s" }} />
              </div>
            </div>
            {form.section8 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <FormField label="Housing pays ($/mo)" value={form.section8Amount} onChange={v => setForm({ ...form, section8Amount: v })} placeholder="e.g. 1014" type="number" />
                <FormField label="Tenant pays ($/mo)" value={form.tenantPortion} onChange={v => setForm({ ...form, tenantPortion: v })} placeholder="e.g. 261" type="number" />
              </div>
            )}
          </div>
          <FormField label="Notes (optional)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Any notes about this tenant or unit..." />
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={handleSave} style={{
              background: form.name && form.unit && form.rent ? "#1b3d2a" : "#d1d5db",
              color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px",
              fontSize: 14, fontWeight: 700, cursor: form.name && form.unit && form.rent ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
            }}>{editing ? "Save changes" : "Add tenant"}</button>
            <button onClick={closeForm} style={{
              background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10,
              padding: "12px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tenants.length === 0 && !showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No tenants added yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Click "Add tenant" to get started</div>
          <button onClick={openAdd} style={{
            background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10,
            padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>+ Add your first tenant</button>
        </div>
      )}

      {/* Tenant list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tenants.map(t => {
          const lateFee = calcLateFee(t.paid);
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.section8 && <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" }}>Section 8</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    {t.unit}{t.address ? ` · ${t.address}` : ""}{t.email ? ` · ${t.email}` : ""}{t.phone ? ` · ${t.phone}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", marginRight: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a" }}>${t.rent.toLocaleString()}/mo</div>
                  {t.section8 && <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>Housing: ${t.section8Amount} · Tenant: ${t.tenantPortion}</div>}
                  {lateFee > 0 && !t.paid && !t.section8 && (
                    <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>+${lateFee} late fee</div>
                  )}
                  {t.amountOwed && !t.paid && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>Owes ${t.amountOwed.toLocaleString()} total</div>}
                  {t.leaseEnd && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Lease ends {t.leaseEnd}</div>}
                </div>

                {/* Paid toggle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>Paid</div>
                  <div onClick={() => togglePaid(t.id)} style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                    background: t.paid ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3, left: t.paid ? 23 : 3, transition: "left 0.2s",
                    }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(t)} style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
                  <button onClick={() => handleRemove(t.id, t.name)} style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                </div>
              </div>
              {t.notes && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#6b7280" }}>📝 {t.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 5 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" }} />
    </div>
  );
}
