import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function getCurrentMonthName() {
  const now = new Date();
  return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
}

export default function AdminPayments({ tenants, invoices = [] }) {
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState("current");
  const currentMonthName = getCurrentMonthName();

  useEffect(() => { loadPayments(); }, []);

  async function loadPayments() {
    try {
      const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (data) setPayments(data);
    } catch (e) {}
  }

  const invoiceMonths = [...new Set(invoices.map(inv => inv.month))];
  const allMonths = invoiceMonths.length > 0 ? invoiceMonths : [currentMonthName];
  const displayMonthName = selectedMonth === "current" ? currentMonthName : selectedMonth;
  const monthInvoices = invoices.filter(inv => inv.month === displayMonthName);

  const collectedThisMonth = tenants.filter(t => t.paid).reduce((s, t) => {
    return s + (t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0));
  }, 0);

  const outstanding = invoices.filter(inv => !inv.paid).reduce((s, inv) => s + Number(inv.total), 0) ||
    tenants.filter(t => !t.paid && !t.section8).reduce((s, t) => {
      const ot = (t.override_late || t.overrideLate) ? Number(t.override_late || t.overrideLate) : null;
      return s + (ot ?? Number(t.rent) ?? 0);
    }, 0);

  const allTimePaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || collectedThisMonth;

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Payments</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Track rent payments and invoices</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["overview", "history"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 18px", borderRadius: 9, cursor: "pointer",
            background: activeTab === t ? "#1b3d2a" : "#fff",
            color: activeTab === t ? "#fff" : "#6b7280",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            border: activeTab === t ? "none" : "1.5px solid #e5e7eb", textTransform: "capitalize",
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#f0f9f4", borderRadius: 14, padding: "20px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Collected — {currentMonthName}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#166534" }}>${collectedThisMonth.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fef2f2", borderRadius: 14, padding: "20px", border: "1px solid #fca5a5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Outstanding Balance</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#991b1b" }}>${outstanding.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Total Collected (All Time)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#1b3d2a" }}>${allTimePaid.toLocaleString()}</div>
            </div>
          </div>

          {allMonths.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {allMonths.map((m, i) => (
                <button key={i} onClick={() => setSelectedMonth(i === 0 ? "current" : m)} style={{
                  padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                  background: (selectedMonth === "current" && i === 0) || selectedMonth === m ? "#1b3d2a" : "#fff",
                  color: (selectedMonth === "current" && i === 0) || selectedMonth === m ? "#fff" : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  border: (selectedMonth === "current" && i === 0) || selectedMonth === m ? "none" : "1.5px solid #e5e7eb",
                }}>{m} {i === 0 ? "(Current)" : ""}</button>
              ))}
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{displayMonthName} — Invoice Status</div>
            </div>
            {monthInvoices.length > 0 ? monthInvoices.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              if (!tenant) return null;
              const lateFee = Number(inv.late_fee) || 0;
              return (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < monthInvoices.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                    {tenant.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{tenant.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{tenant.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${Number(inv.total).toLocaleString()}</div>
                    {lateFee > 0 && (
                      <div style={{ fontSize: 11, color: "#dc2626" }}>
                        $35 base + ${lateFee - 35} accrued ({Math.round((lateFee - 35) / 10)} days) = ${lateFee} late fees
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 7, background: inv.paid ? "#dcfce7" : "#fee2e2", color: inv.paid ? "#166534" : "#991b1b" }}>
                    {inv.paid ? "✓ Paid" : "Unpaid"}
                  </div>
                </div>
              );
            }) : tenants.filter(t => !t.section8).map((t, i) => {
              const ot = (t.override_late || t.overrideLate) ? Number(t.override_late || t.overrideLate) : null;
              const total = ot ?? Number(t.rent);
              const lateFee = ot ? ot - Number(t.rent) : 0;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < tenants.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                    {t.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${total.toLocaleString()}</div>
                    {lateFee > 0 && !t.paid && <div style={{ fontSize: 11, color: "#dc2626" }}>incl. ${lateFee} late fee</div>}
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
              <div style={{ fontSize: 24 }}>🏦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.tenant_name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ACH Bank Transfer</div>
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
