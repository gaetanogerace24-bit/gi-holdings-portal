import { useState } from "react";

const EMERGENCY_TYPES = [
  { key: "burst_pipe", label: "Burst pipe / flood", icon: "🚿" },
  { key: "gas_leak", label: "Gas leak", icon: "🔥" },
  { key: "electrical", label: "Electrical hazard", icon: "⚡" },
  { key: "roof_leak", label: "Roof leak", icon: "🏚" },
  { key: "furnace", label: "Furnace issues", icon: "🌡️" },
  { key: "other", label: "Other emergency", icon: "❗" },
];

export default function SubmitTicketModal({ onClose, onSubmit }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!category || !description.trim()) return;
    setSubmitted(true);
    const selectedType = EMERGENCY_TYPES.find(t => t.key === category);
    setTimeout(() => {
      onSubmit({
        title: selectedType?.label || category,
        category: selectedType?.label || category,
        description,
        urgency: "high",
      });
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
        maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 2, margin: "12px auto 0" }} />

        {submitted ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1b3d2a" }}>Emergency report sent!</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>You will be contacted as soon as possible.</div>
          </div>
        ) : (
          <>
            {/* Red header */}
            <div style={{ background: "#dc2626", padding: "16px 20px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Emergency only</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Report an emergency</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 6, lineHeight: 1.5 }}>
                For immediate safety hazards only. Per your lease, repairs under $300 are your responsibility.
              </div>
            </div>

            <div style={{ padding: "16px 20px 32px" }}>
              {/* Warning banner */}
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "11px 14px", marginBottom: 18, fontSize: 13, color: "#991b1b", lineHeight: 1.5 }}>
                This goes directly to G&I Holdings. Non-emergency requests will not be responded to.
              </div>

              {/* Category tiles */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#6b7280", marginBottom: 10 }}>
                What is the emergency?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                {EMERGENCY_TYPES.map(t => (
                  <button key={t.key} onClick={() => setCategory(t.key)} style={{
                    border: category === t.key ? "2px solid #dc2626" : "1.5px solid #e5e7eb",
                    borderRadius: 10, padding: "10px 12px", background: category === t.key ? "#fef2f2" : "#fff",
                    cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: category === t.key ? "#991b1b" : "#1a1a1a" }}>{t.label}</div>
                  </button>
                ))}
              </div>

              {/* Description */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#6b7280", marginBottom: 6 }}>
                Describe what's happening
              </div>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What happened, when did it start, how bad is it..."
                rows={4}
                style={{ width: "100%", padding: "11px 13px", borderRadius: 11, fontSize: 14, border: "1.5px solid #e5e7eb", outline: "none", fontFamily: "'DM Sans', sans-serif", color: "#1a1a1a", marginBottom: 14, boxSizing: "border-box", display: "block", resize: "none", lineHeight: 1.5 }}
              />

              <button onClick={handleSubmit} disabled={!category || !description.trim()} style={{
                width: "100%", padding: 14, border: "none", borderRadius: 12,
                background: category && description.trim() ? "#dc2626" : "#d1d5db",
                fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                fontWeight: 700, color: "#fff", cursor: category && description.trim() ? "pointer" : "not-allowed",
                marginBottom: 10,
              }}>
                Send emergency report
              </button>

              <button onClick={onClose} style={{
                width: "100%", padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 12,
                background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                fontWeight: 500, color: "#6b7280", cursor: "pointer",
              }}>Cancel</button>

              <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
                You will be contacted as soon as possible
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
