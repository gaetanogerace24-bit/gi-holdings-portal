import { useState, useEffect } from "react";

export default function AdminListings({ supabase }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editListing, setEditListing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ address: "", city: "Youngstown, OH", zip: "", rent: "", beds: "", baths: "", sqft: "", description: "", available: true });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);

  useEffect(() => { loadListings(); }, []);

  async function loadListings() {
    setLoading(true);
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    setListings(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditListing(null);
    setForm({ address: "", city: "Youngstown, OH", zip: "", rent: "", beds: "", baths: "", sqft: "", description: "", available: true });
    setPendingImages([]);
    setShowForm(true);
  }

  function openEdit(l) {
    setEditListing(l);
    setForm({ address: l.address || "", city: l.city || "Youngstown, OH", zip: l.zip || "", rent: l.rent || "", beds: l.beds || "", baths: l.baths || "", sqft: l.sqft || "", description: l.description || "", available: l.available !== false });
    setPendingImages([]);
    setShowForm(true);
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const localPreviews = files.map(f => ({ url: URL.createObjectURL(f), uploading: true, file: f }));
    setPendingImages(prev => [...prev, ...localPreviews]);
    setUploadingImages(true);

    const uploaded = [];
    for (const item of localPreviews) {
      const file = item.file;
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `listings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        console.error("Upload error:", error);
        alert(`Upload failed: ${error.message}`);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("listing-images").getPublicUrl(path);
        uploaded.push({ url: publicUrl, uploading: false, localUrl: item.url });
      }
    }

    setPendingImages(prev => {
      const kept = prev.filter(p => !localPreviews.find(lp => lp.url === p.url));
      return [...kept, ...uploaded];
    });
    setUploadingImages(false);
  }

  async function handleSave() {
    setSaving(true);
    const existingImages = editListing?.images || [];
    const allImages = [...existingImages, ...pendingImages.filter(p => !p.uploading).map(p => p.url)];
    const payload = { ...form, rent: Number(form.rent), beds: Number(form.beds), baths: Number(form.baths), sqft: Number(form.sqft), images: allImages };
    if (editListing) {
      await supabase.from("listings").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editListing.id);
    } else {
      await supabase.from("listings").insert({ ...payload, created_at: new Date().toISOString() });
    }
    setSaving(false);
    setShowForm(false);
    loadListings();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this listing?")) return;
    await supabase.from("listings").delete().eq("id", id);
    loadListings();
  }

  async function toggleAvailable(l) {
    await supabase.from("listings").update({ available: !l.available }).eq("id", l.id);
    loadListings();
  }

  async function removeImage(listing, url) {
    const newImages = (listing.images || []).filter(u => u !== url);
    await supabase.from("listings").update({ images: newImages }).eq("id", listing.id);
    loadListings();
  }

  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", outline: "none", background: "#fff", color: "#1a1a1a" };
  const label = { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 };

  if (showForm) return (
    <div style={{ padding: 32, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>←</button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editListing ? "Edit listing" : "Add listing"}</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <span style={label}>Address</span>
          <input style={inp}  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <span style={label}>City</span>
          <input style={inp}  value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <span style={label}>ZIP</span>
          <input style={inp}  value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
        </div>
        <div>
          <span style={label}>Monthly rent ($)</span>
          <input style={inp} type="number"  value={form.rent} onChange={e => setForm(f => ({ ...f, rent: e.target.value }))} />
        </div>
        <div>
          <span style={label}>Bedrooms</span>
          <input style={inp} type="number"  value={form.beds} onChange={e => setForm(f => ({ ...f, beds: e.target.value }))} />
        </div>
        <div>
          <span style={label}>Bathrooms</span>
          <input style={inp} type="number"  value={form.baths} onChange={e => setForm(f => ({ ...f, baths: e.target.value }))} />
        </div>
        <div>
          <span style={label}>Sq ft</span>
          <input style={inp} type="number"  value={form.sqft} onChange={e => setForm(f => ({ ...f, sqft: e.target.value }))} />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <span style={label}>Description (optional)</span>
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }}  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span style={label}>Photos</span>
        {editListing?.images?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {editListing.images.map(url => (
              <div key={url} style={{ position: "relative" }}>
                <img src={url} onClick={() => window.open(url, "_blank")} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "zoom-in" }} />
                <button onClick={() => removeImage(editListing, url)} style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            ))}
          </div>
        )}
        {pendingImages.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {pendingImages.map((img, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={img.url} onClick={() => !img.uploading && window.open(img.url, "_blank")} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, border: `1px solid ${img.uploading ? "#fcd34d" : "#86efac"}`, opacity: img.uploading ? 0.6 : 1, cursor: img.uploading ? "default" : "zoom-in" }} />
                {img.uploading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#92400e", background: "rgba(255,255,255,0.5)", borderRadius: 6 }}>uploading</div>}
                {!img.uploading && <button onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}
              </div>
            ))}
          </div>
        )}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
          {uploadingImages ? "Uploading..." : "📷 Upload photos"}
          <input type="file" multiple accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.pdf" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploadingImages} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={label}>Available</span>
        <div onClick={() => setForm(f => ({ ...f, available: !f.available }))} style={{ width: 44, height: 24, borderRadius: 12, background: form.available ? "#16a34a" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
          <div style={{ position: "absolute", top: 2, left: form.available ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
        </div>
        <span style={{ fontSize: 13, color: form.available ? "#16a34a" : "#6b7280" }}>{form.available ? "Listed as available" : "Hidden from site"}</span>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving..." : editListing ? "Save changes" : "Add listing"}
      </button>
    </div>
  );

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🏡 Listings</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Manage rental properties shown on your website</p>
        </div>
        <button onClick={openAdd} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Add listing</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading...</div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No listings yet</div>
          <div style={{ fontSize: 13 }}>Add your first available rental property</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {listings.map(l => (
            <div key={l.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 140, background: "#f3f4f6", position: "relative", overflow: "hidden" }}>
                {l.images?.[0] ? (
                  <img src={l.images[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>No photo</div>
                )}
                <span style={{ position: "absolute", top: 10, left: 10, background: l.available ? "#16a34a" : "#6b7280", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20 }}>
                  {l.available ? "Available" : "Hidden"}
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{l.address || "Blank"}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{l.city}{l.zip ? ` ${l.zip}` : ""}</div>
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  {l.beds && <span style={{ fontSize: 12, color: "#6b7280" }}>🛏 {l.beds} beds</span>}
                  {l.baths && <span style={{ fontSize: 12, color: "#6b7280" }}>🚿 {l.baths} baths</span>}
                  {l.sqft && <span style={{ fontSize: 12, color: "#6b7280" }}>📐 {l.sqft} sqft</span>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>${Number(l.rent || 0).toLocaleString()}<span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>/mo</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(l)} style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>✏️ Edit</button>
                  <button onClick={() => toggleAvailable(l)} style={{ flex: 1, background: l.available ? "#fef9c3" : "#f0fdf4", border: `1px solid ${l.available ? "#fde047" : "#86efac"}`, borderRadius: 8, padding: "8px", fontSize: 13, cursor: "pointer", fontWeight: 500, color: l.available ? "#854d0e" : "#166534" }}>
                    {l.available ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => handleDelete(l.id)} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", color: "#dc2626" }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
