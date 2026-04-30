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
  const thisMonth = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + (Number(p.amount) || 0), 0);

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
        {["overview", "history", "stripe"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            background: activeTab === t ? "#1b3d2a" : "#fff",
            color: activeTab === t ? "#fff" : "#6b7280",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            border: activeTab === t ? "none" : "1.5px solid #e5e7eb",
            textTransform: "capitalize",
          }}>{t === "stripe" ? "Stripe Setup" : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Collected this month", value: `$${thisMonth.toLocaleString()}`, color: "#166534", bg: "#f0f9f4", border: "#bbf7d0" },
              { label: "Outstanding balance", value: `$${totalOutstanding.toLocaleString()}`, color: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
              { label: "Total collected (all time)", value: `$${totalCollected.toLocaleString()}`, color: "#1b3d2a", bg: "#fff", border: "#e5e7eb" },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "20px", border: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tenant payment status */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 15, fontWeight: 700 }}>
              Current month status
            </div>
            {tenants.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No tenants yet</div>
            ) : tenants.map((t, i) => {
              const lateFee = Number(t.override_late || t.overrideLate) || 0;
              const base = t.section8 ? (Number(t.tenant_portion || t.tenantPortion) || 0) : (Number(t.rent) || 0);
              const total = base + lateFee;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < tenants.length - 1 ? "1px solid #f9fafb" : "none", gap: 14 }}>
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
                    {t.paid ? `✓ Paid ${t.paid_date || t.paidDate || ""}` : "Unpaid"}
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

          {/* How it works */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>💰 How payments work</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { step: "1", title: "Tenant pays", desc: "Tenant logs into the portal, clicks Pay Rent, enters their card or bank info" },
                { step: "2", title: "Stripe processes it", desc: "Stripe securely charges their card or initiates the ACH bank transfer" },
                { step: "3", title: "Money moves to Stripe", desc: "Funds land in your Stripe account — cards take 1-2 days, ACH takes 3-5 days" },
                { step: "4", title: "Stripe deposits to your bank", desc: "Stripe automatically transfers the money to your linked bank account on your payout schedule" },
                { step: "5", title: "Portal updates", desc: "Tenant status automatically flips to Paid and shows up in your payment history" },
              ].map(s => (
                <div key={s.step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1b3d2a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stripe fees */}
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#92400e" }}>⚠️ Stripe fees (deducted automatically)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { type: "Credit/Debit card", fee: "2.9% + $0.30 per transaction", example: "On $900 rent = ~$26.40 fee, you receive $873.60" },
                { type: "ACH bank transfer", fee: "0.8% per transaction (max $5)", example: "On $900 rent = $5 max fee, you receive $895" },
              ].map((f, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.type}: {f.fee}</div>
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 3 }}>{f.example}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 10 }}>💡 Tip: Encourage tenants to pay via ACH bank transfer — much lower fees than cards!</div>
          </div>

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
