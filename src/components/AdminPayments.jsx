import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AdminPayments({ tenants }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(false);
    try {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setPayments(data);
    } catch (e) {
      console.error("Failed to load payments:", e);
    }
    setLoading(false);
  }

  const totalCollected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // Collected this month = sum of rent for paid tenants
  const thisMonth = tenants.filter(t => t.paid).reduce((s, t) => {
    const base = t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0);
    return s + base;
  }, 0);

  // Total collected all time from payments table + current paid tenants
  const allTimePaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const unpaidTenants = tenants.filter(t => !t.paid);
  const totalOutstanding = unpaidTenants.reduce((s, t) => {
    const rent = Number(t.rent) || 0;
    const late = Number(t.override_late || t.overrideLate) || 0;
    return s + rent + late;
  }, 0);

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Payments</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Track rent payments and manage your Stripe account</div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["overview", "history"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
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
            {[
              { label: `Collected — ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`, value: `$${thisMonthCollected.toLocaleString()}`, color: "#166534", bg: "#f0f9f4", border: "#bbf7d0" },
              { label: "Outstanding balance", value: `$${totalOutstanding.toLocaleString()}`, color: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
              { label: "Total collected (all time)", value: `$${allTimePaid.toLocaleString()}`, color: "#1b3d2a", bg: "#fff", border: "#e5e7eb" },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "20px", border: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Month selector */}
          {allMonths.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {allMonths.map((m, i) => (
                <button key={i} onClick={() => setSelectedMonth(i)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: selectedMonth === i ? "#1b3d2a" : "#fff",
                  color: selectedMonth === i ? "#fff" : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  border: selectedMonth === i ? "none" : "1.5px solid #e5e7eb",
                }}>{m.month} {i === 0 ? "(Current)" : ""}</button>
              ))}
            </div>
          )}

          {/* Tenant payment status */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{displayMonth?.month || currentMonthName} — Payment Status</div>
              {!isCurrentMonth && <div style={{ fontSize: 12, color: "#9ca3af" }}>Historical record</div>}
            </div>
            {displayTenants.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No tenants yet</div>
            ) : displayTenants.map((t, i) => {
              const lateFee = Number(t.override_late || t.overrideLate) || 0;
              const base = t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0);
              const total = base + lateFee;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < displayTenants.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                    {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>${total.toLocaleString()}</div>
                    {lateFee > 0 && <div style={{ fontSize: 11, color: "#dc2626" }}>incl. ${lateFee} late fee</div>}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 7,
                    background: t.paid ? "#dcfce7" : "#fee2e2",
                    color: t.paid ? "#166534" : "#991b1b",
                  }}>
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
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 15, fontWeight: 700 }}>
            Payment history
          </div>
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

      {activeTab === "stripe" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>





          {/* Stripe dashboard link */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🔗 Your Stripe dashboard</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              All your payments, payouts, and bank account settings live in Stripe. You need to complete your account setup to start receiving real money.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "View all payments", url: "https://dashboard.stripe.com/payments", desc: "See every transaction" },
                { label: "Set up bank account (payouts)", url: "https://dashboard.stripe.com/settings/payouts", desc: "Required to receive money — add your bank account here" },
                { label: "View payout schedule", url: "https://dashboard.stripe.com/settings/payouts", desc: "Set daily, weekly, or monthly payouts to your bank" },
                { label: "Go live (disable test mode)", url: "https://dashboard.stripe.com/settings/account", desc: "Currently in test mode — activate to accept real payments" },
              ].map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6", textDecoration: "none", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1b3d2a" }}>{link.label}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{link.desc}</div>
                  </div>
                  <div style={{ fontSize: 16, color: "#4caf7d" }}>→</div>
                </a>
              ))}
            </div>
          </div>

          {/* Go live checklist */}
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#166534" }}>✅ Go live checklist</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Go to dashboard.stripe.com → Activate your account",
                "Add your business info (name, address, SSN last 4)",
                "Add your bank account to receive payouts",
                "Switch from test mode to live mode in Stripe",
                "Update your Stripe keys in Vercel to use live keys (pk_live_... and sk_live_...)",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#166534" }}>
                  <span style={{ fontWeight: 700 }}>{i + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
