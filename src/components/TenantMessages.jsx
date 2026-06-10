import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

export default function TenantMessages({ tenant }) {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const threadEndRef = useRef(null);

  useEffect(() => {
    if (!tenant?.id) return;
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`tenant_id.eq.${tenant.id},tenant_id.is.null`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  const handleImageSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  async function handleReply() {
    if (!reply.trim() && !imageFile) return;
    setSending(true);

    let imageUrl = null;
    if (imageFile) {
      try {
        const ext = imageFile.name.split(".").pop();
        const path = `tenant/${tenant.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("messages").upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (!error) {
          const { data } = supabase.storage.from("messages").getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
      } catch (e) { console.error(e); }
    }

    const newMsg = {
      tenant_id: tenant.id,
      message: reply.trim(),
      image_url: imageUrl,
      sender: tenant.name,
      to_name: "G&I Holdings",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    const { data } = await supabase.from("messages").insert(newMsg).select().single();
    if (data) setMessages(prev => [...(prev || []), data]);
    setReply("");
    setImageFile(null);
    setImagePreview(null);
    setSending(false);
  }

  const allSorted = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div style={{ padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>Messages</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Messages from G&I Holdings</div>
      </div>

      {/* Message thread */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, minHeight: 160, maxHeight: 420, overflowY: "auto" }}>
        {allSorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 500 }}>No messages yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Messages from your landlord will appear here.</div>
          </div>
        ) : (
          allSorted.map((m, i) => {
            const isFromTenant = m.sender === tenant.name;
            const fromAdmin = !isFromTenant;
            return (
              <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: fromAdmin ? "flex-start" : "flex-end" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, paddingLeft: fromAdmin ? 4 : 0, paddingRight: fromAdmin ? 0 : 4 }}>
                  {fromAdmin ? "G&I Holdings" : "You"} · {m.date || new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{
                  maxWidth: "85%",
                  padding: m.image_url && !m.message ? "6px" : "12px 14px",
                  borderRadius: fromAdmin ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                  background: fromAdmin ? "#fff" : "#1b3d2a",
                  border: fromAdmin ? "1px solid rgba(0,0,0,0.08)" : "none",
                  color: fromAdmin ? "#1a1a1a" : "#fff",
                  fontSize: 14, lineHeight: 1.5,
                }}>
                  {m.image_url && (
                    m.image_url.match(/\.(mp4|mov|webm|ogg)(\?|$)/i)
                      ? <video src={m.image_url} controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", marginBottom: m.message ? 8 : 0 }} />
                      : m.image_url.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i)
                        ? <a href={m.image_url} target="_blank" rel="noopener noreferrer"><img src={m.image_url} alt="attachment" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", marginBottom: m.message ? 8 : 0 }} /></a>
                        : <a href={m.image_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: fromAdmin ? "#1b3d2a" : "#a7f3d0", fontSize: 13, fontWeight: 600, marginBottom: m.message ? 6 : 0 }}>📎 View attachment</a>
                  )}
                  {m.message && <span>{m.message}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Reply box */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: 14 }}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleImageSelect} style={{ display: "none" }} />

        {imageFile && (
          <div style={{ marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 8, background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8 }} />
              : <span style={{ fontSize: 24 }}>{imageFile.type.startsWith("video/") ? "🎥" : "📎"}</span>
            }
            <span style={{ fontSize: 12, color: "#1b3d2a", fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageFile.name}</span>
            <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        )}

        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Type a message to G&I Holdings..."
          rows={3}
          style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, resize: "none", boxSizing: "border-box", marginBottom: 10 }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "#f9fafb", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#374151" }}
            title="Attach file, photo, or video">
            📎
          </button>
          <button
            onClick={handleReply}
            disabled={(!reply.trim() && !imageFile) || sending}
            style={{
              flex: 1, background: (reply.trim() || imageFile) ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
              cursor: (reply.trim() || imageFile) ? "pointer" : "not-allowed",
            }}>
            {sending ? "Sending..." : "Send message"}
          </button>
        </div>
      </div>
    </div>
  );
}
