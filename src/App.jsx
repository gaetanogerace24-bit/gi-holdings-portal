import { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import TicketsScreen from "./components/TicketsScreen";
import PayRentScreen from "./components/PayRentScreen";
import UnitInfoScreen from "./components/UnitInfoScreen";
import SubmitTicketModal from "./components/SubmitTicketModal";
import AdminDashboard from "./components/AdminDashboard";

const INITIAL_TENANTS = [
  {
    id: 1, name: "Gary Thornton", unit: "Single Family",
    address: "510 W Evergreen Ave, Youngstown OH 44511",
    rent: 900, paid: false,
    aprilOwed: 900, aprilLateFee: 285, aprilTotal: 1185,
    amountOwed: 1185, section8: false,
    email: "", phone: "",
    leaseStart: "", leaseEnd: "",
    notes: "April rent unpaid — $900 rent + $285 late fees = $1,185 total owed.",
    landlord: "G&I Holdings LLC",
    emergency: "(330) 969-6464",
    contactEmail: "tenants@giholdings.com",
    deposit: 850,
    documents: [],
  },
  {
    id: 2, name: "Angelisa Pate", unit: "Single Family",
    address: "3646 Beechwood Pl, Youngstown OH 44502",
    rent: 1275, paid: false, section8: true,
    section8Amount: 1014, tenantPortion: 261, housingOwedBack: 1014,
    email: "", phone: "", leaseStart: "", leaseEnd: "",
    notes: "⚠️ Housing authority owes $1,014 for APRIL (unpaid). May check expected May 1st. Angelisa's portion: $261/mo.",
    landlord: "G&I Holdings LLC",
    emergency: "(330) 969-6464",
    contactEmail: "tenants@giholdings.com",
    deposit: 1275,
    documents: [],
  },
  {
    id: 3, name: "Danielle Russell", unit: "Single Family",
    address: "3138 Idlewood Ave, Youngstown OH 44511",
    rent: 1100, paid: true, paidDate: "Apr 30, 2026", section8: false,
    email: "", phone: "", leaseStart: "", leaseEnd: "", notes: "",
    landlord: "G&I Holdings LLC",
    emergency: "(330) 969-6464",
    contactEmail: "tenants@giholdings.com",
    deposit: 1100,
    documents: [],
  },
];

const ADMIN_EMAIL = "gaetano@giholdings.com";
const ADMIN_PASS = "GIHoldings2026!";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [tenants, setTenants] = useState(INITIAL_TENANTS);
  const [loggedInTenantId, setLoggedInTenantId] = useState(null);

  const currentTenant = tenants.find(t => t.id === loggedInTenantId) || tenants[0];

  const handleLogin = (email, password) => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      setScreen("admin");
    } else {
      // In production: look up tenant by email from Supabase
      // For now, demo login goes to first tenant
      setLoggedInTenantId(1);
      setScreen("portal");
    }
  };

  const handleLogout = () => {
    setScreen("login");
    setActiveTab("tickets");
    setLoggedInTenantId(null);
  };

  // 🔑 Auto-update payment status when tenant pays
  const handlePaymentSuccess = (tenantId) => {
    const paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setTenants(prev => prev.map(t =>
      t.id === tenantId ? { ...t, paid: true, paidDate, amountOwed: 0 } : t
    ));
    setActiveTab("tickets");
  };

  const addTicket = (ticket) => {
    setTickets([{
      id: Date.now(), ...ticket, status: "open",
      tenantId: currentTenant?.id,
      tenantName: currentTenant?.name,
      unit: currentTenant?.unit,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }, ...tickets]);
    setShowModal(false);
  };

  if (screen === "login") return <LoginScreen onLogin={handleLogin} />;

  if (screen === "admin") return (
    <AdminDashboard
      onLogout={handleLogout}
      sharedTenants={tenants}
      setSharedTenants={setTenants}
      sharedTickets={tickets}
      setSharedTickets={setTickets}
    />
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", background: "#f0f2f0" }}>
        <Dashboard tenant={currentTenant} onTabClick={setActiveTab} onLogout={handleLogout} />

        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          {["tickets", "pay", "info"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "13px 8px", fontSize: 13, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              color: activeTab === tab ? "#1b3d2a" : "#9ca3af",
              background: "none", border: "none",
              borderBottom: activeTab === tab ? "2.5px solid #4caf7d" : "2.5px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
            }}>
              {tab === "pay" ? "💳 Pay Rent" : tab === "info" ? "My Unit" : "Tickets"}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "tickets" && (
            <TicketsScreen
              tickets={tickets.filter(t => t.tenantId === currentTenant?.id)}
              onNewTicket={() => setShowModal(true)}
            />
          )}
          {activeTab === "pay" && (
            <PayRentScreen tenant={currentTenant} onPaymentSuccess={handlePaymentSuccess} />
          )}
          {activeTab === "info" && <UnitInfoScreen tenant={currentTenant} />}
        </div>

        {showModal && (
          <SubmitTicketModal onClose={() => setShowModal(false)} onSubmit={addTicket} />
        )}
      </div>
    </div>
  );
}
