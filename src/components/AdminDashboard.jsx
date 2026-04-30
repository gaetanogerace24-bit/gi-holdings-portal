import { useState } from "react";
import AdminOverview from "./AdminOverview";
import AdminTickets from "./AdminTickets";
import AdminTenants from "./AdminTenants";
import AdminMessages from "./AdminMessages";
import AdminSettings from "./AdminSettings";
import AdminDocuments from "./AdminDocuments";

const NAV = [
  { key: "overview", icon: "📊", label: "Overview" },
  { key: "tickets", icon: "🎫", label: "Tickets" },
  { key: "tenants", icon: "👥", label: "Tenants" },
  { key: "documents", icon: "📁", label: "Documents" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "settings", icon: "⚙️", label: "Settings" },
];

export default function AdminDashboard({ onLogout, sharedTenants, setSharedTenants, sharedTickets, setSharedTickets, supabase }) {
  const [active, setActive] = useState("overview");
  const [tenants, setTenantsLocal] = useState(sharedTenants || [
    {
      id: 1,
      name: "Gary Thornton",
      unit: "Single Family",
      address: "510 W Evergreen Ave, Youngstown OH 44511",
      rent: 900,
      paid: false,
      amountOwed: 1175, // rent + late fees already accrued
      email: "",
      phone: "",
      leaseStart: "",
      leaseEnd: "",
      notes: "Currently owes $1,175 (includes accrued late fees as of May 2026)",
    },
    {
      id: 2,
      name: "Angelisa Pate",
      unit: "Single Family",
      address: "3646 Beechwood Pl, Youngstown OH 44502",
      rent: 1275,
      paid: false,
      section8: true,
      section8Amount: 1014,
      tenantPortion: 261,
      housingOwedBack: 1014,
      email: "",
      phone: "",
      leaseStart: "",
      leaseEnd: "",
      notes: "⚠️ Housing authority owes $1,014 for APRIL (unpaid). May check expected May 1st. Angelisa's portion: $261/mo.",
    },
    {
      id: 3,
      name: "Danielle Russell",
      unit: "Single Family",
      address: "3138 Idlewood Ave, Youngstown OH 44511",
      rent: 1100,
      paid: true,
      email: "",
      phone: "",
      leaseStart: "",
      leaseEnd: "",
      notes: "",
    },
  ]);

  // Sync with App.jsx which saves to Supabase
  const setTenants = (val) => {
    setTenantsLocal(val);
    if (setSharedTenants) setSharedTenants(val);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0f1a14", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: "#0f1a14", borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>G&I Holdings</div>
          <div style={{ fontSize: 10, color: "#4caf7d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", marginTop: 2 }}>Owner Portal</div>
        </div>

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
              {n.key === "tenants" && tenants.length > 0 && (
                <span style={{ marginLeft: "auto", background: "rgba(76,175,125,0.2)", color: "#4caf7d", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>
                  {tenants.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: "0 20px" }}>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Logged in as</div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 10 }}>Gaetano · Owner</div>
            <button onClick={onLogout} style={{
              width: "100%", padding: "8px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: "pointer",
            }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f5f7f5" }}>
        {active === "overview" && <AdminOverview tenants={tenants} setTenants={setTenants} onNavigate={setActive} />}
        {active === "tickets" && <AdminTickets tenants={tenants} sharedTickets={sharedTickets} setSharedTickets={setSharedTickets} supabase={supabase} />}
        {active === "tenants" && <AdminTenants tenants={tenants} setTenants={setTenants} />}
        {active === "documents" && <AdminDocuments tenants={tenants} setTenants={setTenants} />}
        {active === "messages" && <AdminMessages tenants={tenants} supabase={supabase} />}
        {active === "settings" && <AdminSettings supabase={supabase} />}
      </div>
    </div>
  );
}
