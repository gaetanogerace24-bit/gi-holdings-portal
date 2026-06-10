import { useState } from "react";

const CATEGORIES = ["Plumbing", "HVAC / Heat", "Electrical", "Appliance", "Pest control", "General", "Other"];
const URGENCIES = [
  { key: "low", label: "Low", color: "#166534", bg: "#dcfce7", border: "#4ade80" },
  { key: "medium", label: "Medium", color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
  { key: "high", label: "High", color: "#991b1b", bg: "#fee2e2", border: "#f87171" },
];

export default function SubmitTicketModal({ onClose, onSubmit }) {
  const [category, setCategory] = useState("Plumbing");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("low");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      onSubmit({ title, category, description, urgency });
    }, 1200);
  };

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end",
      zIndex: 100,
      fontFamily: "'DM Sans', sans-serif",
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", width: "100%", borderRadius: "22px 22px 0 0",
        padding: "8px 20px 32px", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 2, margin: "12px auto 20px" }} />

        {submitted ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1b3d2a" }}>Maintenance request submitted!</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>We'll be in touch soon.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 20, color: "#1a1a1a" }}>New Maintenance Request</div>

            <Label>Issue title</Label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Brief description of the problem"
              style={inputStyle}
            />

            <Label>Category</Label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <Label>Urgency level</Label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {URGENCIES.map(u => (
                <button key={u.key} onClick={() => setUrgency(u.key)} style={{
                  flex: 1, padding: "9px 4px", borderRadius: 9,
                  border: urgency === u.key ? `2px solid ${u.border}` : "1.5px solid #e5e7eb",
                  background: urgency === u.key ? u.bg : "#fff",
                  color: urgency === u.key ? u.color : "#6b7280",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {u.label}
                </button>
              ))}
            </div>

            <Label>Description <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></Label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Give us as much detail as possible — when did it start, how bad is it..."
              rows={4}
              style={{ ...inputStyle, resize: "none", lineHeight: "1.5" }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "12px", border: "1.5px solid #e5e7eb", borderRadius: 12,
                background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                fontWeight: 500, color: "#6b7280", cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleSubmit} style={{
                flex: 2, padding: "12px", border: "none", borderRadius: 12,
                background: title.trim() ? "#1b3d2a" : "#d1d5db",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                fontWeight: 700, color: "#fff", cursor: title.trim() ? "pointer" : "not-allowed",
              }}>Submit Request</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#6b7280", marginBottom: 6 }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 13px", borderRadius: 11, fontSize: 14,
  border: "1.5px solid #e5e7eb", outline: "none",
  fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a",
  marginBottom: 14, boxSizing: "border-box", display: "block",
};
