import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const DOC_TYPES = ["Lease agreement", "Move-in inspection", "Community rules", "Notice", "Other"];
const DOC_ICONS = {
  "Lease agreement": "📄", "Move-in inspection": "🔑",
  "Community rules": "📜", "Notice": "📋", "Other": "📁",
};

export default function AdminDocuments({ tenants, setTenants, initialTenantId = "" }) {
  // Use initialTenantId if navigated from Tenants tab
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId);

  useEffect(() => {
    if (initialTenantId) setSelectedTenantId(initialTenantId);
  }, [initialTenantId]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Lease agreement", tenantId: "" });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Only show docs for selected tenant
  const allDocs = tenants.flatMap(t =>
    (t.documents || []).map(d => ({ ...d, tenantName: t.name, tenantId: t.id }))
  );
  const filteredDocs = selectedTenantId === ""
    ? []
    : allDocs.filter(d => String(d.tenantId) === String(selectedTenantId));

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      setUploadError(null);
      if (!form.name) setForm(f => ({ ...f, name: dropped.name.replace(".pdf", "") }));
    } else {
      setUploadError("Only PDF files are supported.");
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setUploadError(null);
      if (!form.name) setForm(f => ({ ...f, name: selected.name.replace(".pdf", "") }));
    } else {
      setUploadError("Only PDF files are supported.");
    }
  };

  const handleAdd = async () => {
    if (!form.name || !file || !form.tenantId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const tenant = tenants.find(t => String(t.id) === String(form.tenantId));
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.tenantId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("Documents")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path);
      const url = urlData.publicUrl;
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const newDoc = { id: Date.now(), name: form.name, type: form.type, url, date: today };
      const updatedDocs = [...(tenant.documents || []), newDoc];
      await supabase.from("tenants").update({ documents: updatedDocs, updated_at: new Date().toISOString() }).eq("id", form.tenantId);
      setTenants(tenants.map(t => String(t.id) === String(form.tenantId) ? { ...t, documents: updatedDocs } : t));
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowAdd(false);
        setForm({ name: "", type: "Lease agreement", tenantId: "" });
        setFile(null);
      }, 1500);
    } catch (err) {
      setUploadError("Upload failed: " + (err.message || "Unknown error"));
    }
    setUploading(false);
  };

  const handleRemove = async (tenantId, docId) => {
    if (!window.confirm("Remove this document?")) return;
    const tenant = tenants.find(t => String(t.id) === String(tenantId));
    const updatedDocs = (tenant.documents || []).filter(d => d.id !== docId);
    await supabase.from("tenants").update({ documents: updatedDocs, updated_at: new Date().toISOString() }).eq("id", tenantId);
    setTenants(tenants.map(t => String(t.id) === String(tenantId) ? { ...t, documents: updatedDocs } : t));
  };

  const resetForm = () => {
    setShowAdd(false);
    setForm({ name: "", type: "Lease agreement", tenantId: "" });
    setFile(null);
    setUploadError(null);
    setSaved(false);
  };

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Documents</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Upload leases, inspection reports, and community rules for each tenant</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={greenBtn}>+ Add document</button>
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
            <Label>PDF file</Label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#1b3d2a" : file ? "#4caf7d" : "#d1d5db"}`,
                borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer",
                background: dragging ? "#f0f9f4" : file ? "#f0fdf4" : "#fafafa", transition: "all 0.2s",
              }}>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} style={{ display: "none" }} />
              {file ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Drag & drop your PDF here</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>or click to browse files</div>
                </>
              )}
            </div>
            {uploadError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>⚠️ {uploadError}</div>}
          </div>
          {saved ? (
            <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 600 }}>
              ✅ Document uploaded! Tenant can now view it in their portal.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleAdd} disabled={uploading || !form.name || !file || !form.tenantId} style={{
                ...greenBtn, opacity: (!form.name || !file || !form.tenantId) ? 0.5 : 1,
              }}>
                {uploading ? "Uploading..." : "Upload document"}
              </button>
              <button onClick={resetForm} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Tenant filter — no "All" button */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tenants.map(t => (
          <FilterBtn
            key={t.id}
            label={`${t.name.split(" ")[0]} (${(t.documents || []).length})`}
            active={String(selectedTenantId) === String(t.id)}
            onClick={() => setSelectedTenantId(selectedTenantId === t.id ? "" : t.id)}
          />
        ))}
      </div>

      {/* Document list — empty until tenant selected */}
      {selectedTenantId === "" ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>Select a tenant</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Click a tenant name above to view their documents.</div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No documents yet</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Click "+ Add document" to upload a file for this tenant.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredDocs.map(doc => (
            <div key={doc.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{DOC_ICONS[doc.type] || "📁"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{doc.type} · {doc.tenantName} · Added {doc.date}</div>
              </div>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #4caf7d", background: "#fff", fontSize: 12, color: "#1b3d2a", fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>View →</a>
              <button onClick={() => handleRemove(doc.tenantId, doc.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
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

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const selectSt = { padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a" };
