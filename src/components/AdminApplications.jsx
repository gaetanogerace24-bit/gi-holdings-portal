import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const LABELS = {
  // Personal Info
  full_name: "Full Name",
  dob: "Date of Birth",
  email: "Email",
  phone: "Phone",
  current_address: "Current Address",
  time_at_address: "Time at Current Address",
  current_rent: "Current Monthly Rent/Mortgage",
  current_landlord_name: "Current Landlord Name",
  current_landlord_phone: "Current Landlord Phone",
  reason_leaving: "Reason for Leaving",
  // Section 8
  section8: "Section 8 / Housing Voucher?",
  section8_bedrooms: "Voucher Bedroom Size",
  section8_authority: "Housing Authority",
  section8_active: "Voucher Currently Active?",
  // Move-In
  move_in_date: "Desired Move-In Date",
  move_in_flexible: "Flexible on Move-In Date?",
  move_in_earliest: "Earliest Move-In Date",
  move_in_latest: "Latest Move-In Date",
  lease_length: "Desired Lease Length",
  // Employment & Income
  employment_status: "Employment Status",
  employer: "Employer",
  monthly_income: "Monthly Gross Income",
  credit_score: "Credit Score Range",
  bankruptcy: "Ever Claimed Bankruptcy?",
  // Occupants
  occupants: "Number of Occupants",
  occupant_names: "Names & Ages of All Occupants",
  // Lifestyle
  pets: "Pets",
  smoke: "Smoker?",
  num_vehicles: "Number of Vehicles",
  license_plate: "License Plate Number(s)",
  home_business: "Home-Based Business?",
  // Background
  eviction: "Ever Evicted?",
  eviction_explain: "Eviction Explanation",
  broken_lease: "Ever Broken a Lease Early?",
  broken_lease_explain: "Broken Lease Explanation",
  felony: "Felony Conviction?",
  felony_explain: "Felony Explanation",
  // ID
  gov_id_type: "Government ID Type",
  // References
  reference1_name: "Reference #1 Name",
  reference1_phone: "Reference #1 Phone",
  reference2_name: "Reference #2 Name",
  reference2_phone: "Reference #2 Phone",
  // Additional
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

  async function clearDecision(id) {
    await (sb || supabase).from("applications").update({ decision: null, reviewed: false }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, decision: null, reviewed: false } : a));
    setSelected(null);
  }

  async function setDecision(id, decision) {
    await (sb || supabase).from("applications").update({ decision, reviewed: true }).eq("id", id);
    setApps(prev => prev.map(a => a.id === id ? { ...a, decision, reviewed: true } : a));
    setSelected(prev => prev?.id === id ? { ...prev, decision, reviewed: true } : prev);
  }

  const filtered = apps.filter(a => {
    if (filter === "all") return !a.reviewed;
    if (filter === "reviewed") return a.reviewed && !a.decision;
    if (filter === "accepted") return a.decision === "accepted" && a.reviewed;
    if (filter === "denied") return a.decision === "denied" && a.reviewed;
    return true;
  });

  const newCount = apps.filter(a => !a.reviewed).length;

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

  function getBadge(app) {
    if (app.decision === "accepted") return { label: "✓ Accepted", bg: "#dcfce7", color: "#166534" };
    if (app.decision === "denied") return { label: "✕ Denied", bg: "#fef2f2", color: "#dc2626" };
    if (app.reviewed) return { label: "Reviewed", bg: "#f3f4f6", color: "#6b7280" };
    return { label: "New", bg: "#dcfce7", color: "#15803d" };
  }

  function getCardBorder(app) {
    if (app.decision === "accepted") return "#bbf7d0";
    if (app.decision === "denied") return "#fecaca";
    if (!app.reviewed) return "#bbf7d0";
    return "#e5e7eb";
  }

  function getAvatar(app) {
    if (app.decision === "denied") return { bg: "#fef2f2", color: "#dc2626" };
    if (!app.reviewed || app.decision === "accepted") return { bg: "#dcfce7", color: "#15803d" };
    return { bg: "#f3f4f6", color: "#6b7280" };
  }

  const TABS = [
    { key: "all", label: "All" },
    { key: "reviewed", label: "Reviewed" },
    { key: "accepted", label: "Accepted" },
    { key: "denied", label: "Denied" },
  ];

  return (
    <div style={{ padding: "28px 32px", fontFamily: "'DM Sans', sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>📋 Applications</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Rental applications submitted through your website</p>
        </div>
        {newCount > 0 && (
          <div style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 20 }}>
            {newCount} new
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none",
            background: filter === t.key ? "#1b3d2a" : "#f3f4f6",
            color: filter === t.key ? "#fff" : "#374151",
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0", fontSize: 14 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0", fontSize: 14 }}>
          {filter === "all" ? "No new applications." : `No ${filter} applications.`}
        </div>
      ) : (
        filtered.map(app => {
          const answers = app.answers || {};
          const badge = getBadge(app);
          const av = getAvatar(app);
          return (
            <div key={app.id}
              style={{ background: "#fff", border: `1px solid ${getCardBorder(app)}`, borderRadius: 12, padding: "16px 20px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
              onClick={() => { setSelected(app); if (!app.reviewed) markReviewed(app.id); }}
            >
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: av.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: av.color }}>
                {initials(answers.full_name || app.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{answers.full_name || app.name || "Unknown"}</p>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{app.property_address || "Unknown property"} · {fmt(app.created_at)}</p>
              </div>
              <div style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, flexShrink: 0, marginRight: 8 }}>{badge.label}</div>

            </div>
          );
        })
      )}

      {selected && (() => {
        const answers = selected.answers || {};
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={() => setSelected(null)}>
            <div style={{ background: "#fff", width: "min(520px, 100vw)", height: "100vh", overflowY: "auto", padding: "0 0 40px", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }} onClick={e => e.stopPropagation()}>
              <div style={{ background: "#1b3d2a", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
                <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }} onClick={() => setSelected(null)}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{answers.full_name || "Application"}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2 }}>{selected.property_address || "Unknown property"} · {new Date(selected.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {selected.decision !== "accepted" && (
                    <button onClick={() => setDecision(selected.id, "accepted")}
                      style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#1b3d2a", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                      ✓ Accept
                    </button>
                  )}
                  {selected.decision !== "denied" && (
                    <button onClick={() => setDecision(selected.id, "denied")}
                      style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                      ✕ Deny
                    </button>
                  )}
                  {selected.decision && (
                    <button onClick={() => clearDecision(selected.id)}
                      style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid #bfdbfe", color: "#1d4ed8", background: "#eff6ff", cursor: "pointer" }}>
                      Clear decision
                    </button>
                  )}


                </div>

                {selected.decision && (
                  <div style={{ background: selected.decision === "accepted" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${selected.decision === "accepted" ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: selected.decision === "accepted" ? "#166534" : "#dc2626", marginBottom: 16, fontWeight: 600 }}>
                    {selected.decision === "accepted" ? "✓ This application has been accepted" : "✕ This application has been denied"}
                  </div>
                )}

                {Object.entries(LABELS).map(([key, label]) => (
                  answers[key] ? (
                    <div key={key} style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "10px 0" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", width: 160, flexShrink: 0 }}>{label}</div>
                      <div style={{ fontSize: 13, color: "#1a1a1a", flex: 1 }}>{answers[key]}</div>
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
