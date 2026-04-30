import { useState } from "react";

const INIT_TENANTS = [
  { id: 1, name: "Marcus Johnson", email: "marcus@email.com", phone: "(410) 555-0121", unit: "Apt 3A", rent: 1100, leaseEnd: "Dec 31, 2026", paid: true },
  { id: 2, name: "Tanya Williams", email: "tanya@email.com", phone: "(410) 555-0133", unit: "Apt 1B", rent: 950, leaseEnd: "Nov 30, 2026", paid: false },
  { id: 3, name: "Derek Moore", email: "derek@email.com", phone: "(410) 555-0148", unit: "Apt 2C", rent: 1250, leaseEnd: "Jan 31, 2027", paid: true },
  { id: 4, name: "Sandra Price", email: "sandra@email.com", phone: "(410) 555-0157", unit: "Apt 4A", rent: 875, leaseEnd: "Oct 31, 2026", paid: false },
  { id: 5, name: "James Chen", email: "james@email.com", phone: "(410) 555-0162", unit: "Apt 2B", rent: 1100, leaseEnd: "Dec 31, 2026", paid: true },
];

export default function AdminTenants() {
  const [tenants, setTenants] = useState(INIT_TENANTS);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", unit: "", rent: "", leaseEnd: "" });

  const handleAdd = () => {
    if (!form.name || !form.unit) return;
    setTenants([...tenants, { id: Date.now(), ...form, rent: Number(form.rent), paid: false }]);
    setForm({ name: "", email: "", phone: "", unit: "", rent: "", leaseEnd: "" });
    setShowAdd(false);
  };

  const handleRemove = (id) => {
    if (window.confirm("Remove this tenant?")) setTenants(tenants.filter(t => t.id !== id));
  };

  const handleEdit = (t) => {
    setEditing(t.id);
    setForm({ ...t, rent: String(t.rent) });
    setShowAdd(true);
  };

  const handleSave = () => {
    setTenants(tenants.map(t => t.id === editing ? { ...t, ...form, rent: Number(form.rent) } : t));
    setEditing(null);
    setForm({ name: "", email: "", phone: "", unit: "", rent: "", leaseEnd: "" });
    setShowAdd(false);
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Tenants & Units</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{tenants.length} tenants · {tenants.filter(t => t.paid).length} paid this month</div>
        </div>
        <button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ name: "", email: "", phone: "", unit: "", rent: "", leaseEnd: "" }); }} style={{
          background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10,
          padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>+ Add tenant</button>
      </div>

      {/* Add / Edit form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "2px solid #4caf7d", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#1b3d2a" }}>
            {editing ? "Edit tenant" : "Add new tenant"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              ["Full name", "name", "text"],
              ["Email", "email", "email"],
              ["Phone", "phone", "text"],
              ["Unit", "unit", "text"],
              ["Monthly rent ($)", "rent", "number"],
              ["Lease end date", "leaseEnd", "text"],
            ].map(([label, key, type]) => (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 5 }}>{label}</div>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={editing ? handleSave : handleAdd} style={{
              background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9,
              padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>{editing ? "Save changes" : "Add tenant"}</button>
            <button onClick={() => { setShowAdd(false); setEditing(null); }} style={{
              background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9,
              padding: "10px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tenant cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tenants.map(t => (
          <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
              {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{t.email} · {t.phone}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.unit}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Lease ends {t.leaseEnd}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a" }}>${t.rent.toLocaleString()}/mo</div>
              <div style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, marginTop: 3, display: "inline-block", background: t.paid ? "#dcfce7" : "#fee2e2", color: t.paid ? "#166534" : "#991b1b", fontWeight: 600 }}>
                {t.paid ? "Paid" : "Unpaid"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleEdit(t)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
              <button onClick={() => handleRemove(t.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
