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
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthName());

  useEffect(() => { loadPayments(); }, []);

  async function loadPayments() {
    try {
      const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (data) setPayments(data);
    } catch (e) {}
  }

  const currentMonthName = getCurrentMonthName();
  const allMonths = [...new Set(invoices.map(inv => inv.month))].sort((a, b) => new Date(b) - new Date(a));
  if (!allMonths.includes(currentMonthName)) allMonths.unshift(currentMonthName);

  const monthInvoices = invoices.filter(inv => inv.month === selectedMonth);
  const allUnpaid = invoices.filter(inv => !inv.paid);
  const outstanding = allUnpaid.reduce((s, inv) => s + Number(inv.total), 0);
  const collected = invoices.filter(inv => inv.paid && inv.month === currentMonthName).reduce((s, inv) => s + Number(inv.rent), 0);
  const allTimePaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) || collected;

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Payments</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Track rent payments and invoices</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["overview", "history"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "8px 18px", borderRadius: 9, cursor: "pointer", background: activeTab === t ? "#1b3d2a" : "#fff", color: activeTab === t ? "#fff" : "#6b7280", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, border: activeTab === t ? "none" : "1.5px solid #e5e7eb" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#f0f9f4", borderRadius: 14, padding: "20px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Collected — {currentMonthName}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#166534" }}>${collected.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fef2f2", borderRadius: 14, padding: "20px", border: "1px solid #fca5a5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Outstanding Balance (All Invoices)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#991b1b" }}>${outstanding.toLocaleString()}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>Total Collected (All Time)</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#1b3d2a" }}>${allTimePaid.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {allMonths.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)} style={{
                padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                background: selectedMonth === m ? "#1b3d2a" : "#fff",
                color: selectedMonth === m ? "#fff" : "#6b7280",
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                border: selectedMonth === m ? "none" : "1.5px solid #e5e7eb",
              }}>{m} {m === currentMonthName ? "(Current)" : ""}</button>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 15, fontWeight: 700 }}>{selectedMonth} — Invoice Status</div>
            {monthInvoices.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No invoices for this month</div>
            ) : monthInvoices.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              if (!tenant) return null;
              const lateFee = Number(inv.late_fee) || 0;
              const daysLate = lateFee > 35 ? Math.round((lateFee - 35) / 10) : 0;
              return (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < monthInvoices.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                    {tenant.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{tenant.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{tenant.address}</div>
                    {lateFee > 0 && (
                      <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                        $35 base + ${daysLate * 10} ({daysLate} days × $10) = ${lateFee} in late fees
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${Number(inv.total).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Rent: ${Number(inv.rent).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 7, background: inv.paid ? "#dcfce7" : lateFee > 0 ? "#fee2e2" : "#fef3c7", color: inv.paid ? "#166534" : lateFee > 0 ? "#991b1b" : "#92400e" }}>
                    {inv.paid ? "✓ Paid" : lateFee > 0 ? "Overdue" : "Upcoming"}
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
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Payments will appear here</div>
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
