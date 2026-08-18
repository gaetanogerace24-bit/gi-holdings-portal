import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const LABELS = {
  full_name: "Full Name", dob: "Date of Birth", email: "Email", phone: "Phone",
  current_address: "Current Address", move_in_date: "Desired Move-In Date",
  employment_status: "Employment Status", employer: "Employer",
  monthly_income: "Monthly Income", occupants: "Number of Occupants",
  pets: "Pets", eviction: "Ever Evicted?", eviction_explain: "Eviction Explanation",
  felony: "Felony Conviction?", felony_explain: "Felony Explanation",
  reference1_name: "Reference #1 Name", reference1_phone: "Reference #1 Phone",
  reference2_name: "Reference #2 Name", reference2_phone: "Reference #2 Phone",
  additional_info: "Additional Info",
};

export default function AdminApplications({ supabase: sb }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadApps(); }, []);

  async function loadApps() {
    setLoading(true);
    const { data } = await (sb || supabase)
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApps(data || []);
    setLoading(false);
  }

  async function markReviewed(id) {
    await (sb || supabase).from("applications").update({ reviewed: true }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, reviewed: true } : a));
    setSelected(prev => prev?.id === id ? { ...prev, reviewed: true } : prev);
  }

  async function markUnreviewed(id, e) {
    e.stopPropagation();
    await (sb || supabase).from("applications").update({ reviewed: false }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, reviewed: false } : a));
    setSelected(prev => prev?.id === id ? { ...prev, reviewed: false } : prev);
  }

  async function archiveApp(id, e) {
    e.stopPropagation();
    await (sb || supabase).from("applications").update({ archived: true }).eq("id", id);
    setApps(prev => prev.filter(a => a.id !== id));
    setSelected(prev => prev?.id === id ? null : prev);
  }

  const filtered = apps.filter(a => {
    if (filter === "reviewed") return a.reviewed && !a.archived;
    return !a.archived;
  });

  const newCount = apps.filter(a => !a.reviewed && !a.archived).length;

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function fmt(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  }

  const s = {
    page: { padding: "28px 32px", fontFamily: "'DM Sans', sans-serif", maxWidth: 900, margin: "0 auto" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    title: { fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 },
    sub: { fontSize: 13, color: "#6b7280", marginTop: 4 },
    filters: { display: "flex", gap: 8, marginBottom: 20 },
    pill: (active) => ({
      padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none",
      background: active ? "#1b3d2a" : "#f3f4f6", color: active ? "#fff" : "#374151",
    }),
    card: (isNew) => ({
      background: "#fff", border: `1px solid ${isNew ? "#bbf7d0" : "#e5e7eb"}`,
      borderRadius: 12, padding: "16px 20px", marginBottom: 10, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 14,
    }),
    avatar: (isNew) => ({
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
      background: isNew ? "#dcfce7" : "#f3f4f6",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 15, fontWeight: 700, color: isNew ? "#15803d" : "#6b7280",
    }),
    name: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0 },
    meta: { fontSize: 12, color: "#6b7280", marginTop: 3 },
    newBadge: { background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, flexShrink: 0 },
    reviewedBadge: { background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, flexShrink: 0, border: "1px solid #e5e7eb" },
    archBtn: { marginLeft: 8, background: "none", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", flexShrink: 0 },
    empty: { textAlign: "center", color: "#9ca3af", padding: "60px 0", fontSize: 14 },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" },
    sheet: { background: "#fff", width: "min(520px, 100vw)", height: "100vh", overflowY: "auto", padding: "0 0 40px", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" },
    sheetHeader: { background: "#1b3d2a", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 },
    closeBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 },
    sheetTitle: { color: "#fff", fontWeight: 700, fontSize: 16 },
    sheetSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2 },
    sheetBody: { padding: "24px" },
    fieldRow: { display: "flex", borderBottom: "1px solid #f3f4f6", padding: "10px 0" },
    fieldLabel: { fontSize: 13, fontWeight: 600, color: "#6b7280", width: 160, flexShrink: 0 },
    fieldVal: { fontSize: 13, color: "#1a1a1a", flex: 1 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>📋 Applications</h1>
          <p style={s.sub}>Rental applications submitted through your website</p>
        </div>
        {newCount > 0 && (
          <div style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 20 }}>
            {newCount} new
          </div>
        )}
      </div>

      <div style={s.filters}>
        {[["all", "All"], ["reviewed", "Reviewed"]].map(([val, label]) => (
          <button key={val} style={s.pill(filter === val)} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No applications yet. They'll show up here when someone applies.</div>
      ) : (
        filtered.map(app => {
          const isNew = !app.reviewed;
          const answers = app.answers || {};
          return (
            <div key={app.id} style={s.card(isNew)} onClick={() => { setSelected(app); if (isNew) markReviewed(app.id); }}>
              <div style={s.avatar(isNew)}>{initials(answers.full_name || app.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={s.name}>{answers.full_name || app.name || "Unknown"}</p>
                <p style={s.meta}>{app.property_address || "Unknown property"} · {fmt(app.created_at)}</p>
              </div>
              {isNew ? (
                <div style={s.newBadge}>New</div>
              ) : (
                <div style={s.reviewedBadge}>Reviewed</div>
              )}
              <button style={s.archBtn} onClick={(e) => archiveApp(app.id, e)}>Archive</button>
            </div>
          );
        })
      )}

      {selected && (() => {
        const answers = selected.answers || {};
        const isNew = !selected.reviewed;
        return (
          <div style={s.overlay} onClick={() => setSelected(null)}>
            <div style={s.sheet} onClick={e => e.stopPropagation()}>
              <div style={s.sheetHeader}>
                <button style={s.closeBtn} onClick={() => setSelected(null)}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={s.sheetTitle}>{answers.full_name || "Application"}</div>
                  <div style={s.sheetSub}>{selected.property_address || "Unknown property"} · {new Date(selected.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={s.sheetBody}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#15803d", marginBottom: 16 }}>
                  ✅ Application fee paid via Stripe
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {!isNew && (
                    <button
                      onClick={(e) => markUnreviewed(selected.id, e)}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", cursor: "pointer" }}
                    >
                      Mark unreviewed
                    </button>
                  )}
                  <button
                    onClick={(e) => archiveApp(selected.id, e)}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #fca5a5", color: "#dc2626", background: "none", cursor: "pointer" }}
                  >
                    Archive
                  </button>
                </div>
                {Object.entries(LABELS).map(([key, label]) => (
                  answers[key] ? (
                    <div key={key} style={s.fieldRow}>
                      <div style={s.fieldLabel}>{label}</div>
                      <div style={s.fieldVal}>{answers[key]}</div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
