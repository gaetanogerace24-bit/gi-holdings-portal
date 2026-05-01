export default function Dashboard({ tenant, invoices = [], onTabClick, onLogout }) {
  function calcLateFee(dayOfMonth) {
    if (dayOfMonth < 5) return 0;
    const daysLate = dayOfMonth - 4;
    return 35 + Math.max(0, daysLate - 1) * 10;
  }

  const now = new Date();
  const dayOfMonth = now.getDate();
  const rent = Number(tenant?.rent) || 0;

  // Total balance = sum of all unpaid invoices
  const totalBalance = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const hasInvoices = invoices.length > 0;

  // Fallback if no invoices yet
  const overrideTotal = (tenant?.overrideLate ?? tenant?.override_late) != null
    ? Number(tenant?.overrideLate ?? tenant?.override_late)
    : null;
  const autoFee = calcLateFee(dayOfMonth);
  const lateFee = tenant?.section8 ? 0 : (overrideTotal != null ? overrideTotal - rent : autoFee);
  const fallbackTotal = overrideTotal ?? (rent + lateFee);

  const displayTotal = hasInvoices ? totalBalance : (tenant?.paid ? 0 : fallbackTotal);
  const totalLateFees = hasInvoices
    ? invoices.reduce((sum, inv) => sum + (Number(inv.late_fee) || 0), 0)
    : lateFee;
  const hasLateFee = totalLateFees > 0;

  return (
    <div style={{ background: "linear-gradient(160deg, #1b3d2a 0%, #2d5c42 100%)", padding: "22px 20px 26px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: "#fff", fontWeight: 600 }}>G&I Holdings</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1, letterSpacing: "0.5px" }}>TENANT PORTAL</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(76,175,125,0.3)", border: "2px solid rgba(76,175,125,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#7de8a8" }}>
            {tenant?.name?.split(" ").map(n => n[0]).join("")}
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>Welcome back,</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px", marginBottom: 16 }}>{tenant?.name}</div>

      <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
              {!hasInvoices && tenant?.paid ? "All paid up" : "Total balance due"}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: "-1.5px" }}>${displayTotal.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
              {invoices.length > 1 ? `${invoices.length} open invoices` : `Due the 1st · ${tenant?.unit || tenant?.address?.split(",")[0]}`}
            </div>
          </div>
          {hasLateFee && (
            <div style={{ background: "rgba(231,76,60,0.2)", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#ff8a80", fontWeight: 600 }}>
              + ${totalLateFees} late fees
            </div>
          )}
        </div>

        {invoices.length > 1 && (
          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
            {invoices.map(inv => (
              <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                <span>{inv.month}</span>
                <span style={{ fontWeight: 600, color: "#fff" }}>${Number(inv.total).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => onTabClick("pay")} style={{ width: "100%", marginTop: 14, padding: "12px", background: "#4caf7d", border: "none", borderRadius: 11, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {!hasInvoices && tenant?.paid ? "Prepay upcoming rent" : "Pay now"}
        </button>
      </div>
    </div>
  );
}
