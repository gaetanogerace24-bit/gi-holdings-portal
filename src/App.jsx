import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import TicketsScreen from "./components/TicketsScreen";
import PayRentScreen from "./components/PayRentScreen";
import UnitInfoScreen from "./components/UnitInfoScreen";
import SubmitTicketModal from "./components/SubmitTicketModal";
import AdminDashboard from "./components/AdminDashboard";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "gaetano@giholdings.com";
const ADMIN_PASS = "GIHoldings2026!";
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function App() {
  const [screen, setScreen] = useState("login");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggedInTenantId, setLoggedInTenantId] = useState(null);

  const currentTenant = tenants.find(t => t.id === loggedInTenantId) || null;
  const currentTenantInvoices = invoices.filter(inv => inv.tenant_id === currentTenant?.id && !inv.paid);

  useEffect(() => { loadData(); }, []);

  // Auto-create current month invoices and update late fees on load
  useEffect(() => {
    if (tenants.length === 0) return;
    createMissingInvoices();
    updateLateFees();
  }, [tenants.length]);

  async function createMissingInvoices() {
    const now = new Date();
    const monthName = MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
    const monthNum = now.getMonth() + 1;
    const year = now.getFullYear();

    for (const tenant of tenants) {
      if (tenant.section8) continue;
      const exists = invoices.find(inv => inv.tenant_id === tenant.id && inv.month === monthName);
      if (exists) continue;
      const { data } = await supabase.from("invoices").insert({
        tenant_id: tenant.id,
        month: monthName,
        year,
        month_num: monthNum,
        rent: Number(tenant.rent) || 0,
        late_fee: 0,
        total: Number(tenant.rent) || 0,
        paid: false,
        due_date: `${year}-${String(monthNum).padStart(2,'0')}-01`,
      }).select().single();
      if (data) setInvoices(prev => [...prev, data]);
    }
  }

  async function updateLateFees() {
    // Update late fees on all unpaid invoices based on due date
    const now = new Date();
    const unpaid = invoices.filter(inv => !inv.paid);

    for (const inv of unpaid) {
      const dueDate = new Date(inv.due_date || `${inv.year}-${String(inv.month_num).padStart(2,'0')}-01`);
      const gracePeriodEnd = new Date(dueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 4); // grace through 4th

      if (now <= gracePeriodEnd) continue; // still in grace period

      // Days late = days since the 5th of due month
      const feeStartDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 5);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysLate = Math.floor((now - feeStartDate) / msPerDay) + 1;
      if (daysLate < 1) continue;

      const lateFee = 35 + Math.max(0, daysLate - 1) * 10;
      const rent = Number(inv.rent) || 0;
      const total = rent + lateFee;

      if (lateFee !== Number(inv.late_fee)) {
        await supabase.from("invoices").update({
          late_fee: lateFee,
          total,
          updated_at: new Date().toISOString(),
        }).eq("id", inv.id);
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, late_fee: lateFee, total } : i));
      }
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: tenantData }, { data: ticketData }, { data: invoiceData }] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at"),
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      ]);
      if (tenantData) setTenants(tenantData.map(normalizeTenant));
      if (ticketData) setTickets(ticketData.map(normalizeTicket));
      if (invoiceData) setInvoices(invoiceData);
    } catch (e) { console.error("Failed to load:", e); }
    setLoading(false);
  }

  function normalizeTenant(t) {
    return {
      ...t,
      paidDate: t.paid_date,
      amountOwed: t.amount_owed,
      overrideLate: t.override_late,
      section8Amount: t.section8_amount,
      tenantPortion: t.tenant_portion,
      housingOwedBack: t.housing_owed_back,
      leaseStart: t.lease_start,
      leaseEnd: t.lease_end,
      contactEmail: t.contact_email,
      documents: t.documents || [],
    };
  }

  function normalizeTicket(t) {
    return { ...t, tenantId: t.tenant_id, tenantName: t.tenant_name };
  }

  const TENANT_EMAILS = {
    "gthorntonjr51@gmail.com": "Gary Thornton",
    "apate636@icloud.com": "Angelisa Pate",
    "timmylapearl92@gmail.com": "Danielle Russell",
  };

  const handleLogin = (email, password) => {
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
      setScreen("admin");
    } else if (TENANT_EMAILS[lowerEmail]) {
      const tenantName = TENANT_EMAILS[lowerEmail];
      const matchedTenant = tenants.find(t => t.name === tenantName);
      if (matchedTenant) {
        setLoggedInTenantId(matchedTenant.id);
        setScreen("portal");
      } else {
        alert("Account found but tenant not set up yet. Contact your landlord.");
      }
    } else {
      alert("Invalid email or password. Please try again.");
    }
  };

  const handleLogout = () => { setScreen("login"); setActiveTab("tickets"); setLoggedInTenantId(null); };

  const handlePaymentSuccess = async (tenantId, invoiceId) => {
    const paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await supabase.from("invoices").update({ paid: true, paid_date: paidDate, updated_at: new Date().toISOString() }).eq("id", invoiceId);
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, paid: true, paid_date: paidDate } : inv));
    const remaining = invoices.filter(inv => inv.tenant_id === tenantId && !inv.paid && inv.id !== invoiceId);
    if (remaining.length === 0) {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, paid: true, paidDate } : t));
      await supabase.from("tenants").update({ paid: true, paid_date: paidDate, updated_at: new Date().toISOString() }).eq("id", tenantId);
    }
    setActiveTab("tickets");
  };

  const addTicket = async (ticket) => {
    const newTicket = {
      tenant_id: currentTenant?.id,
      tenant_name: currentTenant?.name,
      unit: currentTenant?.unit || currentTenant?.address?.split(",")[0],
      title: ticket.title,
      category: ticket.category,
      urgency: ticket.urgency,
      description: ticket.description || "",
      status: "open",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    const { data } = await supabase.from("tickets").insert(newTicket).select().single();
    if (data) setTickets([normalizeTicket(data), ...tickets]);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#1b3d2a", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏡</div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>G&I Holdings</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading your portal...</div>
      </div>
    );
  }

  if (screen === "login") return <LoginScreen onLogin={handleLogin} />;

  if (screen === "admin") return (
    <AdminDashboard
      onLogout={handleLogout}
      sharedTenants={tenants}
      setSharedTenants={setTenants}
      sharedTickets={tickets}
      setSharedTickets={setTickets}
      sharedInvoices={invoices}
      setSharedInvoices={setInvoices}
      supabase={supabase}
    />
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div className="tenant-portal" style={{ position: "relative" }}>
        <Dashboard tenant={currentTenant} invoices={currentTenantInvoices} onTabClick={setActiveTab} onLogout={handleLogout} />
        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          {["tickets", "pay", "info"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "13px 8px", fontSize: 13, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              color: activeTab === tab ? "#1b3d2a" : "#9ca3af",
              background: "none", border: "none",
              borderBottom: activeTab === tab ? "2.5px solid #4caf7d" : "2.5px solid transparent",
              cursor: "pointer",
            }}>
              {tab === "pay" ? "💳 Pay Rent" : tab === "info" ? "My Unit" : "Tickets"}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "tickets" && <TicketsScreen tickets={tickets.filter(t => t.tenantId === currentTenant?.id || t.tenant_id === currentTenant?.id)} onNewTicket={() => setShowModal(true)} />}
          {activeTab === "pay" && <PayRentScreen tenant={currentTenant} invoices={currentTenantInvoices} onPaymentSuccess={handlePaymentSuccess} />}
          {activeTab === "info" && <UnitInfoScreen tenant={currentTenant} />}
        </div>
        {showModal && <SubmitTicketModal onClose={() => setShowModal(false)} onSubmit={addTicket} />}
      </div>
    </div>
  );
}
