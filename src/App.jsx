import { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import TicketsScreen from "./components/TicketsScreen";
import PayRentScreen from "./components/PayRentScreen";
import UnitInfoScreen from "./components/UnitInfoScreen";
import SubmitTicketModal from "./components/SubmitTicketModal";
import AdminDashboard from "./components/AdminDashboard";

const MOCK_TENANT = {
  name: "Marcus Johnson",
  unit: "Apt 3A",
  address: "824 Elmwood Ave, Baltimore MD 21201",
  rent: 1100,
  lateFee: 0,
  dueDate: "May 1, 2026",
  leaseStart: "Jan 1, 2025",
  leaseEnd: "Dec 31, 2025",
  deposit: 1100,
  landlord: "G&I Holdings LLC",
  email: "tenants@giholdings.com",
  emergency: "(410) 555-0144",
};

const MOCK_TICKETS = [
  { id: 1001, title: "AC unit not cooling", category: "HVAC", urgency: "high", status: "open", date: "Apr 26, 2026" },
  { id: 1002, title: "Bathroom faucet dripping", category: "Plumbing", urgency: "medium", status: "in-progress", date: "Apr 19, 2026" },
  { id: 1003, title: "Front door lock stiff", category: "General", urgency: "low", status: "resolved", date: "Apr 10, 2026" },
  { id: 1004, title: "Smoke detector battery", category: "Electrical", urgency: "medium", status: "resolved", date: "Mar 28, 2026" },
];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState(MOCK_TICKETS);

  // Admin credentials — change these to your real ones!
  const ADMIN_EMAIL = "gaetano@giholdings.com";
  const ADMIN_PASS = "GIHoldings2026!";

  const handleLogin = (email, password) => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      setScreen("admin");
    } else {
      setScreen("portal");
    }
  };
  const handleLogout = () => setScreen("login");

  const addTicket = (ticket) => {
    setTickets([{ id: Date.now(), ...ticket, status: "open", date: "Apr 29, 2026" }, ...tickets]);
    setShowModal(false);
  };

  if (screen === "login") return <LoginScreen onLogin={handleLogin} />;
  if (screen === "admin") return <AdminDashboard onLogout={handleLogout} />;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", background: "#f0f2f0" }}>
        <Dashboard tenant={MOCK_TENANT} onTabClick={setActiveTab} onLogout={handleLogout} />

        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          {["tickets", "pay", "info"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "13px 8px", fontSize: 13, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: activeTab === tab ? "#1b3d2a" : "#9ca3af",
                background: "none", border: "none",
                borderBottom: activeTab === tab ? "2.5px solid #4caf7d" : "2.5px solid transparent",
                cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
              }}
            >
              {tab === "pay" ? "Pay Rent" : tab === "info" ? "My Unit" : "Tickets"}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "tickets" && (
            <TicketsScreen tickets={tickets} onNewTicket={() => setShowModal(true)} />
          )}
          {activeTab === "pay" && <PayRentScreen tenant={MOCK_TENANT} />}
          {activeTab === "info" && <UnitInfoScreen tenant={MOCK_TENANT} />}
        </div>

        {showModal && (
          <SubmitTicketModal onClose={() => setShowModal(false)} onSubmit={addTicket} />
        )}
      </div>
    </div>
  );
}
