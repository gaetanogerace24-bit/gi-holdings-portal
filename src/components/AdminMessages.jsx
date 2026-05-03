import { useState, useEffect } from "react";
import { supabase } from "../supabase";

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
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMessages(data);
    setLoading(false);
  }

  const handleSend = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    const recipient = to === "all" ? null : to;
    const recipientName = to === "all" ? "All tenants" : tenants.find(t => String(t.id) === to)?.name || "Unknown";
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const { data } = await supabase.from("messages").insert({
      tenant_id: recipient, to_name: recipientName,
      message: msg.trim(), sender: "admin", date,
    }).select().single();
    if (data) setMessages(prev => [data, ...prev]);
    setSent(true);
    setMsg("");
    setSending(false);
    setTimeout(() => setSent(false), 2500);
  };

  // Get thread for a specific tenant
  const getThread = (tenantId) => {
    return messages.filter(m =>
      m.tenant_id === tenantId ||
      (m.sender === "admin" && (m.tenant_id === tenantId || m.tenant_id === null))
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  // Get latest message per tenant for the conversations list
  const getConversations = () => {
    const seen = new Set();
    const convos = [];
    for (const m of messages) {
      if (m.sender !== "admin" && m.tenant_id && !seen.has(m.tenant_id)) {
        seen.add(m.tenant_id);
        const tenant = tenants.find(t => t.id === m.tenant_id);
        if (tenant) convos.push({ tenant, lastMsg: m });
      }
    }
    return convos;
  };

  const conversations = getConversations();
  const thread = selectedTenant ? getThread(selectedTenant.id) : [];

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Messages</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Send messages and view tenant conversations</div>
      </div>

      {tenants.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>No tenants to message</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>

          {/* Left — compose + tenant conversations */}
          <div>
            {/* Compose */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New message</div>

              <Label>Send to</Label>
              <select value={to} onChange={e => setTo(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }}>
                <option value="all">📣 All tenants ({tenants.length})</option>
                {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>

              <Label>Quick templates</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {TEMPLATES.map(tp => (
                  <button key={tp.label} onClick={() => setMsg(tp.text)} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #e5e7eb", background: "#f9fafb", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#374151" }}>
                    {tp.label}
                  </button>
                ))}
              </div>

              <Label>Message</Label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type your message..." rows={5}
                style={{ ...inputStyle, resize: "none", lineHeight: "1.6", marginBottom: 14 }} />

              {sent ? (
                <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 600 }}>✅ Message sent!</div>
              ) : (
                <button onClick={handleSend} disabled={!msg.trim() || sending} style={{ width: "100%", background: msg.trim() ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: msg.trim() ? "pointer" : "not-allowed" }}>
                  {sending ? "Sending..." : "Send message"}
                </button>
              )}
            </div>

            {/* Tenant conversations */}
            {conversations.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Tenant conversations</div>
                {conversations.map(({ tenant, lastMsg }) => (
                  <div key={tenant.id} onClick={() => setSelectedTenant(selectedTenant?.id === tenant.id ? null : tenant)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                      {tenant.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{tenant.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{lastMsg.message.slice(0, 50)}{lastMsg.message.length > 50 ? "..." : ""}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{lastMsg.date || new Date(lastMsg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — thread view */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid rgba(0,0,0,0.07)" }}>
            {selectedTenant ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedTenant.name}</div>
                  <button onClick={() => setSelectedTenant(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {thread.map((m, i) => {
                    const isAdmin = m.sender === "admin";
                    return (
                      <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>
                          {isAdmin ? "You (Admin)" : selectedTenant.name} · {m.date || new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: isAdmin ? "14px 4px 14px 14px" : "4px 14px 14px 14px", background: isAdmin ? "#1b3d2a" : "#f3f4f6", color: isAdmin ? "#fff" : "#1f2937", fontSize: 13, lineHeight: 1.5 }}>
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200, color: "#9ca3af", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Select a conversation</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Click a tenant on the left to view their messages</div>
              </div>
            )}
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
