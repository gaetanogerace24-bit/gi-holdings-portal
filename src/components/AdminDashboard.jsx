import { useState } from "react";
import AdminTickets from "./AdminTickets";
import AdminTenants from "./AdminTenants";
import AdminMessages from "./AdminMessages";
import AdminSettings from "./AdminSettings";
import AdminPayments from "./AdminPayments";
import AdminDocuments from "./AdminDocuments";

const NAV = [
  { key: "payments", icon: "💰", label: "Payments" },
  { key: "tickets", icon: "🎫", label: "Tickets" },
  { key: "tenants", icon: "👥", label: "Tenants" },
  { key: "documents", icon: "📁", label: "Documents" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "settings", icon: "⚙️", label: "Settings" },
];

export default function AdminDashboard({ onLogout, sharedTenants, setSharedTenants, sharedTickets, setSharedTickets, sharedInvoices = [], setSharedInvoices, supabase }) {
  const [active, setActive] = useState("payments");
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
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>G&I Holdings</d
