import { useState } from "react";

export default function UnitInfoScreen({ tenant }) {
  const [tab, setTab] = useState("lease"); // lease | documents | all

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sub tabs */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #f3f4f6" }}>
        {[
          { key: "lease", label: "My Unit" },
          { key: "documents", label: "Documents" },
          { key: "all", label: "All Files" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            color: tab === t.key ? "#1b3d2a" : "#9ca3af",
            background: "none", border: "none",
            borderBottom: tab === t.key ? "2px solid #4caf7d" : "2px solid transparent",
            cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "lease" && <LeaseTab tenant={tenant} />}
      {tab === "documents" && <DocumentsTab tenant={tenant} />}
      {tab === "all" && <AllFilesTab tenant={tenant} />}
    </div>
  );
}

function LeaseTab({ tenant }) {
  return (
    <div style={{ padding: 16 }}>
      <SL>Lease details</SL>
      <InfoCard rows={[
        ["Unit type", tenant.unit || "Single Family"],
        ["Address", tenant.address],
        ["Lease start", tenant.leaseStart || "—"],
        ["Lease end", tenant.leaseEnd || "—"],
        ["Monthly rent", `$${(tenant.rent || 0).toLocaleString()}`],
        ["Security deposit", `$${(tenant.deposit || 0).toLocaleString()} (held)`],
      ]} />

      <SL style={{ marginTop: 14 }}>Contact your landlord</SL>
      <InfoCard rows={[
        ["Company", tenant.landlord || "G&I Holdings LLC"],
        ["Email", tenant.contactEmail || "tenants@giholdings.com"],
        ["Emergency line", tenant.emergency || "(330) 969-6464"],
      ]} />

      {tenant.notes && (
        <>
          <SL style={{ marginTop: 14 }}>Notes</SL>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#92400e" }}>
            📝 {tenant.notes}
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

function DocumentsTab({ tenant }) {
  const docs = (tenant.documents || []).filter(d => !d.archived);
  const categories = ["Lease agreement", "Move-in inspection", "Community rules", "Other"];

  if (docs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>No documents yet</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Your landlord will upload your lease and other documents here.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {categories.map(cat => {
        const catDocs = docs.filter(d => d.category === cat);
        if (catDocs.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <SL>{cat}</SL>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
              {catDocs.map((doc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < catDocs.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ fontSize: 20 }}>{docIcon(doc.category)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Added {doc.date}</div>
                  </div>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4caf7d", fontWeight: 600, textDecoration: "none" }}>View →</a>
                  ) : (
                    <span style={{ fontSize: 11, color: "#d1d5db" }}>No file</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ height: 24 }} />
    </div>
  );
}

function AllFilesTab({ tenant }) {
  const docs = tenant.documents || [];
  if (docs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No files uploaded yet</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>All files shared with you will appear here.</div>
      </div>
    );
  }
  return (
    <div style={{ padding: 16 }}>
      <SL>All documents ({docs.length})</SL>
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
        {docs.map((doc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < docs.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ fontSize: 20 }}>{docIcon(doc.category)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{doc.category} · {doc.date}</div>
            </div>
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4caf7d", fontWeight: 600, textDecoration: "none" }}>View →</a>
            ) : (
              <span style={{ fontSize: 11, color: "#d1d5db" }}>No file</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}

function docIcon(cat) {
  if (cat === "Lease agreement") return "📄";
  if (cat === "Move-in inspection") return "🔑";
  if (cat === "Community rules") return "📜";
  return "📋";
}

function InfoCard({ rows }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 8 }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 500, textAlign: "right" }}>{value || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function SL({ children, style = {} }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "#9ca3af", marginBottom: 8, ...style }}>{children}</div>;
}
