const STATUS_CONFIG = {
  open: { label: "Open", color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
  "in-progress": { label: "In progress", color: "#1e40af", bg: "#dbeafe", border: "#60a5fa" },
  resolved: { label: "Resolved", color: "#166534", bg: "#dcfce7", border: "#4ade80" },
};

const URGENCY_ICON = { high: "🔴", medium: "🟡", low: "🟢" };

const CATEGORY_ICON = {
  Plumbing: "🚿", HVAC: "❄️", Electrical: "⚡", General: "🔧",
  Appliance: "🍳", "Pest control": "🐛", Other: "📋",
};

export default function TicketsScreen({ tickets, onNewTicket }) {
  const active = tickets.filter(t => t.status !== "resolved");
  const resolved = tickets.filter(t => t.status === "resolved");

  return (
    <div style={{ padding: "16px" }}>
      <button onClick={onNewTicket} style={{
        width: "100%", background: "#1b3d2a", color: "#fff",
        border: "none", borderRadius: 13, padding: "14px",
        fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
        cursor: "pointer", marginBottom: 18, display: "flex",
        alignItems: "center", justifyContent: "center", gap: 8,
        letterSpacing: "-0.2px",
      }}>
        <span style={{ fontSize: 18 }}>+</span> Submit new ticket
      </button>

      {active.length > 0 && (
        <>
          <SectionLabel>Active tickets</SectionLabel>
          {active.map(t => <TicketCard key={t.id} ticket={t} />)}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 10 }}>Resolved</SectionLabel>
          {resolved.map(t => <TicketCard key={t.id} ticket={t} />)}
        </>
      )}

      {tickets.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
          <div style={{ fontWeight: 500 }}>No open tickets</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Submit one if something needs attention.</div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  );
}

function TicketCard({ ticket }) {
  const st = STATUS_CONFIG[ticket.status];
  return (
    <div style={{
      background: "#fff", borderRadius: 13, padding: "14px",
      marginBottom: 9, border: "1px solid rgba(0,0,0,0.07)",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: "#f3f4f6", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 18, flexShrink: 0,
      }}>
        {CATEGORY_ICON[ticket.category] || "🔧"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{ticket.title}</div>
          <div style={{
            fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, flexShrink: 0,
            background: st.bg, color: st.color, border: `1px solid ${st.border}`,
          }}>
            {st.label}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
          {URGENCY_ICON[ticket.urgency]} {ticket.category} · #{ticket.id} · {ticket.date}
        </div>
      </div>
    </div>
  );
}
