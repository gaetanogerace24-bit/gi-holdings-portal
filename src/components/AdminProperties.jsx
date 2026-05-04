import { useState } from "react";
import { supabase } from "../supabase";

const EMPTY_PROPERTY = { address: "", city: "Youngstown", state: "OH", zip: "", type: "Single Family Home", units: 1, notes: "" };

export default function AdminProperties({ tenants = [], setTenants }) {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_PROPERTY);

  // Build property list from tenants (each unique address = a property)
  // Plus any manually added vacant properties stored in state
  const [vacantProperties, setVacantProperties] = useState([]);

  // Deduplicate tenant addresses into properties
  const occupiedProperties = tenants.map(t => ({
    id: t.id,
    address: t.address,
    type: "Single Family Home",
    status: "occupied",
    tenant: t,
  }));

  const allProperties = [
    ...occupiedProperties,
    ...vacantProperties.map(p => ({ ...p, status: "vacant", tenant: null })),
  ];

  const totalUnits = allProperties.length;
  const occupiedCount = occupiedProperties.length;
  const vacantCount = vacantProperties.length;

  const handleAddVacant = () => {
    if (!form.address.trim()) return;
    const newProp = {
      id: `vacant-${Date.now()}`,
      address: `${form.address}, ${form.city} ${form.state} ${form.zip}`.trim(),
      type: form.type,
      notes: form.notes,
    };
    setVacantProperties([...vacantProperties, newProp]);
    setForm(EMPTY_PROPERTY);
    setShowAddForm(false);
  };

  const handleRemoveVacant = (id) => {
    setVacantProperties(vacantProperties.filter(p => p.id !== id));
    if (selectedProperty?.id === id) setSelectedProperty(null);
  };

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif", maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Properties</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{totalUnits} propert{totalUnits !== 1 ? "ies" : "y"}</div>
        </div>
        <button onClick={() => setShowAddForm(true)} style={greenBtn}>+ Add property</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total properties" value={totalUnits} icon="🏠" />
        <StatCard label="Occupied" value={occupiedCount} icon="✓" color="#16a34a" />
        <StatCard label="Vacant" value={vacantCount} icon="○" color={vacantCount > 0 ? "#dc2626" : "#6b7280"} />
      </div>

      {/* Add vacant property form */}
      {showAddForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "2px solid #4caf7d", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a", marginBottom: 16 }}>➕ Add vacant property</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Street address</Label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. 123 Main St" style={inputSt} />
            </div>
            <div>
              <Label>City</Label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={inputSt} />
            </div>
            <div>
              <Label>ZIP</Label>
              <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} placeholder="44501" style={inputSt} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Property type</Label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputSt}>
                <option>Single Family Home</option>
                <option>Duplex</option>
                <option>Multi-family</option>
                <option>Apartment</option>
                <option>Condo</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Notes</Label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Recently renovated, needs tenant" style={inputSt} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAddVacant} style={greenBtn}>Add property</button>
            <button onClick={() => { setShowAddForm(false); setForm(EMPTY_PROPERTY); }}
              style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "11px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Property list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {allProperties.map(prop => {
          const isSelected = selectedProperty?.id === prop.id;
          const t = prop.tenant;
          return (
            <div key={prop.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isSelected ? "#1b3d2a" : "#e5e7eb"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
              {/* Property row */}
              <div
                onClick={() => setSelectedProperty(isSelected ? null : prop)}
                style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: prop.status === "occupied" ? "#f0f9f4" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  🏠
                </div>

                {/* Address + type */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{prop.address}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{prop.type}</div>
                </div>

                {/* Status badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {prop.status === "occupied" ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 20, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      ✓ Occupied
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 20, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      ○ Vacant
                    </span>
                  )}
                  <span style={{ color: "#9ca3af", fontSize: 16 }}>{isSelected ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div style={{ borderTop: "1px solid #f3f4f6", padding: "20px", background: "#fafafa" }}>
                  {prop.status === "occupied" && t ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Current Tenant</div>
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                            {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.email}</div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <InfoRow label="Monthly rent" value={`$${(t.rent || 0).toLocaleString()}/mo`} />
                          <InfoRow label="Deposit" value={t.deposit > 0 ? `$${(t.deposit || 0).toLocaleString()}` : "—"} />
                          <InfoRow label="Lease start" value={fmtDate(t.leaseStart || t.lease_start)} />
                          <InfoRow label="Lease end" value={fmtDate(t.leaseEnd || t.lease_end)} />
                          {t.phone && <InfoRow label="Phone" value={t.phone} />}
                          {t.section8 && <InfoRow label="Section 8" value={`Housing: $${t.section8_amount || t.section8Amount || 0} · Tenant: $${t.tenant_portion || t.tenantPortion || 0}`} />}
                        </div>

                        {t.notes && (
                          <div style={{ marginTop: 12, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
                            📝 {t.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Vacant Unit</div>
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px" }}>
                        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
                          {prop.notes || "No notes added for this property."}
                        </div>
                        <button onClick={() => handleRemoveVacant(prop.id)}
                          style={{ padding: "8px 16px", background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                          🗑 Remove property
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allProperties.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 40px", border: "2px dashed #e5e7eb", borderRadius: 16, color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No properties yet</div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "#1a1a1a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return dateStr;
  } catch { return dateStr; }
}

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const inputSt = { width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" };
