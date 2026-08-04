import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function UnitInfoScreen({ tenant }) {
  const [tab, setTab] = useState("lease");

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #f3f4f6" }}>
        {[
          { key: "lease", label: "My Unit" },
          { key: "documents", label: "Documents" },
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
    </div>
  );
}

function LeaseTab({ tenant }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "portal_settings").single();
      if (data?.value) setSettings(data.value);
    };
    load();
  }, []);

  const contactEmail = settings?.email || tenant?.contact_email || tenant?.contactEmail || "tenants@giholdings.com";
  const contactPhone = settings?.phone || tenant?.emergency || "(330) 969-6464";
  const companyName = settings?.companyName || "G&I Holdings LLC";

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
        ["Company", companyName],
        ["Email", contactEmail],
        ["Emergency line", contactPhone],
      ]} />

      {tenant.public_note && (
        <>
          <SL style={{ marginTop: 14 }}>Message from your landlord</SL>
          <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#166534" }}>
            💬 {tenant.public_note}
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

function DocumentsTab({ tenant }) {
  // Only show docs that the owner has toggled visible
  const docs = (tenant.documents || []).filter(d => d.tenant_visible === true);

  if (docs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>No documents yet</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Your landlord will share your lease and other documents here.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
        {docs.map((doc, i) => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < docs.length - 1 ? "1px solid #f3f4f6" : "none" }}>
            <div style={{ fontSize: 20 }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Added {doc.date}</div>
            </div>
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noreferrer" style={{
                fontSize: 13, color: "#fff", fontWeight: 600, textDecoration: "none",
                background: "#1b3d2a", padding: "6px 14px", borderRadius: 8,
              }}>View →</a>
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
