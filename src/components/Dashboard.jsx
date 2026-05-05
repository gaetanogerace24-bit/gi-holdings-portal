function fmt(n) {
  const num = Number(n) || 0;
  return num % 1 === 0
    ? "$" + num.toLocaleString()
    : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function calcLateFee(dueDateStr) {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dueDateStr.split("T")[0].split("-");
  if (parts.length !== 3) return 0;
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const feeStart = new Date(due.getFullYear(), due.getMonth(), 5);
  if (today < feeStart) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysAfterFeeStart = Math.floor((today - feeStart) / msPerDay);
  return 35 + daysAfterFeeStart * 10;
}

export default function Dashboard({ tenant, invoices = [], onTabClick, onLogout }) {
  const now = new Date();
  const day = now.getDate();
  const rent = Number(tenant?.rent) || 0;

  // invoices passed in are already filtered to unpaid only by App.jsx
  // so current month disappears naturally after payment — no extra logic needed
  const invoicesWithLive = invoices.map(inv => {
    const liveFee = calcLateFee(inv.due_date);
    const liveTotal = Number(inv.rent || 0) + liveFee;
    const parts = (inv.due_date || "").split("T")[0].split("-");
    const due = parts.length === 3
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      : null;
    const isCurrentMonth = due &&
      due.getMonth() === now.getMonth() &&
      due.getFullYear() === now.getFullYear();
    // Overdue = strictly prior month or earlier, never current month
    const isOverdue = due && !isCurrentMonth && (
      due.getFullYear() < now.getFullYear() ||
      (due.getFullYear() === now.getFullYear() && due.getMonth() < now.getMonth())
    );
    return { ...inv, liveFee, liveTotal, isOverdue, isCurrentMonth };
  });

  // Only overdue + current month shown in summary card
  const visibleInvoices = invoicesWithLive
    .filter(inv => inv.isOverdue || inv.isCurrentMonth)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Total and late fees only from visible invoices
  const displayTotal = visibleInvoices.reduce((sum, inv) => sum + inv.liveTotal, 0);
  const displayLateFees = visibleInvoices.reduce((sum, inv) => sum + inv.liveFee, 0);

  // Fallback if no invoices
  const autoFee = day < 5 ? 0 : 35 + Math.max(0, (day - 4) - 1) * 10;
  const fallbackTotal = tenant?.paid ? 0 : (rent + (tenant?.section8 ? 0 : autoFee));
  const finalTotal = invoices.length > 0 ? displayTotal : fallbackTotal;

  const overdueCount = visibleInvoices.filter(i => i.isOverdue).length;
  const allPaidUp = finalTotal === 0 && invoices.length === 0;

  return (
    <div style={{ background: "linear-gradient(160deg, #1b3d2a 0%, #2d5c42 100%)", padding: "22px 20px 26px" }}>
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
              {allPaidUp ? "All paid up" : "Balance due"}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: "-1.5px" }}>
              {allPaidUp ? "$0" : fmt(finalTotal)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
              {overdueCount > 0
                ? `${overdueCount} overdue · ${tenant?.address?.split(",")[0]}`
                : `Due the 1st · ${tenant?.address?.split(",")[0]}`}
            </div>
          </div>
          {displayLateFees > 0 && (
            <div style={{ background: "rgba(231,76,60,0.2)", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#ff8a80", fontWeight: 600 }}>
              + {fmt(displayLateFees)} late fees
            </div>
          )}
        </div>

        {/* Only show overdue + current month — disappears when paid, reappears next 1st */}
        {visibleInvoices.length > 0 && (
          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
            {visibleInvoices.map(inv => (
              <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: inv.isOverdue ? "#ff8a80" : "rgba(255,255,255,0.6)" }}>
                  {inv.isOverdue ? "⚠️ " : ""}{inv.month}{inv.liveFee > 0 ? ` (incl. ${fmt(inv.liveFee)} late fees)` : ""}
                </span>
                <span style={{ fontWeight: 700, color: inv.isOverdue ? "#ff8a80" : "#fff" }}>{fmt(inv.liveTotal)}</span>
              </div>
            ))}
          </div>
        )}

        {/* All paid up message */}
        {allPaidUp && (
          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            ✅ You're all caught up! Next invoice appears on the 1st.
          </div>
        )}

        <button onClick={() => onTabClick("pay")} style={{ width: "100%", marginTop: 14, padding: "12px", background: "#4caf7d", border: "none", borderRadius: 11, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {allPaidUp ? "Prepay upcoming rent" : "Pay now"}
        </button>
      </div>
    </div>
  );
}
