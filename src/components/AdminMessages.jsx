import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const TEMPLATES = [
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [replyImage, setReplyImage] = useState(null);
  const [replyImagePreview, setReplyImagePreview] = useState(null);
  const [replying, setReplying] = useState(false);
  const fileInputRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const threadEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedTenant]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMessages(data);
    setLoading(false);
  }

  const uploadImage = async (file, folder) => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("messages").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("messages").getPublicUrl(path);
    return data.publicUrl;
  };

  // Notifies the tenant by email + SMS whenever the admin sends them a portal message.
  // Fire-and-forget — failures here should never block the message from being saved.
  // Uses supabase.functions.invoke() instead of raw fetch() so the anon key/auth header
  // is attached automatically (the Edge Function has "Verify JWT" enabled, so a raw
  // fetch with no Authorization header gets silently rejected with a 401).
  const notifyTenant = async (tenantId, message, imageUrl, fileName) => {
    try {
      const { error } = await supabase.functions.invoke("send-portal-message", {
        body: { tenant_id: tenantId, message, image_url: imageUrl, file_name: fileName },
      });
      if (error) console.error("Failed to notify tenant:", error);
    } catch (e) {
      console.error("Failed to notify tenant:", e);
    }
  };

  const handleImageSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleReplyImageSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setReplyImage(f);
    setReplyImagePreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const handleSend = async () => {
    if (!msg.trim() && !imageFile || sending) return;
    setSending(true);
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    let imageUrl = null;
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile, "admin"); } catch (e) { console.error(e); }
    }

    if (to === "all") {
      // Send individual message to each tenant so it shows in their thread
      const inserts = tenants.map(t => ({
        tenant_id: t.id,
        to_name: t.name,
        message: msg.trim(),
        image_url: imageUrl,
        file_name: imageFile ? imageFile.name : null,
        sender: "admin",
        date,
      }));
      const { data } = await supabase.from("messages").insert(inserts).select();
      if (data) setMessages(prev => [...data, ...prev]);
      // Notify every tenant by email + SMS
      tenants.forEach(t => notifyTenant(t.id, msg.trim(), imageUrl, imageFile?.name));
    } else {
      const recipientName = tenants.find(t => String(t.id) === to)?.name || "Unknown";
      const { data } = await supabase.from("messages").insert({
        tenant_id: to,
        to_name: recipientName,
        message: msg.trim(),
        image_url: imageUrl,
        file_name: imageFile ? imageFile.name : null,
        sender: "admin",
        date,
      }).select().single();
      if (data) setMessages(prev => [data, ...prev]);
      // Notify this tenant by email + SMS
      notifyTenant(to, msg.trim(), imageUrl, imageFile?.name);
    }

    setSent(true);
    setMsg("");
    setImageFile(null);
    setImagePreview(null);
    setSending(false);
    setTimeout(() => setSent(false), 2500);
  };

  const handleReply = async () => {
    if (!replyMsg.trim() && !replyImage || replying || !selectedTenant) return;
    setReplying(true);
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    let imageUrl = null;
    if (replyImage) {
      try { imageUrl = await uploadImage(replyImage, `admin/${selectedTenant.id}`); } catch (e) { console.error(e); }
    }

    const { data } = await supabase.from("messages").insert({
      tenant_id: selectedTenant.id,
      to_name: selectedTenant.name,
      message: replyMsg.trim(),
      image_url: imageUrl,
      file_name: replyImage ? replyImage.name : null,
      sender: "admin",
      date,
    }).select().single();
    if (data) setMessages(prev => [data, ...prev]);
    // Notify the tenant by email + SMS
    notifyTenant(selectedTenant.id, replyMsg.trim(), imageUrl, replyImage?.name);
    setReplyMsg("");
    setReplyImage(null);
    setReplyImagePreview(null);
    setReplying(false);
  };

  const getThread = (tenantId) => {
    return messages.filter(m =>
      String(m.tenant_id) === String(tenantId)
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const getConversations = () => {
    const seen = new Set();
    const convos = [];
    for (const m of messages) {
      if (m.tenant_id && !seen.has(m.tenant_id)) {
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
              <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type your message..." rows={4}
                style={{ ...inputStyle, resize: "none", lineHeight: "1.6", marginBottom: 10 }} />

              {/* Image attach */}
              <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleImageSelect} style={{ display: "none" }} />
              {imageFile ? (
                <div style={{ marginBottom: 12, position: "relative", display: "inline-flex", alignItems: "center", gap: 8, background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" style={{ maxHeight: 80, borderRadius: 8 }} />
                    : <span style={{ fontSize: 24 }}>{imageFile.type.startsWith("video/") ? "🎥" : "📎"}</span>
                  }
                  <span style={{ fontSize: 12, color: "#1b3d2a", fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageFile.name}</span>
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} style={{ ...outlineBtn, marginBottom: 12, fontSize: 13 }}>
                  📎 Attach file
                </button>
              )}

              {sent ? (
                <div style={{ background: "#dcfce7", border: "1px solid #4ade80", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#166534", fontWeight: 600 }}>✅ Message sent!</div>
              ) : (
                <button onClick={handleSend} disabled={(!msg.trim() && !imageFile) || sending} style={{ width: "100%", background: (msg.trim() || imageFile) ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, cursor: (msg.trim() || imageFile) ? "pointer" : "not-allowed" }}>
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
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selectedTenant?.id === tenant.id ? "#f0f9f4" : "transparent", borderRadius: 8, paddingLeft: 8 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                      {tenant.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{tenant.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {lastMsg.image_url && !lastMsg.message ? (() => {
                        const name = lastMsg.file_name || "";
                        const isVideo = name.match(/\.(mp4|mov|webm|ogg)$/i);
                        const isImage = name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
                        const emoji = isVideo ? "🎥" : isImage ? "📷" : "📎";
                        return `${emoji} ${name || "Attachment"}`;
                      })() : lastMsg.message?.slice(0, 50)}{lastMsg.message?.length > 50 ? "..." : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{lastMsg.date || new Date(lastMsg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — thread view */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", maxHeight: 700 }}>
            {selectedTenant ? (
              <>
                {/* Thread header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedTenant.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={async () => {
                      if (!window.confirm("Delete ALL messages in this conversation? This cannot be undone.")) return;
                      const ids = thread.map(m => m.id).filter(Boolean);
                      if (ids.length) await supabase.from("messages").delete().in("id", ids);
                      setMessages(prev => prev.filter(m => !ids.includes(m.id)));
                    }} style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                      🗑 Clear all
                    </button>
                    <button onClick={() => setSelectedTenant(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>✕</button>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {thread.map((m, i) => {
                    const isAdmin = m.sender === "admin";
                    return (
                      <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: isAdmin ? "flex-end" : "flex-start" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          {!isAdmin && <button onClick={async () => {
                            if (!window.confirm("Delete this message?")) return;
                            await supabase.from("messages").delete().eq("id", m.id);
                            setMessages(prev => prev.filter(msg => msg.id !== m.id));
                          }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#d1d5db", padding: "0 2px" }} title="Delete message">🗑</button>}
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>
                            {isAdmin ? "You (Admin)" : selectedTenant.name} · {m.date || new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                          {isAdmin && <button onClick={async () => {
                            if (!window.confirm("Delete this message?")) return;
                            await supabase.from("messages").delete().eq("id", m.id);
                            setMessages(prev => prev.filter(msg => msg.id !== m.id));
                          }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#d1d5db", padding: "0 2px" }} title="Delete message">🗑</button>}
                        </div>
                        <div style={{ maxWidth: "85%", padding: m.image_url && !m.message ? "6px" : "10px 14px", borderRadius: isAdmin ? "14px 4px 14px 14px" : "4px 14px 14px 14px", background: isAdmin ? "#1b3d2a" : "#f3f4f6", color: isAdmin ? "#fff" : "#1f2937", fontSize: 13, lineHeight: 1.5 }}>
                          {m.image_url && (() => {
                            const url = m.image_url;
                            const isVideo = url.includes(".mp4") || url.includes(".mov") || url.includes(".webm");
                            const isImage = url.includes(".jpg") || url.includes(".jpeg") || url.includes(".png") || url.includes(".gif") || url.includes(".webp") || url.includes(".heic");
                            if (isVideo) return <video src={url} controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", marginBottom: m.message ? 8 : 0 }} />;
                            if (isImage) return <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="attachment" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", marginBottom: m.message ? 8 : 0 }} /></a>;
                            const emoji = url.match(/\.(mp4|mov|webm|ogg)/i) ? "🎥" : url.match(/\.(jpg|jpeg|png|gif|webp|heic)/i) ? "📷" : "📎";
                    return <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: isAdmin ? "#a7f3d0" : "#1b3d2a", fontSize: 13, fontWeight: 600, textDecoration: "underline", marginBottom: m.message ? 6 : 0 }}>{emoji} {m.file_name || "View attachment"}</a>;
                          })()}
                          {m.message && <span>{m.message}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply box */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
                  <input ref={replyFileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleReplyImageSelect} style={{ display: "none" }} />
                  {replyImage && (
                    <div style={{ marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 8, background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 10px" }}>
                      {replyImagePreview
                        ? <img src={replyImagePreview} alt="preview" style={{ maxHeight: 60, borderRadius: 6 }} />
                        : <span style={{ fontSize: 20 }}>{replyImage.type.startsWith("video/") ? "🎥" : "📎"}</span>
                      }
                      <span style={{ fontSize: 12, color: "#1b3d2a", fontWeight: 600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyImage.name}</span>
                      <button onClick={() => { setReplyImage(null); setReplyImagePreview(null); }} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <button onClick={() => replyFileInputRef.current?.click()} style={{ padding: "10px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "#f9fafb", fontSize: 18, cursor: "pointer", flexShrink: 0 }} title="Attach file">
                      📎
                    </button>
                    <textarea
                      value={replyMsg}
                      onChange={e => setReplyMsg(e.target.value)}
                      placeholder="Reply..."
                      rows={2}
                      style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "9px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, resize: "none", boxSizing: "border-box" }}
                    />
                    <button
                      onClick={handleReply}
                      disabled={(!replyMsg.trim() && !replyImage) || replying}
                      style={{ padding: "10px 16px", background: (replyMsg.trim() || replyImage) ? "#1b3d2a" : "#d1d5db", color: "#fff", border: "none", borderRadius: 9, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: (replyMsg.trim() || replyImage) ? "pointer" : "not-allowed", flexShrink: 0 }}>
                      {replying ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300, color: "#9ca3af", textAlign: "center", padding: 20 }}>
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
const outlineBtn = { padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#f9fafb", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 };
