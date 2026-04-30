import { useState, useEffect } from "react";
import { supabase } from "../supabase";

// These are defined at module level so they're always available
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getCurrentMonthName() {
  const now = new Date();
  return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
}

export default function AdminPayments({ tenants }) {
  const [payments, setPayments] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(0);

  const currentMonthName = getCurrentMonthName();

  useEffect(() => {
    loadPayments();
    loadSnapshots();
  }, []);

  useEffect(() => {
    if (tenants.length > 0) saveSnapshot();
  }, [tenants]);

  async function loadPayments() {
    try {
      const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (data) setPayments(data);
    } catch (e) {}
  }

  async function loadSnapshots() {
    try {
      const { data } = await supabase.from("settings").select("value").eq("key", "monthly_snapshots").maybeSingle();
      if (data?.value) setSnapshots(data.value);
    } catch (e) {}
  }

  async function saveSnapshot() {
    try {
      const { data } = await supabase.from("settings").select("value").eq("key", "monthly_snapshots").maybeSingle();
      const existing = data?.value || [];
      const currentIdx = existing.findIndex(s => s.month === currentMonthName);
      const snapshot = {
        month: currentMonthName,
        tenants: tenants.map(t => ({
          id: t.id,
          name: t.name,
          address: t.address,
          rent: Number(t.rent) || 0,
          paid: t.paid,
          section8: t.section8,
          tenant_portion: Number(t.tenant_portion || t.tenantPortion) || 0,
          override_late: Number(t.override_late || t.overrideLate) || 0,
        })),
      };
      const updated = currentIdx >= 0
        ? existing.map((s, i) => i === currentIdx ? snapshot : s)
        : [snapshot, ...existing];
      await supabase.from("settings").upsert({ key: "monthly_snapshots", value: updated, updated_at: new Date().toISOString() }, { onConflict: "key" });
      setSnapshots(updated);
    } catch (e) {}
  }

  const allMonths = snapshots.length > 0 ? snapshots : [{ month: currentMonthName, tenants }];
  const displayMonth = allMonths[selectedMonth] || allMonths[0];
  const displayTenants = selectedMonth === 0 ? tenants : (displayMonth?.tenants || []);

  const collectedThisMonth = tenants.filter(t => t.paid).reduce((s, t) => {
    return s + (t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0));
  }, 0);

  const outstanding = tenants.filter(t => !t.paid).reduce((s, t) => {
    return s + (Number(t.rent) || 0) + (Number(t.override_late || t.overrideLate) || 0);
  }, 0);

  const allTimePaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || collectedThisMonth;

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Payments</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Track rent payments and manage your Stripe account</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["overview", "history"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 18px", borderRadius: 9, cursor: "pointer",
            background: activeTab === t ? "#1b3d2a" : "#fff",
            color: activeTab === t ? "#fff" : "#6b7280",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            border: activeTab === t ? "none" : "1.5px solid #e5e7eb",
            textTransform: "capitalize",
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            <div style={{ background: "#f0f9f4", borderRadius: 14, padding: "20px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
                Collected — {currentMonthName}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#166534", letterSpacing: "-1px" }}>${collectedThisMonth.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fef2f2", borderRadius: 14, padding: "20px", border: "1px solid #fca5a5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Outstanding Balance</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#991b1b", letterSpacing: "-1px" }}>${outstanding.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Total Collected (All Time)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#1b3d2a", letterSpacing: "-1px" }}>${allTimePaid.toLocaleString()}</div>
            </div>
          </div>

          {/* Month selector */}
          {allMonths.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {allMonths.map((m, i) => (
                <button key={i} onClick={() => setSelectedMonth(i)} style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                  background: selectedMonth === i ? "#1b3d2a" : "#fff",
                  color: selectedMonth === i ? "#fff" : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  border: selectedMonth === i ? "none" : "1.5px solid #e5e7eb",
                }}>{m.month} {i === 0 ? "(Current)" : ""}</button>
              ))}
            </div>
          )}

          {/* Tenant list */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{displayMonth?.month || currentMonthName} — Payment Status</div>
            </div>
            {displayTenants.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No tenants yet</div>
            ) : displayTenants.map((t, i) => {
              const lateFee = Number(t.override_late || t.overrideLate) || 0;
              const base = t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0);
              const total = base + lateFee;
              return (
                <div key={t.id || i} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < displayTenants.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                    {t.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${total.toLocaleString()}</div>
                    {lateFee > 0 && <div style={{ fontSize: 11, color: "#dc2626" }}>incl. ${lateFee} late fee</div>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 7, background: t.paid ? "#dcfce7" : "#fee2e2", color: t.paid ? "#166534" : "#991b1b" }}>
                    {t.paid ? "✓ Paid" : "Unpaid"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 15, fontWeight: 700 }}>Payment history</div>
          {payments.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No payments yet</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Payments made through the portal will appear here</div>
            </div>
          ) : payments.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < payments.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
              <div style={{ fontSize: 24 }}>{p.method === "ach" ? "🏦" : "💳"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.tenant_name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {p.method === "ach" ? "ACH Bank Transfer" : "Credit/Debit Card"}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>+${Number(p.amount).toLocaleString()}</div>
              <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "#dcfce7", color: "#166534" }}>Completed</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
