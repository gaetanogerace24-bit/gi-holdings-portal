import { useState } from "react";
import AdminOverview from "./AdminOverview";
import AdminTickets from "./AdminTickets";
import AdminTenants from "./AdminTenants";
import AdminMessages from "./AdminMessages";
import AdminSettings from "./AdminSettings";

const NAV = [
  { key: "overview", icon: "📊", label: "Overview" },
  { key: "tickets", icon: "🎫", label: "Tickets" },
  { key: "tenants", icon: "👥", label: "Tenants" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "settings", icon: "⚙️", label: "Settings" },
];

export default function AdminDashboard({ onLogout }) {
  const [active, setActive] = useState("overview");

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0f1a14", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: "#0f1a14", borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>G&I Holdings</div>
          <div style={{
            fontSize: 10, color: "#4caf7d", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "1.5px", marginTop: 2,
          }}>Owner Portal</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setActive(n.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "11px 20px", border: "none", cursor: "pointer",
              background: active === n.key ? "rgba(76,175,125,0.12)" : "transparent",
              borderLeft: active === n.key ? "3px solid #4caf7d" : "3px solid transparent",
              color: active === n.key ? "#4caf7d" : "rgba(255,255,255,0.5)",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: active === n.key ? 600 : 400,
              textAlign: "left", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "0 20px" }}>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Logged in as</div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 500, marginBottom: 10 }}>Gaetano · Owner</div>
            <button onClick={onLogout} style={{
              width: "100%", padding: "8px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, cursor: "pointer",
            }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f5f7f5" }}>
        {active === "overview" && <AdminOverview />}
        {active === "tickets" && <AdminTickets />}
        {active === "tenants" && <AdminTenants />}
        {active === "messages" && <AdminMessages />}
        {active === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}
