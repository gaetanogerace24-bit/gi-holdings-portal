import { useState } from "react";

const TENANTS = ["All tenants", "Marcus Johnson – Apt 3A", "Tanya Williams – Apt 1B", "Derek Moore – Apt 2C", "Sandra Price – Apt 4A", "James Chen – Apt 2B"];

const TEMPLATES = [
  { label: "Rent reminder", text: "Hi! This is a reminder that rent is due on the 1st. Please make sure your payment is submitted on time to avoid late fees. Thank you!" },
  { label: "Late fee notice", text: "Hi, your rent payment is past due. A late fee has been applied to your account. Please log into the portal to pay your balance as soon as possible." },
  { label: "Maintenance update", text: "Hi! We wanted to let you know that your maintenance request has been updated. Please log into the portal to view the latest status." },
  { label: "Lease renewal", text: "Your lease is coming up for renewal soon. Please reach out to discuss your renewal options. We'd love to have you stay!" },
];

const SENT = [
  { to: "All tenants", msg: "Reminder: May rent is due May 1st!", date: "Apr 25", type: "reminder" },
  { to: "Tanya Williams", msg: "Your payment is overdue. Late fee applied.", date: "Apr 10", type: "late" },
  { to: "Marcus Johnson", msg: "Your maintenance request #1041 is being reviewed.", date: "Apr 27", type: "update" },
];

export default function AdminMessages() {
  const [to, setTo] = useState("All tenants");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!msg.trim()) return;
    setSent(true);
    setTimeout(() => setSent(false), 2500);
    setMsg("");
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Messages</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Send messages to one or all tenants</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        {/* Compose */}
        <div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New message</div>

            <div style={{ marginBottom: 12 }}>
              <Label>Send to</Label>
              <select value={to} onChange={e => setTo(e.target.value)} style={inputStyle}>
                {TENANTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <Label>Quick templates</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TEMPLATES.map(tp => (
                  <button key={tp.label} onClick={() => setMsg(tp.text)} style={{
                    padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb",
                    background: "#f9fafb", fontSize: 12, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", color: "#374151",
                  }}>{tp.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label>Message</Label>
              <textarea
                value={msg} onChange={e => setMsg(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                style={{ ...inputStyle, resize: "none", lineHeight: "1.6" }}
              />
            </div>

            {sent ? (
              <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 500 }}>
                ✅ Message sent to {to}!
              </div>
            ) : (
              <button onClick={handleSend} style={{
                width: "100%", background: "#1b3d2a", color: "#fff", border: "none",
                borderRadius: 10, padding: "13px", fontFamily: "'DM Sans', sans-serif",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>
                Send message to {to === "All tenants" ? "all tenants" : to.split("–")[0]}
              </button>
            )}
          </div>
        </div>

        {/* Sent history */}
        <div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recent messages</div>
            {SENT.map((s, i) => (
              <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < SENT.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{s.to}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.date}</div>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{s.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb",
  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", display: "block",
};
