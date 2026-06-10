import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";

const EMPTY_FORM = { address: "", city: "Youngstown", state: "OH", zip: "", type: "Single Family Home", notes: "", section8: false, section8Amount: "", tenantPortion: "", tenant_id: "" };

export default function AdminProperties({ tenants = [], onCountChange }) {
  const [properties, setProperties] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [saving, setSaving] = useState(false);
  const [assigningId, setAssigningId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("properties").select("*").order("created_at", { ascending: true });
    const loaded = data || [];
    setProperties(loaded);
    const nonArchived = loaded.filter(p => p.status !== "archived");
    const linkedIds = new Set(loaded.map(p => p.tenant_id).filter(Boolean));
    const archivedIds = new Set(loaded.filter(p => p.status === "archived").map(p => p.tenant_id).filter(Boolean));
    const unlinkedCount = tenants.filter(t => !linkedIds.has(t.id) && !archivedIds.has(t.id)).length;
    const total = nonArchived.length + unlinkedCount;
    if (onCountChange) onCountChange(total);
  };

  const allProperties = useMemo(() => {
    if (properties === null) return null;

    const linkedTenantIds = new Set(properties.map(p => p.tenant_id).filter(Boolean));
    const archivedTenantIds = new Set(properties.filter(p => p.status === "archived").map(p => p.tenant_id).filter(Boolean));
    const unlinkedTenants = tenants.filter(t => !linkedTenantIds.has(t.id) && !archivedTenantIds.has(t.id));

    const autoOccupied = unlinkedTenants.map(t => ({
      _auto: true,
      id: `auto-${t.id}`,
      address: t.address,
      type: "Single Family Home",
      status: "occupied",
      tenant_id: t.id,
      section8: t.section8 || false,
      section8_amount: t.section8_amount || t.section8Amount || 0,
      tenant_portion: t.tenant_portion || t.tenantPortion || 0,
    }));

    return [
      ...autoOccupied,
      ...properties.filter(p => p.status !== "archived").map(p => ({
        ...p,
        status: p.tenant_id ? "occupied" : "vacant",
      })),
    ];
  }, [properties, tenants]);

  if (allProperties === null) {
    return (
      <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, marginBottom: 8 }}>Properties</h1>
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  const totalUnits = allProperties.length;
  const occupiedCount = allProperties.filter(p => p.status === "occupied").length;
  const vacantCount = allProperties.filter(p => p.status === "vacant").length;

  const getTenant = (prop) => tenants.find(t => t.id === prop.tenant_id) || null;

  const handleAdd = async () => {
    if (!form.address.trim()) return;
    setSaving(true);
    const address = `${form.address}, ${form.city} ${form.state}${form.zip ? " " + form.zip : ""}`.trim();
    const { data } = await supabase.from("properties").insert({
      address,
      type: form.type,
      notes: form.notes,
      status: form.tenant_id ? "occupied" : "vacant",
      planner_stage: form.tenant_id ? null : "vacant",
      section8: form.section8,
      section8_amount: form.section8 ? Number(form.section8Amount) || 0 : 0,
      tenant_portion: form.section8 ? Number(form.tenantPortion) || 0 : 0,
      tenant_id: form.tenant_id || null,
    }).select().single();
    if (data) {
      const updated = [...properties, data];
      setProperties(updated);
      if (onCountChange) onCountChange(allProperties.length + 1);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
    }
    setSaving(false);
  };

  const handleAssignTenant = async (propId, tenantId) => {
    const updates = {
      tenant_id: tenantId || null,
      status: tenantId ? "occupied" : "vacant",
      planner_stage: tenantId ? "occupied" : "vacant",
    };
    await supabase.from("properties").update(updates).eq("id", propId);
    setProperties(prev => (prev || []).map(p => p.id === propId ? { ...p, ...updates } : p));
    setAssigningId(null);
  };

  const handleRemove = async (prop) => {
    if (prop._auto) {
      await supabase.from("properties").insert({
        address: prop.address,
        type: prop.type || "Single Family Home",
        status: "archived",
        tenant_id: prop.tenant_id,
        section8: prop.section8 || false,
        section8_amount: prop.section8_amount || 0,
        tenant_portion: prop.tenant_portion || 0,
      });
      await load();
      if (selectedProperty?.id === prop.id) setSelectedProperty(null);
      return;
    }
    await supabase.from("properties").delete().eq("id", prop.id);
    const updated = (properties || []).filter(p => p.id !== prop.id);
    setProperties(updated);
    if (selectedProperty?.id === prop.id) setSelectedProperty(null);
    const nonArchived = updated.filter(p => p.status !== "archived");
    const linkedIds = new Set(updated.map(p => p.tenant_id).filter(Boolean));
    const unlinked = tenants.filter(t => !linkedIds.has(t.id)).length;
    if (onCountChange) onCountChange(nonArchived.length + unlinked);
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total properties" value={totalUnits} icon="🏠" />
        <StatCard label="Occupied" value={occupiedCount} icon="✓" color="#16a34a" />
        <StatCard label="Vacant" value={vacantCount} icon="○" color={vacantCount > 0 ? "#dc2626" : "#6b7280"} />
      </div>

      {showAddForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "2px solid #4caf7d", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a", marginBottom: 16 }}>➕ Add property</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Street address</Label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. 123 Main St" style={inputSt} />
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
              <Label>Assign tenant (optional)</Label>
              <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} style={inputSt}>
                <option value="">— Vacant / No tenant —</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name} · {t.address}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Notes</Label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Recently renovated, needs tenant" style={inputSt} />
            </div>
          </div>
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
                <div>
                  <Label>Housing pays ($/mo)</Label>
                  <input value={form.section8Amount} onChange={e => setForm({ ...form, section8Amount: e.target.value })} placeholder="e.g. 1014" type="number" style={inputSt} />
                </div>
                <div>
                  <Label>Tenant pays ($/mo)</Label>
                  <input value={form.tenantPortion} onChange={e => setForm({ ...form, tenantPortion: e.target.value })} placeholder="e.g. 261" type="number" style={inputSt} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAdd} disabled={saving || !form.address.trim()} style={{ ...greenBtn, opacity: form.address.trim() ? 1 : 0.5 }}>
              {saving ? "Saving..." : "Add property"}
            </button>
            <button onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "11px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {allProperties.map(prop => {
          const isSelected = selectedProperty?.id === prop.id;
          const t = getTenant(prop);
          return (
            <div key={prop.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isSelected ? "#1b3d2a" : "#e5e7eb"}`, overflow: "hidden" }}>
              <div onClick={() => setSelectedProperty(isSelected ? null : prop)} style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: prop.status === "occupied" ? "#f0f9f4" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🏠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{prop.address}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{prop.type || "Single Family Home"}{t ? ` · ${t.name}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {prop.status === "occupied"
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 20, padding: "4px 12px" }}>✓ Occupied</span>
                    : <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 20, padding: "4px 12px" }}>○ Vacant</span>
                  }
                  <span style={{ color: "#9ca3af", fontSize: 16 }}>{isSelected ? "▲" : "▼"}</span>
                </div>
              </div>

              {isSelected && (
                <div style={{ borderTop: "1px solid #f3f4f6", padding: "20px", background: "#fafafa" }}>
                  {t ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Current Tenant</div>
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16 }}>
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
                        {t.notes && <div style={{ marginTop: 12, padding: "10px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>📝 {t.notes}</div>}
                        {!prop._auto && (
                          <div style={{ marginTop: 14, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
                            {assigningId === prop.id ? (
                              <div>
                                <Label>Assign different tenant</Label>
                                <select defaultValue={prop.tenant_id || ""} onChange={e => handleAssignTenant(prop.id, e.target.value)} style={{ ...inputSt, marginBottom: 8 }}>
                                  <option value="">— Mark as vacant —</option>
                                  {tenants.map(t2 => <option key={t2.id} value={t2.id}>{t2.name} · {t2.address}</option>)}
                                </select>
                                <button onClick={() => setAssigningId(null)} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setAssigningId(prop.id)} style={{ fontSize: 13, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                                🔄 Change / remove tenant
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => handleRemove(prop)} style={{ padding: "8px 16px", background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                            🗑 Remove property
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>Vacant Unit</div>
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16 }}>
                        {prop.notes && <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>{prop.notes}</div>}
                        {prop.section8 && (
                          <div style={{ marginBottom: 14, padding: "10px 12px", background: "#f0f9f4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1b3d2a", marginBottom: 4 }}>Section 8 / Housing Voucher</div>
                            <div style={{ fontSize: 13, color: "#374151" }}>Housing: <strong>${prop.section8_amount || 0}/mo</strong> · Tenant: <strong>${prop.tenant_portion || 0}/mo</strong></div>
                          </div>
                        )}
                        {!prop._auto && (
                          <div style={{ marginBottom: 14 }}>
                            {assigningId === prop.id ? (
                              <div>
                                <Label>Assign a tenant</Label>
                                <select defaultValue="" onChange={e => handleAssignTenant(prop.id, e.target.value)} style={{ ...inputSt, marginBottom: 8 }}>
                                  <option value="">— Select tenant —</option>
                                  {tenants.map(t2 => <option key={t2.id} value={t2.id}>{t2.name} · {t2.address}</option>)}
                                </select>
                                <button onClick={() => setAssigningId(null)} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setAssigningId(prop.id)} style={{ ...greenBtn, fontSize: 13, padding: "9px 16px", marginBottom: 10 }}>
                                👤 Assign tenant
                              </button>
                            )}
                          </div>
                        )}
                        <button onClick={() => handleRemove(prop)} style={{ padding: "8px 16px", background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
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

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: on ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.2s" }} />
    </div>
  );
}
function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
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
