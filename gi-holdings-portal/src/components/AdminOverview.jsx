// LATE FEE RULES:
// Rent due: 1st of every month
// Late fee starts: midnight Friday after the 1st
// $35 first hit, then $10/day until paid

export function calcLateFee(paid) {
  if (paid) return 0;
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now <= due) return 0;
  let friday = new Date(due);
  while (friday.getDay() !== 5) friday.setDate(friday.getDate() + 1);
  friday.setHours(0, 0, 0, 0);
  if (now < friday) return 0;
  const daysAfterFriday = Math.floor((now - friday) / (1000 * 60 * 60 * 24));
  return 35 + (daysAfterFriday * 10);
}

export default function AdminOverview({ tenants, onNavigate }) {
  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  // For Section 8 tenants, total rent = full contract rent
  // For Gary, use amountOwed if set (includes prior late fees)
  const totalExpected = tenants.reduce((s, t) => s + t.rent, 0);
  const collected = tenants.filter(t => t.paid).reduce((s, t) => s + t.rent, 0);
  const outstanding = tenants.filter(t => !t.paid).reduce((s, t) => s + (t.amountOwed || t.rent), 0);
  const housingBackOwed = tenants.reduce((s, t) => s + (t.housingOwedBack || 0), 0);
  const lateFee = calcLateFee(false);
  const lateTenants = tenants.filter(t => !t.paid && lateFee > 0 && !t.section8);

  if (tenants.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No tenants yet</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>Add your tenants to start tracking rent and tickets</div>
        <button onClick={() => onNavigate("tenants")} style={{
          background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 12,
          padding: "14px 32px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>+ Add your first tenant</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>
          Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, Gaetano 👋
        </h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Property overview · {monthName}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total expected", value: `$${totalExpected.toLocaleString()}`, sub: `${tenants.length} properties`, color: "#1b3d2a" },
          { label: "Collected", value: `$${collected.toLocaleString()}`, sub: `${tenants.filter(t => t.paid).length} of ${tenants.length} paid`, color: "#166534" },
          { label: "Outstanding", value: `$${outstanding.toLocaleString()}`, sub: `${tenants.filter(t => !t.paid).length} unpaid`, color: outstanding > 0 ? "#dc2626" : "#166534" },
          { label: "Housing owes you", value: housingBackOwed > 0 ? `$${housingBackOwed.toLocaleString()}` : "$0", sub: housingBackOwed > 0 ? "April unpaid" : "All current", color: housingBackOwed > 0 ? "#92400e" : "#6b7280" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Late fee rule */}
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⏰</span>
        <span><strong>Late fee rules:</strong> Due the 1st · $35 at midnight Friday · then $10/day until paid</span>
      </div>

      {/* Tenant payment table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{monthName} rent status</div>
          <button onClick={() => onNavigate("messages")} style={{
            background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>📣 Send reminders</button>
        </div>

        {tenants.map((t, i) => {
          const fee = t.section8 ? 0 : calcLateFee(t.paid);
          const isLate = !t.paid && fee > 0;
          const displayOwed = t.amountOwed || (t.rent + fee);

          return (
            <div key={t.id} style={{
              padding: "16px 20px",
              borderBottom: i < tenants.length - 1 ? "1px solid #f9fafb" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.section8 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" }}>Section 8</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{t.address}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  {t.section8 ? (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>${t.rent.toLocaleString()} <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>contract</span></div>
                      <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>Housing: ${t.section8Amount} · Tenant: ${t.tenantPortion}</div>
                      {t.housingOwedBack && (
                        <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠️ Housing owes ${t.housingOwedBack} (Apr)</div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>${t.rent.toLocaleString()}/mo</div>
                      {(t.amountOwed && t.amountOwed > t.rent) && (
                        <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>Owes ${t.amountOwed.toLocaleString()} total</div>
                      )}
                      {fee > 0 && !t.amountOwed && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>+${fee} late fee</div>}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, minWidth: 70, textAlign: "center",
                  background: t.paid ? "#dcfce7" : t.section8 ? "#dbeafe" : isLate ? "#fee2e2" : "#fef3c7",
                  color: t.paid ? "#166534" : t.section8 ? "#1e40af" : isLate ? "#991b1b" : "#92400e",
                }}>
                  {t.paid ? "✓ Paid" : t.section8 ? "Pending" : isLate ? "LATE" : "Pending"}
                </div>
              </div>

              {t.notes && (
                <div style={{ marginTop: 10, marginLeft: 54, fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
                  📝 {t.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
