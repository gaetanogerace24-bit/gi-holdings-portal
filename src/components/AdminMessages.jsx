import { useState, useEffect } from "react";
import { saveMessages, loadMessages } from "../storage";

const TEMPLATES = [
  { label: "Rent reminder", text: "Hi! Just a reminder that rent is due on the 1st. Please submit your payment through the portal on time to avoid late fees. Thank you!" },
  { label: "Late fee notice", text: "Hi, your rent is past due. A $35 late fee has been applied and an additional $10/day will accrue until your balance is paid. Please log in to pay now." },
  { label: "Maintenance update", text: "Hi! Your maintenance request has been updated. Please log into the G&I Holdings portal to check the latest status." },
  { label: "Lease renewal", text: "Your lease is coming up for renewal. Please reach out so we can discuss your options. We'd love to have you stay!" },
  { label: "Inspection notice", text: "We will be conducting a routine property inspection. We'll follow up with the scheduled date and time. Please let us know if you have any questions." },
];

export default function AdminMessages({ tenants }) {
  const [to, setTo] = useState("all");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState(() => {
    try { const s = localStorage.getItem("gi_messages"); return s ? JSON.parse(s) : []; } catch(e) { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem("gi_messages", JSON.stringify(history)); } catch(e) {}
  }, [history]);

  const handleSend = () => {
    if (!msg.trim()) return;
    const recipient = to === "all" ? "All tenants" : tenants.find(t => String(t.id) === to)?.name || "Unknown";
    const newHistory = [{ to: recipient, msg, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }, ...history];
    saveMessages(newHistory);
    setHistory(newHistory);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
    setMsg("");
  };

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Messages</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Send messages to one or all tenants</div>
      </div>

      {tenants.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No tenants to message</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Add tenants first, then you can message them here.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New message</div>

              <Label>Send to</Label>
              <select value={to} onChange={e => setTo(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
                <option value="all">📣 All tenants ({tenants.length})</option>
                {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.name} – {t.unit}</option>)}
              </select>

              <Label>Quick templates</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {TEMPLATES.map(tp => (
                  <button key={tp.label} onClick={() => setMsg(tp.text)} style={{
                    padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb",
                    background: "#f9fafb", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#374151",
                  }}>{tp.label}</button>
                ))}
              </div>

              <Label>Message</Label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type your message..." rows={5}
                style={{ ...inputStyle, resize: "none", lineHeight: "1.6", marginBottom: 14 }} />

              {sent ? (
                <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 600 }}>
                  ✅ Message sent!
                </div>
              ) : (
                <button onClick={handleSend} disabled={!msg.trim()} style={{
                  width: "100%", background: msg.trim() ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none",
                  borderRadius: 10, padding: "13px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
                  cursor: msg.trim() ? "pointer" : "not-allowed",
                }}>Send message</button>
              )}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Sent messages</div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13 }}>No messages sent yet</div>
              </div>
            ) : history.map((s, i) => (
              <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < history.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.to}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.date}</div>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{s.msg}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", display: "block" };
