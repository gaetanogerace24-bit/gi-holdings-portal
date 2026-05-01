export function calcLateFee(paid, referenceDate) {
  if (paid) return 0;
  const now = referenceDate || new Date();
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 5) return 0;
  const daysLate = dayOfMonth - 4;
  return 35 + Math.max(0, daysLate - 1) * 10;
}

export default function AdminOverview({ tenants, setTenants, invoices = [], setInvoices, onNavigate }) {
  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });
  const dayOfMonth = now.getDate();

  // Current month invoices
  const currentMonthInvoices = invoices.filter(inv => inv.month === monthName);
  // All unpaid invoices across all months
  const allUnpaidInvoices = invoices.filter(inv => !inv.paid);

  const totalExpected = tenants.reduce((s, t) => s + t.rent, 0);
  const collected = currentMonthInvoices.filter(inv => inv.paid).reduce((s, inv) => s + Number(inv.rent), 0);
  const outstanding = allUnpaidInvoices.reduce((s, inv) => s + Number(inv.total), 0);
  const housingBackOwed = tenants.reduce((s, t) => s + (t.housingOwedBack || 0), 0);

  const markPaid = (tenantId) => {
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, paid: true, paidDate: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } : t));
  };

  if (tenants.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No tenants yet</div>
        <button onClick={() => onNavigate("tenants")} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>+ Add your first tenant</button>
      </div>
    );
  }

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>
          Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, Gaetano 👋
        </h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Property overview · {monthName} · Today is the {dayOfMonth}{dayOfMonth === 1 ? "st" : dayOfMonth === 2 ? "nd" : dayOfMonth === 3 ? "rd" : "th"}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total expected", value: `$${totalExpected.toLocaleString()}`, sub: `${tenants.length} properties`, color: "#1b3d2a" },
          { label: "Collected", value: `$${collected.toLocaleString()}`, sub: `${currentMonthInvoices.filter(i => i.paid).length} of ${tenants.length} paid`, color: "#166534" },
          { label: "Outstanding", value: `$${outstanding.toLocaleString()}`, sub: `${allUnpaidInvoices.length} unpaid invoice${allUnpaidInvoices.length !== 1 ? "s" : ""}`, color: outstanding > 0 ? "#dc2626" : "#166534" },
          { label: "Housing owes you", value: `$${housingBackOwed.toLocaleString()}`, sub: housingBackOwed > 0 ? "April unpaid" : "All current", color: housingBackOwed > 0 ? "#92400e" : "#6b7280" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Late fee banner */}
      {dayOfMonth < 5 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✅</span><span>Grace period — no late fees until the 5th. <strong>{4 - dayOfMonth} day{4 - dayOfMonth !== 1 ? "s" : ""} remaining.</strong></span>
        </div>
      ) : (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
          <span>⏰</span><span><strong>Late fees active</strong> — +$10/day until paid</span>
        </div>
      )}

      {/* Current month rent status */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{monthName} rent status</div>
          <button onClick={() => onNavigate("messages")} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📣 Send reminders</button>
        </div>

        {tenants.map((t, i) => {
          const tenantCurrentInvoice = currentMonthInvoices.find(inv => inv.tenant_id === t.id);
          const allUnpaidForTenant = allUnpaidInvoices.filter(inv => inv.tenant_id === t.id);
          const hasOldUnpaid = allUnpaidForTenant.some(inv => inv.month !== monthName);

          // Display values for current month
          let displayAmount, displayLateFee, isPaid;
          if (t.section8) {
            displayAmount = t.rent;
            displayLateFee = 0;
            isPaid = t.paid;
          } else if (tenantCurrentInvoice) {
            displayAmount = Number(tenantCurrentInvoice.rent);
            displayLateFee = Number(tenantCurrentInvoice.late_fee) || 0;
            isPaid = tenantCurrentInvoice.paid;
          } else {
            displayAmount = t.rent;
            displayLateFee = 0;
            isPaid = t.paid;
          }

          const isLate = !isPaid && displayLateFee > 0 && !t.section8;

          return (
            <div key={t.id} style={{ padding: "16px 20px", borderBottom: i < tenants.length - 1 ? "1px solid #f9fafb" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.section8 && <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5 }}>SECTION 8</span>}
                    {hasOldUnpaid && <span style={{ fontSize: 10, fontWeight: 700, background: "#fee2e2", color: "#991b1b", padding: "2px 7px", borderRadius: 5 }}>⚠️ PREV MONTH UNPAID</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{t.address}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  {t.section8 ? (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>${t.rent.toLocaleString()} <span style={{ fontWeight: 400, fontSize: 12, color: "#9ca3af" }}>contract</span></div>
                      <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>Housing: ${t.section8Amount} · Tenant: ${t.tenantPortion}</div>
                      {t.housingOwedBack > 0 && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Housing owes ${t.housingOwedBack} (Apr)</div>}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>${displayAmount.toLocaleString()}/mo</div>
                      {isLate && (
                        <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>
                          +${displayLateFee} late fees → Total: ${(displayAmount + displayLateFee).toLocaleString()}
                        </div>
                      )}
                      {isPaid && t.paidDate && <div style={{ fontSize: 11, color: "#6b7280" }}>Paid {t.paidDate}</div>}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, background: isPaid ? "#dcfce7" : t.section8 ? "#dbeafe" : isLate ? "#fee2e2" : "#fef3c7", color: isPaid ? "#166534" : t.section8 ? "#1e40af" : isLate ? "#991b1b" : "#92400e" }}>
                    {isPaid ? "✓ Paid" : t.section8 ? "Pending" : isLate ? "LATE" : "Pending"}
                  </div>
                  {!isPaid && !t.section8 && (
                    <button onClick={() => markPaid(t.id)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "1.5px solid #4caf7d", background: "#fff", color: "#1b3d2a", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                      ✓ Mark paid
                    </button>
                  )}
                </div>
              </div>

              {/* Show previous unpaid invoices */}
              {allUnpaidForTenant.filter(inv => inv.month !== monthName).map(inv => (
                <div key={inv.id} style={{ marginTop: 8, marginLeft: 54, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>📄 {inv.month} unpaid — $35 base + ${Number(inv.late_fee) - 35} accrued ({Math.round((Number(inv.late_fee) - 35) / 10)} days × $10)</span>
                  <span style={{ fontWeight: 800, color: "#991b1b" }}>${Number(inv.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
