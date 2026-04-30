import { useState } from "react";

const INIT_TICKETS = [
  { id: 1041, tenant: "Marcus Johnson", unit: "Apt 3A", title: "AC unit not cooling", category: "HVAC", urgency: "high", status: "open", date: "Apr 26" },
  { id: 1040, tenant: "Tanya Williams", unit: "Apt 1B", title: "Bathroom faucet dripping", category: "Plumbing", urgency: "medium", status: "in-progress", date: "Apr 19" },
  { id: 1039, tenant: "Sandra Price", unit: "Apt 4A", title: "Window won't lock", category: "General", urgency: "high", status: "open", date: "Apr 18" },
  { id: 1038, tenant: "Derek Moore", unit: "Apt 2C", title: "Dishwasher not draining", category: "Appliance", urgency: "medium", status: "in-progress", date: "Apr 15" },
  { id: 1037, tenant: "Marcus Johnson", unit: "Apt 3A", title: "Front door lock stiff", category: "General", urgency: "low", status: "resolved", date: "Apr 10" },
  { id: 1036, tenant: "James Chen", unit: "Apt 2B", title: "Smoke detector battery", category: "Electrical", urgency: "medium", status: "resolved", date: "Mar 28" },
];

const STATUS_OPTS = ["open", "in-progress", "resolved"];
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

export default function AdminTickets() {
  const [tickets, setTickets] = useState(INIT_TICKETS);
  const [filter, setFilter] = useState("all");

  const updateStatus = (id, status) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
  };

  const filtered = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Maintenance Tickets</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{tickets.filter(t => t.status !== "resolved").length} active · {tickets.filter(t => t.status === "resolved").length} resolved</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "open", "in-progress", "resolved"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 8, border: "1.5px solid",
            borderColor: filter === f ? "#1b3d2a" : "#e5e7eb",
            background: filter === f ? "#1b3d2a" : "#fff",
            color: filter === f ? "#fff" : "#6b7280",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer",
            textTransform: "capitalize",
          }}>{f === "all" ? `All (${tickets.length})` : f}</button>
        ))}
      </div>

      {/* Tickets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(t => (
          <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{t.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase",
                    background: URGENCY_STYLE[t.urgency].bg, color: URGENCY_STYLE[t.urgency].color,
                  }}>{t.urgency}</span>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {t.tenant} · {t.unit} · {t.category} · #{t.id} · {t.date}
                </div>
              </div>

              {/* Status dropdown */}
              <select
                value={t.status}
                onChange={e => updateStatus(t.id, e.target.value)}
                style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: "1.5px solid #e5e7eb", cursor: "pointer",
                  background: STATUS_STYLE[t.status].bg,
                  color: STATUS_STYLE[t.status].color,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {STATUS_OPTS.map(s => (
                  <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
