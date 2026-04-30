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

export default function App() {
  const [screen, setScreen] = useState("login");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggedInTenantId, setLoggedInTenantId] = useState(null);

  const currentTenant = tenants.find(t => t.id === loggedInTenantId) || tenants[0];

  // Load all data from Supabase on startup
  useEffect(() => {
    loadData();
  }, []);

  // Auto-reset paid status on the 1st of each new month
  useEffect(() => {
    if (tenants.length === 0) return;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
    const lastResetKey = "gi_last_reset_month";
    const lastReset = localStorage.getItem(lastResetKey);

    if (lastReset !== currentMonth && now.getDate() === 1) {
      // It's the 1st of a new month!
      // Step 1: Save last month's snapshot to history in Supabase BEFORE resetting
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthName = ["January","February","March","April","May","June","July","August","September","October","November","December"][prevMonth.getMonth()] + " " + prevMonth.getFullYear();
      
      supabase.from("settings").select("value").eq("key", "monthly_snapshots").maybeSingle()
        .then(({ data }) => {
          const existing = data?.value || [];
          const snapshot = {
            month: prevMonthName,
            tenants: tenants.map(t => ({
              id: t.id, name: t.name, address: t.address,
              rent: Number(t.rent) || 0, paid: t.paid,
              section8: t.section8,
              tenant_portion: Number(t.tenant_portion || t.tenantPortion) || 0,
              override_late: Number(t.override_late || t.overrideLate) || 0,
            })),
            lockedAt: now.toISOString(),
          };
          const updated = [snapshot, ...existing.filter(s => s.month !== prevMonthName)];
          supabase.from("settings").upsert({ key: "monthly_snapshots", value: updated, updated_at: now.toISOString() }, { onConflict: "key" });
        });

      // Step 2: Reset current month paid status (keep unpaid balances as override_late)
      const resetTenants = tenants.map(t => {
        // If they didn't pay last month, carry their balance forward as override_late
        const unpaidLate = !t.paid ? (Number(t.override_late || t.overrideLate) || 0) + (Number(t.rent) || 0) : null;
        return {
          ...t,
          paid: false,
          paidDate: null,
          paid_date: null,
          override_late: unpaidLate,
          overrideLate: unpaidLate,
        };
      });

      localStorage.setItem(lastResetKey, currentMonth);
      updateTenants(resetTenants);
    }
  }, [tenants.length]);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: tenantData }, { data: ticketData }] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at"),
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      ]);
      if (tenantData) setTenants(tenantData.map(normalizeTenant));
      if (ticketData) setTickets(ticketData.map(normalizeTicket));
    } catch (e) {
      console.error("Failed to load data:", e);
    }
    setLoading(false);
  }

  // Normalize Supabase snake_case to camelCase
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
    return {
      ...t,
      tenantId: t.tenant_id,
      tenantName: t.tenant_name,
    };
  }

  // Map tenant emails to their accounts
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
      // Find matching tenant by name
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

  const handleLogout = () => {
    setScreen("login");
    setActiveTab("tickets");
    setLoggedInTenantId(null);
  };

  // Update tenant in Supabase + local state
  const updateTenants = async (newTenants) => {
    setTenants(newTenants);
    // Only save tenants with valid UUIDs (36 char with dashes)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const t of newTenants) {
      if (!t.id || !uuidRegex.test(String(t.id))) continue;
      try {
        await supabase.from("tenants").update({
          name: t.name || "",
          email: t.email || "",
          phone: t.phone || "",
          unit: t.unit || "",
          address: t.address || "",
          rent: Number(t.rent) || 0,
          deposit: Number(t.deposit) || 0,
          paid: Boolean(t.paid),
          paid_date: t.paidDate || t.paid_date || null,
          amount_owed: Number(t.amountOwed || t.amount_owed) || 0,
          override_late: (t.overrideLate ?? t.override_late) != null ? Number(t.overrideLate ?? t.override_late) : null,
          section8: Boolean(t.section8),
          section8_amount: Number(t.section8Amount || t.section8_amount) || 0,
          tenant_portion: Number(t.tenantPortion || t.tenant_portion) || 0,
          housing_owed_back: Number(t.housingOwedBack || t.housing_owed_back) || 0,
          lease_start: t.leaseStart || t.lease_start || "",
          lease_end: t.leaseEnd || t.lease_end || "",
          notes: t.notes || "",
          public_note: t.public_note || "",
          documents: t.documents || [],
          emergency: t.emergency || "(330) 969-6464",
          contact_email: t.contactEmail || t.contact_email || "tenants@giholdings.com",
          updated_at: new Date().toISOString(),
        }).eq("id", t.id);
      } catch(e) { console.error("Failed to save tenant:", t.name, e); }
    }
  };

  // Update tickets in Supabase + local state
  const updateTickets = async (newTickets) => {
    setTickets(newTickets);
  };

  // Auto-mark tenant paid in Supabase
  const handlePaymentSuccess = async (tenantId) => {
    const paidDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const updated = tenants.map(t =>
      t.id === tenantId ? { ...t, paid: true, paidDate, amountOwed: 0, overrideLate: null } : t
    );
    setTenants(updated);
    await supabase.from("tenants").update({
      paid: true,
      paid_date: paidDate,
      amount_owed: 0,
      override_late: null,
      updated_at: new Date().toISOString(),
    }).eq("id", tenantId);
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
      setSharedTenants={updateTenants}
      sharedTickets={tickets}
      setSharedTickets={updateTickets}
      supabase={supabase}
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
              tickets={tickets.filter(t => t.tenantId === currentTenant?.id || t.tenant_id === currentTenant?.id)}
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
