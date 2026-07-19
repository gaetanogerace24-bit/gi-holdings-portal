import { useState } from "react";
import AdminOverview from "./AdminOverview";
import AdminTickets from "./AdminTickets";
import AdminTenants from "./AdminTenants";
import AdminMessages from "./AdminMessages";
import AdminSettings from "./AdminSettings";
import AdminPayments from "./AdminPayments";
import AdminDocuments from "./AdminDocuments";
import AdminContractors from "./AdminContractors";

const NAV = [
  { key: "overview", icon: "📊", label: "Overview" },
  { key: "tickets", icon: "🎫", label: "Tickets" },
  { key: "tenants", icon: "👥", label: "Tenants" },
  { key: "documents", icon: "📁", label: "Documents" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "payments", icon: "💰", label: "Payments" },
  { key: "contractors", icon: "🔧", label: "Contractors" },
  { key: "settings", icon: "⚙️", label: "Settings" },
];

export default function AdminDashboard({ onLogout, sharedTenants, setSharedTenants, sharedTickets, setSharedTickets, sharedInvoices = [], setSharedInvoices, supabase }) {
  const [active, setActive] = useState("overview");
  const [tenants, setTenantsLocal] = useState(sharedTenants || []);

  const setTenants = (val) => { setTenantsLocal(val); if (setSharedTenants) setSharedTenants(val); };

  return (
    <div className="admin-layout" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@600&display=swap');
        .admin-layout { display: flex; min-height: 100vh; }
        @media (max-width: 768px) {
          .admin-layout { flex-direction: column; }
          .admin-sidebar { display: none !important; }
          .admin-main { padding-bottom: 75px !important; overflow-y: auto !important; }
          .admin-mobile-nav { display: flex !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-page-content { padding: 14px !important; }
        }
        @media (min-width: 769px) {
          .admin-mobile-nav { display: none !important; }
          .admin-mobile-header { display: none !important; }
          .admin-sidebar { display: flex !important; width: 220px; flex-direction: column; position: sticky; top: 0; height: 100vh; }
        }
      `}</style>

      <div className="admin-sidebar" style={{ background: "#0f1a14", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", padding: "24px 0" }}>
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>G&I Holdings</div>
          <div style={{ fontSize: 10, color: "#4caf7d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", marginTop: 2 }}>Owner Portal</div>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setActive(n.key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", border: "none", cursor: "pointer",
              background: active === n.key ? "rgba(76,175,125,0.12)" : "transparent",
              borderLeft: active === n.key ? "3px solid #4caf7d" : "3px solid transparent",
              color: active === n.key ? "#4caf7d" : "rgba(255,255,255,0.5)",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: active === n.key ? 600 : 400, textAlign: "left",
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
              {n.key === "tenants" && tenants.length > 0 && (
                <span style={{ marginLeft: "auto", background: "rgba(76,175,125,0.2)", color: "#4caf7d", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6 }}>{tenants.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "0 20px" }}>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Logged in as</div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 10 }}>Gaetano · Owner</div>
            <button onClick={onLogout} style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: "pointer" }}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f5f7f5", minHeight: "100vh" }}>
        <div className="admin-mobile-header" style={{ display: "none", background: "#0f1a14", padding: "14px 16px", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: "#fff", fontWeight: 600 }}>G&I Holdings</div>
            <div style={{ fontSize: 9, color: "#4caf7d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Owner Portal</div>
          </div>
          <button onClick={onLogout} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>

        <div className="admin-main" style={{ flex: 1, overflowY: "auto" }}>
          {active === "overview" && <AdminOverview tenants={tenants} setTenants={setTenants} invoices={sharedInvoices} setInvoices={setSharedInvoices} onNavigate={setActive} />}
          {active === "tickets" && <AdminTickets tenants={tenants} sharedTickets={sharedTickets} setSharedTickets={setSharedTickets} supabase={supabase} />}
          {active === "tenants" && <AdminTenants tenants={tenants} setTenants={setTenants} />}
          {active === "documents" && <AdminDocuments tenants={tenants} setTenants={setTenants} />}
          {active === "messages" && <AdminMessages tenants={tenants} supabase={supabase} />}
          {active === "payments" && <AdminPayments tenants={tenants} invoices={sharedInvoices} />}
          {active === "contractors" && <AdminContractors />}
          {active === "settings" && <AdminSettings supabase={supabase} />}
        </div>

        <div className="admin-mobile-nav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f1a14", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 100, padding: "6px 0 16px" }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setActive(n.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 2px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ fontSize: 22 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", color: active === n.key ? "#4caf7d" : "rgba(255,255,255,0.35)" }}>{n.label}</span>
              {active === n.key && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4caf7d" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
