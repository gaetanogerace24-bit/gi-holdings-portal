import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const DOC_TYPES = ["Lease agreement", "Move-in inspection", "Community rules", "Notice", "Other"];
const DOC_ICONS = {
  "Lease agreement": "📄", "Move-in inspection": "🔑",
  "Community rules": "📜", "Notice": "📋", "Other": "📁",
};

export default function AdminDocuments({ tenants, setTenants, properties = [], initialTenantId = "" }) {
  const [search, setSearch] = useState("");
  const [expandedProperties, setExpandedProperties] = useState({});
  const [expandedTenants, setExpandedTenants] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", tenantId: "" });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialTenantId) {
      const tenant = tenants.find(t => String(t.id) === String(initialTenantId));
      if (tenant) {
        setExpandedTenants(prev => ({ ...prev, [initialTenantId]: true }));
        const prop = properties.find(p => String(p.tenant_id) === String(initialTenantId));
        if (prop) setExpandedProperties(prev => ({ ...prev, [prop.id]: true }));
      }
    }
  }, [initialTenantId]);

  const assignedTenantIds = new Set(
    (properties || []).map(p => p.tenant_id).filter(Boolean).map(String)
  );

  const propertyRows = (properties || []).map(prop => {
    const tenant = tenants.find(t => String(t.id) === String(prop.tenant_id));
    return { prop, tenant };
  });

  const unassignedTenants = tenants.filter(t => !assignedTenantIds.has(String(t.id)));

  const searchLower = search.toLowerCase();
  const matchesProp = (prop, tenant) => {
    if (!search) return true;
    if (prop.address?.toLowerCase().includes(searchLower)) return true;
    if (tenant?.name?.toLowerCase().includes(searchLower)) return true;
    return false;
  };

  const toggleProperty = (id) => setExpandedProperties(p => ({ ...p, [id]: !p[id] }));
  const toggleTenant = (id) => setExpandedTenants(p => ({ ...p, [id]: !p[id] }));

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped); setUploadError(null);
      if (!form.name) setForm(f => ({ ...f, name: dropped.name.replace(".pdf", "") }));
    } else { setUploadError("Only PDF files are supported."); }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected?.type === "application/pdf") {
      setFile(selected); setUploadError(null);
      if (!form.name) setForm(f => ({ ...f, name: selected.name.replace(".pdf", "") }));
    } else { setUploadError("Only PDF files are supported."); }
  };

  const handleAdd = async () => {
    if (!form.name || !file || !form.tenantId) return;
    setUploading(true); setUploadError(null);
    try {
      const tenant = tenants.find(t => String(t.id) === String(form.tenantId));
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.tenantId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("Documents").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("Documents").getPublicUrl(path);
      const url = urlData.publicUrl;
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const newDoc = { id: Date.now(), name: form.name, url, date: today };
      const updatedDocs = [...(tenant.documents || []), newDoc];
      await supabase.from("tenants").update({ documents: updatedDocs, updated_at: new Date().toISOString() }).eq("id", form.tenantId);
      setTenants(tenants.map(t => String(t.id) === String(form.tenantId) ? { ...t, documents: updatedDocs } : t));
      const prop = properties.find(p => String(p.tenant_id) === String(form.tenantId));
      if (prop) setExpandedProperties(prev => ({ ...prev, [prop.id]: true }));
      setExpandedTenants(prev => ({ ...prev, [form.tenantId]: true }));
      setSaved(true);
      setTimeout(() => {
        setSaved(false); setShowAdd(false);
        setForm({ name: "", tenantId: "" }); setFile(null);
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
    setShowAdd(false); setForm({ name: "", tenantId: "" });
    setFile(null); setUploadError(null); setSaved(false);
  };

  const totalDocs = tenants.reduce((sum, t) => sum + (t.documents || []).length, 0);

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Documents</h1>
        <div style={{ fontSize: 14, color: "#1a1a1a", marginTop: 4 }}>
          {properties.length} propert{properties.length !== 1 ? "ies" : "y"} · {totalDocs} document{totalDocs !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 20 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#9ca3af" }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by tenant name or property address..."
          style={{
            width: "100%", boxSizing: "border-box", padding: "11px 14px 11px 40px",
            borderRadius: 10, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif",
            fontSize: 14, color: "#1a1a1a", outline: "none", background: "#fff",
          }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af" }}>✕</button>
        )}
      </div>

      {showAdd && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "22px", border: "2px solid #4caf7d", marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3d2a", marginBottom: 18 }}>📎 Add new document</div>
          <div style={{ marginBottom: 14 }}>
            <Label>Tenant</Label>
            <select value={form.tenantId} onChange={e => setForm({ ...form, tenantId: e.target.value })} style={{ ...selectSt, width: "100%" }}>
              <option value="">Select tenant...</option>
              {tenants.map(t => {
                const prop = properties.find(p => String(p.tenant_id) === String(t.id));
                return <option key={t.id} value={t.id}>{t.name}{prop ? ` — ${prop.address}` : ""}</option>;
              })}
            </select>
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
                  <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Drag & drop your PDF here</div>
                  <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 4 }}>or click to browse files</div>
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
              <button onClick={handleAdd} disabled={uploading || !form.name || !file || !form.tenantId}
                style={{ ...greenBtn, opacity: (!form.name || !file || !form.tenantId) ? 0.5 : 1 }}>
                {uploading ? "Uploading..." : "Upload document"}
              </button>
              <button onClick={resetForm} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {propertyRows
          .filter(({ prop, tenant }) => matchesProp(prop, tenant))
          .map(({ prop, tenant }) => {
            const isExpanded = expandedProperties[prop.id];
            const docCount = tenant ? (tenant.documents || []).length : 0;
            const isTenantExpanded = tenant ? expandedTenants[tenant.id] : false;

            return (
              <div key={prop.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div
                  onClick={() => toggleProperty(prop.id)}
                  style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    🏠
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{prop.address}</div>
                    <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 2 }}>
                      {tenant ? tenant.name : "No tenant"} · {docCount} document{docCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: prop.status === "vacant" ? "#fef2f2" : "#f0f9f4",
                    color: prop.status === "vacant" ? "#dc2626" : "#166534",
                    border: `1px solid ${prop.status === "vacant" ? "#fecaca" : "#bbf7d0"}`,
                    marginRight: 8,
                  }}>
                    {prop.status === "vacant" ? "○ Vacant" : "✓ Occupied"}
                  </div>
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid #f3f4f6", background: "#fafafa", padding: "12px 16px" }}>
                    {!tenant ? (
                      <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: 13 }}>
                        No tenant assigned to this property.
                      </div>
                    ) : (
                      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                        <div
                          onClick={() => toggleTenant(tenant.id)}
                          style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                            {tenant.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>📁 {tenant.name}</div>
                            <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 1 }}>{docCount} document{docCount !== 1 ? "s" : ""}</div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, tenantId: String(tenant.id) })); setShowAdd(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            style={{ ...outlineBtn, fontSize: 12, color: "#1b3d2a", borderColor: "#4caf7d", marginRight: 8 }}
                          >
                            + Add doc
                          </button>
                          <span style={{ fontSize: 13, color: "#9ca3af" }}>{isTenantExpanded ? "▲" : "▼"}</span>
                        </div>

                        {isTenantExpanded && (
                          <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 16px", background: "#fafafa" }}>
                            {docCount === 0 ? (
                              <div style={{ textAlign: "center", padding: "20px" }}>
                                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 10 }}>No documents yet</div>
                                <button
                                  onClick={() => { setForm(f => ({ ...f, tenantId: String(tenant.id) })); setShowAdd(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                  style={greenBtn}>
                                  + Upload document
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(tenant.documents || []).map(doc => (
                                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #f3f4f6" }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>📄 {doc.name}</div>
                                      <div style={{ fontSize: 11, color: "#1a1a1a", marginTop: 2 }}>Added {doc.date}</div>
                                    </div>
                                    {doc.url && (
                                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                        style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #4caf7d", background: "#fff", fontSize: 12, color: "#1b3d2a", fontWeight: 600, textDecoration: "none" }}>
                                        View →
                                      </a>
                                    )}
                                    <button onClick={() => handleRemove(tenant.id, doc.id)}
                                      style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {unassignedTenants.filter(t => !search || t.name.toLowerCase().includes(searchLower)).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.7px" }}>Unassigned tenants</div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {unassignedTenants
                .filter(t => !search || t.name.toLowerCase().includes(searchLower))
                .map(tenant => {
                  const docCount = (tenant.documents || []).length;
                  const isTenantExpanded = expandedTenants[tenant.id];
                  return (
                    <div key={tenant.id} style={{ background: "#fafafa", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div onClick={() => toggleTenant(tenant.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                          {tenant.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>📁 {tenant.name}</div>
                          <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 1 }}>{docCount} document{docCount !== 1 ? "s" : ""} · No property assigned</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, tenantId: String(tenant.id) })); setShowAdd(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          style={{ ...outlineBtn, fontSize: 12, color: "#1b3d2a", borderColor: "#4caf7d", marginRight: 8 }}>
                          + Add doc
                        </button>
                        <span style={{ fontSize: 13, color: "#9ca3af" }}>{isTenantExpanded ? "▲" : "▼"}</span>
                      </div>
                      {isTenantExpanded && (
                        <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 16px" }}>
                          {docCount === 0 ? (
                            <div style={{ textAlign: "center", padding: "16px", color: "#9ca3af", fontSize: 13 }}>No documents yet.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {(tenant.documents || []).map(doc => (
                                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #f3f4f6" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                                    <div style={{ fontSize: 11, color: "#1a1a1a", marginTop: 2 }}>{doc.type} · Added {doc.date}</div>
                                  </div>
                                  {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #4caf7d", background: "#fff", fontSize: 12, color: "#1b3d2a", fontWeight: 600, textDecoration: "none" }}>View →</a>}
                                  <button onClick={() => handleRemove(tenant.id, doc.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", fontSize: 12, color: "#dc2626", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {propertyRows.filter(({ prop, tenant }) => matchesProp(prop, tenant)).length === 0 &&
          unassignedTenants.filter(t => !search || t.name.toLowerCase().includes(searchLower)).length === 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No results found</div>
            <div style={{ fontSize: 14, color: "#1a1a1a" }}>Try searching by a different name or address.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const outlineBtn = { padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#6b7280" };
const selectSt = { padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a" };
