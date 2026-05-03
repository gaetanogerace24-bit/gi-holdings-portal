import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function TenantMessages({ tenant }) {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    loadMessages();
  }, [tenant?.id]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`tenant_id.eq.${tenant.id},tenant_id.is.null`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }

  async function handleReply() {
    if (!reply.trim()) return;
    setSending(true);
    const newMsg = {
      tenant_id: tenant.id,
      message: reply.trim(),
      sender: tenant.name,
      to_name: "G&I Holdings",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    const { data } = await supabase.from("messages").insert(newMsg).select().single();
    if (data) setMessages(prev => [...prev, data]);
    setReply("");
    setSending(false);
  }

  const adminMessages = messages.filter(m => m.sender === "admin" || !m.sender || m.sender === "G&I Holdings");
  const tenantMessages = messages.filter(m => m.sender === tenant.name);
  const allSorted = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading messages...</div>
  );

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>Messages</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Messages from G&I Holdings</div>
      </div>

      {/* Message thread */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {allSorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 500 }}>No messages yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Messages from your landlord will appear here.</div>
          </div>
        )}
        {allSorted.map((m, i) => {
          const isFromAdmin = m.sender === "admin" || !m.sender || m.sender === "G&I Holdings" || m.to_name === tenant.name || m.tenant_id === null || m.tenant_id === tenant.id;
          const isFromTenant = m.sender === tenant.name;
          const fromAdmin = !isFromTenant;

          return (
            <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: fromAdmin ? "flex-start" : "flex-end" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, paddingLeft: fromAdmin ? 4 : 0, paddingRight: fromAdmin ? 0 : 4 }}>
                {fromAdmin ? "G&I Holdings" : "You"} · {m.date || new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div style={{
                maxWidth: "85%", padding: "12px 14px", borderRadius: fromAdmin ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                background: fromAdmin ? "#fff" : "#1b3d2a",
                border: fromAdmin ? "1px solid rgba(0,0,0,0.08)" : "none",
                color: fromAdmin ? "#1a1a1a" : "#fff",
                fontSize: 14, lineHeight: 1.5,
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: 14 }}>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Type a message to G&I Holdings..."
          rows={3}
          style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, resize: "none", boxSizing: "border-box", marginBottom: 10 }}
        />
        <button
          onClick={handleReply}
          disabled={!reply.trim() || sending}
          style={{
            width: "100%", background: reply.trim() ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none",
            borderRadius: 10, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
            cursor: reply.trim() ? "pointer" : "not-allowed",
          }}>
          {sending ? "Sending..." : "Send message"}
        </button>
      </div>
    </div>
  );
}
