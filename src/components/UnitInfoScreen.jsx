export default function UnitInfoScreen({ tenant }) {
  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>Lease details</SectionLabel>
      <InfoCard rows={[
        ["Unit", tenant.unit],
        ["Address", tenant.address],
        ["Lease start", tenant.leaseStart],
        ["Lease end", tenant.leaseEnd],
        ["Monthly rent", `$${tenant.rent.toLocaleString()}`],
        ["Security deposit", `$${tenant.deposit.toLocaleString()} (held)`],
      ]} />

      <SectionLabel style={{ marginTop: 14 }}>Contact your landlord</SectionLabel>
      <InfoCard rows={[
        ["Company", tenant.landlord],
        ["Email", tenant.email],
        ["Emergency line", tenant.emergency],
      ]} />

      <SectionLabel style={{ marginTop: 14 }}>Documents</SectionLabel>
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
        {[
          { icon: "📄", title: "Lease agreement", date: "Jan 1, 2025" },
          { icon: "🔑", title: "Move-in inspection", date: "Jan 1, 2025" },
          { icon: "📜", title: "Community rules", date: "Jan 1, 2025" },
        ].map((doc, i, arr) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 16px",
            borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none",
            cursor: "pointer",
          }}>
            <div style={{ fontSize: 20 }}>{doc.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.title}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Added {doc.date}</div>
            </div>
            <div style={{ fontSize: 12, color: "#4caf7d", fontWeight: 600 }}>View →</div>
          </div>
        ))}
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
}

function InfoCard({ rows }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 8 }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", padding: "11px 16px",
          borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none",
          alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", textAlign: "right" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  );
}
