import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import TicketsScreen from "./components/TicketsScreen";
import PayRentScreen from "./components/PayRentScreen";
import UnitInfoScreen from "./components/UnitInfoScreen";
import SubmitTicketModal from "./components/SubmitTicketModal";
import AdminDashboard from "./components/AdminDashboard";
import Dashboard from "./components/Dashboard";
import TenantMessages from "./components/TenantMessages";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "gaetano@giholdings.com";
const ADMIN_PASS = "GIHoldings2026!";

const TENANT_EMAILS = {
  "gthorntonjr51@gmail.com": "Gary Thornton",
  "apate636@icloud.com": "Angelisa Pate",
  "timmylapearl92@gmail.com": "Danielle Russell",
};

function saveSession(screen, tenantId) {
  try { localStorage.setItem("gi_session", JSON.stringify({ screen, tenantId, ts: Date.now() })); } catch (e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem("gi_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.ts > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem("gi_session"); return null; }
    return s;
  } catch (e) { return null; }
}

function clearSession() {
  try { localStorage.removeItem("gi_session"); } catch (e) {}
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggedInTenantId, setLoggedInTenantId] = useState(null);
  const [defaultPayMode, setDefaultPayMode] = useState("current");

  const currentTenant = tenants.find(t => t.id === loggedInTenantId) || null;
  const currentTenantInvoices = invoices.filter(inv =>
    inv.tenant_id === currentTenant?.id && !inv.paid && !inv.deleted
  );

  useEffect(() => { loadData(); }, []);

  // Real-time subscription — any invoice change from admin instantly updates tenant portal
  useEffect(() => {
    const sub = supabase
      .channel("invoices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        reloadInvoices();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (loading) return;
    const session = loadSession();
    if (session) {
      if (session.screen === "admin") {
        setScreen("admin");
      } else if (session.screen === "portal" && session.tenantId) {
        const tenant = tenants.find(t => t.id === session.tenantId);
        if (tenant) { setLoggedInTenantId(session.tenantId); setScreen("portal"); }
        else { setScreen("login"); }
      } else { setScreen("login"); }
    } else { setScreen("login"); }
  }, [loading]);

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

  async function reloadInvoices() {
    const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (data) setInvoices(data);
  }

  function normalizeTenant(t) {
    return {
      ...t, paidDate: t.paid_date, amountOwed: t.amount_owed, overrideLate: t.override_late,
      section8Amount: t.section8_amount, tenantPortion: t.tenant_portion,
      housingOwedBack: t.housing_owed_back, leaseStart: t.lease_start, leaseEnd: t.lease_end,
      contactEmail: t.contact_email, documents: t.documents || [],
      monthToMonth: t.month_to_month,
    };
  }

  function normalizeTicket(t) {
    return { ...t, tenantId: t.tenant_id, tenantName: t.tenant_name };
  }

  const handleLogin = (email, password) => {
    const lowerEmail = email.toLowerCase().trim();
    if (lowerEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
      saveSession("admin", null); setScreen("admin");
    } else if (TENANT_EMAILS[lowerEmail]) {
      const tenantName = TENANT_EMAILS[lowerEmail];
      const matchedTenant = tenants.find(t => t.name === tenantName);
      if (matchedTenant) {
        saveSession("portal", matchedTenant.id); setLoggedInTenantId(matchedTenant.id); setScreen("portal");
      } else { alert("Account found but tenant not set up yet. Contact your landlord."); return false; }
    } else { return false; }
  };

  const handleLogout = () => { clearSession(); setScreen("login"); setActiveTab("tickets"); setLoggedInTenantId(null); };

  const handlePaymentSuccess = async (tenantId, invoiceId) => {
    const paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // Mark invoice paid in Supabase
    await supabase.from("invoices")
      .update({ paid: true, paid_date: paidDate, updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    // Update local invoices state
    const updatedInvoices = invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, paid: true, paid_date: paidDate } : inv
    );
    setInvoices(updatedInvoices);

    // Use updatedInvoices (not stale invoices) to check if anything still unpaid
    const remaining = updatedInvoices.filter(inv =>
      inv.tenant_id === tenantId && !inv.paid && !inv.deleted
    );

    if (remaining.length === 0) {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, paid: true, paidDate } : t));
      await supabase.from("tenants")
        .update({ paid: true, paid_date: paidDate, updated_at: new Date().toISOString() })
        .eq("id", tenantId);
    }

    setActiveTab("tickets");
  };

  const addTicket = async (ticket) => {
    const newTicket = {
      tenant_id: currentTenant?.id, tenant_name: currentTenant?.name,
      unit: currentTenant?.unit || currentTenant?.address?.split(",")[0],
      title: ticket.title, category: ticket.category, urgency: ticket.urgency,
      description: ticket.description || "", status: "open",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    const { data } = await supabase.from("tickets").insert(newTicket).select().single();
    if (data) setTickets([normalizeTicket(data), ...tickets]);
    setShowModal(false);
  };

  if (screen === "loading" || loading) {
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
      onLogout={handleLogout} sharedTenants={tenants} setSharedTenants={setTenants}
      sharedTickets={tickets} setSharedTickets={setTickets}
      sharedInvoices={invoices} setSharedInvoices={setInvoices}
      onInvoicesChanged={reloadInvoices}
      supabase={supabase}
    />
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div className="tenant-portal" style={{ position: "relative" }}>
        <Dashboard tenant={currentTenant} invoices={currentTenantInvoices} onTabClick={(tab) => {
          if (tab === "pay-prepay") {
            setActiveTab("pay");
            setDefaultPayMode("prepay");
          } else {
            setActiveTab(tab);
            setDefaultPayMode("current");
          }
        }} onLogout={handleLogout} />
        <nav style={{ display: "flex", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          {["tickets", "pay", "info", "messages"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "13px 4px", fontSize: 12, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              color: activeTab === tab ? "#1b3d2a" : "#9ca3af",
              background: "none", border: "none",
              borderBottom: activeTab === tab ? "2.5px solid #4caf7d" : "2.5px solid transparent",
              cursor: "pointer",
            }}>
              {tab === "pay" ? "💳 Pay Rent" : tab === "info" ? "My Unit" : tab === "messages" ? "💬 Messages" : "Tickets"}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "tickets" && <TicketsScreen tickets={tickets.filter(t => t.tenantId === currentTenant?.id || t.tenant_id === currentTenant?.id)} onNewTicket={() => setShowModal(true)} />}
          {activeTab === "pay" && <PayRentScreen tenant={currentTenant} invoices={currentTenantInvoices} onPaymentSuccess={handlePaymentSuccess} defaultPayMode={defaultPayMode} />}
          {activeTab === "info" && <UnitInfoScreen tenant={currentTenant} />}
          {activeTab === "messages" && <TenantMessages tenant={currentTenant} />}
        </div>
        {showModal && <SubmitTicketModal onClose={() => setShowModal(false)} onSubmit={addTicket} />}
      </div>
    </div>
  );
}
