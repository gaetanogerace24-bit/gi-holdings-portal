import { useState } from "react";

const STATUS_STYLE = {
  "open": { bg: "#fee2e2", color: "#991b1b", label: "Open" },
  "in-progress": { bg: "#dbeafe", color: "#1e40af", label: "In Progress" },
  "resolved": { bg: "#dcfce7", color: "#166534", label: "Resolved" },
};
const URGENCY_STYLE = {
  high: { bg: "#fee2e2", color: "#991b1b" },
  medium: { bg: "#fef3c7", color: "#92400e" },
  low: { bg: "#dcfce7", color: "#166534" },
};
const CATEGORIES = ["Plumbing", "HVAC / Heat", "Electrical", "Appliance", "Pest control", "General", "Other"];

export default function AdminTickets({ tenants, sharedTickets, setSharedTickets, supabase }) {
  const [localTickets, setLocalTickets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tenantId: "", title: "", category: "General", urgency: "medium", notes: "" });

  // Combine admin-created tickets with tenant-submitted tickets
  const allTickets = [...(sharedTickets || []), ...localTickets];

  const updateStatus = async (id, status) => {
    if (supabase) {
      await supabase.from("tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    }
    // Update in shared tickets first
    if (setSharedTickets) {
      setSharedTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    }
    setLocalTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleAdd = () => {
    if (!form.title || !form.tenantId) return;
    const tenant = tenants.find(t => String(t.id) === form.tenantId);
    setLocalTickets([{
      id: Date.now(), ...form,
      tenantName: tenant?.name || "Unknown",
      unit: tenant?.unit || "",
      status: "open",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }, ...localTickets]);
    setForm({ tenantId: "", title: "", category: "General", urgency: "medium", notes: "" });
    setShowAdd(false);
  };

  const handleRemove = (id) => {
    if (window.confirm("Delete this ticket?")) {
      if (setSharedTickets) setSharedTickets(prev => prev.filter(t => t.id !== id));
      setLocalTickets(prev => prev.filter(t => t.id !== id));
    }
  };

  const filtered = filter === "all" ? allTickets : allTickets.filter(t => t.status === filter);
  const activeCount = allTickets.filter(t => t.status !== "resolved").length;

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Maintenance Tickets</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {allTickets.length === 0 ? "No tickets yet" : `${activeCount} active · ${allTickets.filter(t => t.status === "resolved").length} resolved`}
          </div>
        </div>
        {tenants.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10,
            padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>+ Add ticket</button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "2px solid #4caf7d", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#1b3d2a" }}>New ticket</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Tenant</Label>
              <select value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })} style={selectStyle}>
                <option value="">Select tenant...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name} – {t.unit}</option>)}
              </select>
            </div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Issue title</Label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief description..." style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Urgency</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {["low", "medium", "high"].map(u => (
                <button key={u} onClick={() => setForm({ ...form, urgency: u })} style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                  border: form.urgency === u ? `2px solid ${URGENCY_STYLE[u].color}` : "1.5px solid #e5e7eb",
                  background: form.urgency === u ? URGENCY_STYLE[u].bg : "#fff",
                  color: form.urgency === u ? URGENCY_STYLE[u].color : "#6b7280",
                }}>{u}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAdd} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add ticket</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "10px 16px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {allTickets.length === 0 && !showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎫</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No tickets yet</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>
            {tenants.length === 0 ? "Add tenants first, then you can track their maintenance requests here." : "Tickets submitted by tenants will appear here."}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {allTickets.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["all", "open", "in-progress", "resolved"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8,
              border: filter === f ? "none" : "1.5px solid #e5e7eb",
              background: filter === f ? "#1b3d2a" : "#fff",
              color: filter === f ? "#fff" : "#6b7280",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
            }}>{f === "all" ? `All (${allTickets.length})` : STATUS_STYLE[f].label}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(t => (
          <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase", background: URGENCY_STYLE[t.urgency].bg, color: URGENCY_STYLE[t.urgency].color }}>{t.urgency}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.tenantName} · {t.unit} · {t.category} · {t.date}</div>
              </div>
              <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1.5px solid #e5e7eb",
                background: STATUS_STYLE[t.status].bg, color: STATUS_STYLE[t.status].color, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              }}>
                {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => handleRemove(t.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}
const selectStyle = { padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a" };
