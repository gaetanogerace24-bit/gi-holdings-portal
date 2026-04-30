import { useState } from "react";

const DOC_TYPES = ["Lease agreement", "Move-in inspection", "Community rules", "Notice", "Other"];
const DOC_ICONS = {
  "Lease agreement": "📄", "Move-in inspection": "🔑",
  "Community rules": "📜", "Notice": "📋", "Other": "📁",
};

export default function AdminDocuments({ tenants, setTenants }) {
  const [selectedTenantId, setSelectedTenantId] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Lease agreement", url: "", tenantId: "" });
  const [saved, setSaved] = useState(false);

  const allDocs = tenants.flatMap(t =>
    (t.documents || []).map(d => ({ ...d, tenantName: t.name, tenantId: t.id }))
  );

  const filteredDocs = selectedTenantId === "all"
    ? allDocs
    : allDocs.filter(d => String(d.tenantId) === String(selectedTenantId));

  const handleAdd = () => {
    if (!form.name || !form.url || !form.tenantId) return;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const newDoc = { id: Date.now(), name: form.name, type: form.type, url: form.url, date: today };
    setTenants(tenants.map(t =>
      String(t.id) === String(form.tenantId)
        ? { ...t, documents: [...(t.documents || []), newDoc] }
        : t
    ));
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowAdd(false); setForm({ name: "", type: "Lease agreement", url: "", tenantId: "" }); }, 1500);
  };

  const handleRemove = (tenantId, docId) => {
    if (!window.confirm("Remove this document?")) return;
    setTenants(tenants.map(t =>
      String(t.id) === String(tenantId)
        ? { ...t, documents: (t.documents || []).filter(d => d.id !== docId) }
        : t
    ));
  };

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Documents</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Upload leases, inspection reports, and community rules for each tenant
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10,
          padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>+ Add document</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "22px", border: "2px solid #4caf7d", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a", marginBottom: 18 }}>📎 Add new document</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <Label>Tenant</Label>
              <select value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })} style={selectSt}>
                <option value="">Select tenant...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Document type</Label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={selectSt}>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Label>Document name</Label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Lease Agreement 2025-2026"
              style={{ ...selectSt, width: "100%", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <Label>Document URL / Link</Label>
            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="Paste a Google Drive, Dropbox, or DocuSign link"
              style={{ ...selectSt, width: "100%", boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>
              💡 Upload to Google Drive, make it shareable, then paste the link here
            </div>
          </div>

          {saved ? (
            <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 600 }}>
              ✅ Document added! Tenant can now view it in their portal.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleAdd} style={{
                background: form.name && form.url && form.tenantId ? "#1b3d2a" : "#d1d5db",
                color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px",
                fontSize: 14, fontWeight: 700, cursor: form.name && form.url && form.tenantId ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif",
              }}>Add document</button>
              <button onClick={() => setShowAdd(false)} style={{
                background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10,
                padding: "12px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Filter by tenant */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <FilterBtn label={`All (${allDocs.length})`} active={selectedTenantId === "all"} onClick={() => setSelectedTenantId("all")} />
        {tenants.map(t => (
          <FilterBtn key={t.id} label={`${t.name.split(" ")[0]} (${(t.documents || []).length})`}
            active={String(selectedTenantId) === String(t.id)}
            onClick={() => setSelectedTenantId(t.id)} />
        ))}
      </div>

      {/* Document list */}
      {filteredDocs.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No documents yet</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Click "Add document" to upload a lease or other file for a tenant.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredDocs.map(doc => (
            <div key={doc.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{DOC_ICONS[doc.type] || "📁"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {doc.type} · {doc.tenantName} · Added {doc.date}
                </div>
              </div>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{
                padding: "7px 14px", borderRadius: 8, border: "1.5px solid #4caf7d",
                background: "#fff", fontSize: 12, color: "#1b3d2a", fontWeight: 600,
                textDecoration: "none", cursor: "pointer",
              }}>View →</a>
              <button onClick={() => handleRemove(doc.tenantId, doc.id)} style={{
                padding: "7px 12px", borderRadius: 8, border: "1.5px solid #fee2e2",
                background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 8, cursor: "pointer",
      border: active ? "none" : "1.5px solid #e5e7eb",
      background: active ? "#1b3d2a" : "#fff",
      color: active ? "#fff" : "#6b7280",
      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
    }}>{label}</button>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const selectSt = {
  padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb",
  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a",
};
