import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import TicketsScreen from "./components/TicketsScreen";
import PayRentScreen from "./components/PayRentScreen";
import UnitInfoScreen from "./components/UnitInfoScreen";
import SubmitTicketModal from "./components/SubmitTicketModal";
import AdminDashboard from "./components/AdminDashboard";
import Dashboard from "./components/Dashboard";
import TenantMessages from "./components/TenantMessages";
import HomePage from "./components/HomePage";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "gaetano@giholdings.com";
const ADMIN_PASS = "GIHoldings2026!";

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
  const [processingCustomInvoices, setProcessingCustomInvoices] = useState([]);
  const [initialPropertyCount, setInitialPropertyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggedInTenantId, setLoggedInTenantId] = useState(null);
  const [defaultPayMode, setDefaultPayMode] = useState("current");
  const [loginError, setLoginError] = useState(null);

  const currentTenant = tenants.find(t => t.id === loggedInTenantId) || null;

  const currentTenantInvoices = invoices
    .filter(inv => inv.tenant_id === currentTenant?.id && !inv.paid && !inv.deleted)
    .map(inv => inv.is_custom
      ? { ...inv, late_fee: 0, total: Number(inv.rent || 0) }
      : inv
    );

  useEffect(() => { loadData(); }, []);

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
    if (session?.screen === "admin") { setScreen("admin"); return; }
    if (session?.screen === "portal" && session.tenantId) {
      const tenant = tenants.find(t => t.id === session.tenantId);
      if (tenant) { setLoggedInTenantId(session.tenantId); setScreen("portal"); return; }
    }
    setScreen("home");
  }, [loading]);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: tenantData }, { data: ticketData }, { data: invoiceData }, { data: customProcessingData }, { data: propertiesData }] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at"),
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("custom_invoices").select("*").eq("paid", false).eq("payment_status", "processing"),
        supabase.from("properties").select("id, status").neq("status", "archived"),
      ]);
      if (tenantData) setTenants(tenantData.map(normalizeTenant));
      if (ticketData) setTickets(ticketData.map(normalizeTicket));
      if (invoiceData) setInvoices(invoiceData);
      if (customProcessingData) setProcessingCustomInvoices(customProcessingData);
      if (propertiesData) setInitialPropertyCount(propertiesData.length);
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
      monthToMonth: t.month_to_month, loginEmail: t.login_email,
    };
  }

  function normalizeTicket(t) {
    return { ...t, tenantId: t.tenant_id, tenantName: t.tenant_name };
  }

  const handleLogin = async (email, password) => {
    const lowerEmail = email.toLowerCase().trim();
    setLoginError(null);
    if (lowerEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
      saveSession("admin", null);
      setScreen("admin");
      return true;
    }
    const matchedTenant = tenants.find(t => (t.login_email || t.email)?.toLowerCase().trim() === lowerEmail);
    if (matchedTenant) {
      if (!matchedTenant.portal_password) {
        setLoginError("Your account doesn't have a password set yet. Contact your landlord.");
        return false;
      }
      if (matchedTenant.portal_password === password) {
        saveSession("portal", matchedTenant.id);
        setLoggedInTenantId(matchedTenant.id);
        setScreen("portal");
        return true;
      } else {
        setLoginError("Incorrect password. Contact your landlord if you need help.");
        return false;
      }
    }
    setLoginError("No account found with that email.");
    return false;
  };

  const handleLogout = () => {
    clearSession();
    setScreen("home");
    setActiveTab("tickets");
    setLoggedInTenantId(null);
    setLoginError(null);
  };

  const handlePaymentSuccess = async (tenantId, invoiceId) => {
    const paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await supabase.from("invoices")
      .update({ paid: true, paid_date: paidDate, updated_at: new Date().toISOString() })
      .eq("id", invoiceId);
    const updatedInvoices = invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, paid: true, paid_date: paidDate } : inv
    );
    setInvoices(updatedInvoices);
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
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (screen === "home") return <HomePage onLoginClick={() => setScreen("login")} />;
  if (screen === "login") return <LoginScreen onLogin={handleLogin} loginError={loginError} />;

  if (screen === "admin") return (
    <AdminDashboard
      onLogout={handleLogout} sharedTenants={tenants} setSharedTenants={setTenants}
      sharedTickets={tickets} setSharedTickets={setTickets}
      sharedInvoices={invoices} setSharedInvoices={setInvoices}
      sharedProcessingCustomInvoices={processingCustomInvoices}
      initialPropertyCount={initialPropertyCount}
      onInvoicesChanged={reloadInvoices}
      supabase={supabase}
    />
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f0f2f0", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div className="tenant-portal" style={{ position: "relative" }}>
        <Dashboard tenant={currentTenant} invoices={currentTenantInvoices} onTabClick={(tab) => {
          if (tab === "pay-prepay") { setActiveTab("pay"); setDefaultPayMode("prepay"); }
          else { setActiveTab(tab); setDefaultPayMode("current"); }
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
              {tab === "pay" ? "💳 Pay Rent" : tab === "info" ? "My Unit" : tab === "messages" ? "💬 Messages" : "Maintenance"}
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
