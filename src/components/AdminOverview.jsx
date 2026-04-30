import { useState } from "react";

const TENANTS = [
  { name: "Marcus Johnson", unit: "Apt 3A", rent: 1100, paid: true, paidDate: "Apr 28", late: false },
  { name: "Tanya Williams", unit: "Apt 1B", rent: 950, paid: false, paidDate: null, late: true },
  { name: "Derek & Lisa Moore", unit: "Apt 2C", rent: 1250, paid: true, paidDate: "Apr 27", late: false },
  { name: "Sandra Price", unit: "Apt 4A", rent: 875, paid: false, paidDate: null, late: false },
  { name: "James & Rita Chen", unit: "Apt 2B", rent: 1100, paid: true, paidDate: "May 1", late: false },
];

const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const COLLECTED = [3800, 4275, 4275, 3325, 4275, 2050];
const EXPECTED = [4275, 4275, 4275, 4275, 4275, 4275];

export default function AdminOverview() {
  const totalRent = TENANTS.reduce((s, t) => s + t.rent, 0);
  const collected = TENANTS.filter(t => t.paid).reduce((s, t) => s + t.rent, 0);
  const outstanding = totalRent - collected;
  const lateCount = TENANTS.filter(t => t.late).length;
  const maxVal = Math.max(...EXPECTED);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Good evening, Gaetano 👋</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Here's your property overview for May 2026</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total expected", value: `$${totalRent.toLocaleString()}`, sub: "This month", color: "#1b3d2a" },
          { label: "Collected", value: `$${collected.toLocaleString()}`, sub: `${TENANTS.filter(t=>t.paid).length} of ${TENANTS.length} paid`, color: "#166534" },
          { label: "Outstanding", value: `$${outstanding.toLocaleString()}`, sub: `${TENANTS.filter(t=>!t.paid).length} tenants`, color: outstanding > 0 ? "#dc2626" : "#166534" },
          { label: "Late tenants", value: lateCount, sub: "Late fee applies", color: lateCount > 0 ? "#92400e" : "#166534" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 24 }}>
        {/* Bar chart */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rent collection — last 6 months</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>Expected vs collected</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120 }}>
            {MONTHS.map((m, i) => (
              <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
                  <div style={{ flex: 1, background: "#e5e7eb", borderRadius: "4px 4px 0 0", height: `${(EXPECTED[i]/maxVal)*100}%` }} />
                  <div style={{ flex: 1, background: COLLECTED[i] === EXPECTED[i] ? "#4caf7d" : "#f59e0b", borderRadius: "4px 4px 0 0", height: `${(COLLECTED[i]/maxVal)*100}%` }} />
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{m}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#e5e7eb" }} /> Expected
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#4caf7d" }} /> Collected
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} /> Partial
            </div>
          </div>
        </div>

        {/* Donut */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>May collection rate</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>Paid vs outstanding</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" strokeWidth="14" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#4caf7d" strokeWidth="14"
                strokeDasharray={`${(collected/totalRent)*238} 238`}
                strokeDashoffset="59.5" strokeLinecap="round" transform="rotate(-90 50 50)" />
              <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1b3d2a">{Math.round(collected/totalRent*100)}%</text>
              <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#9ca3af">collected</text>
            </svg>
            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Collected</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>${collected.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Outstanding</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626" }}>${outstanding.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment status table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>May rent status</div>
          <button style={{
            background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>Send reminders</button>
        </div>
        {TENANTS.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", padding: "14px 20px",
            borderBottom: i < TENANTS.length - 1 ? "1px solid #f9fafb" : "none",
            gap: 14,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 600, color: "#6b7280", flexShrink: 0,
            }}>
              {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{t.unit}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>${t.rent.toLocaleString()}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
              background: t.paid ? "#dcfce7" : t.late ? "#fee2e2" : "#fef3c7",
              color: t.paid ? "#166534" : t.late ? "#991b1b" : "#92400e",
            }}>
              {t.paid ? `Paid ${t.paidDate}` : t.late ? "Late" : "Pending"}
            </div>
            {!t.paid && (
              <button style={{
                background: "none", border: "1px solid #e5e7eb", borderRadius: 7,
                padding: "5px 10px", fontSize: 11, color: "#6b7280", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>Remind</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
