import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function HomePage({ onLoginClick, onApply }) {
  const [scrolled, setScrolled] = useState(false);
  const [listings, setListings] = useState([]);
  const [appFee, setAppFee] = useState(30);
  const [gallery, setGallery] = useState(null); // { images: [], index: 0 }
  const [expandedListings, setExpandedListings] = useState(new Set());

  useEffect(() => {
    supabase.from("listings").select("*").eq("status", "published").eq("available", true).order("created_at", { ascending: false }).then(({ data }) => setListings(data || []));
    supabase.from("settings").select("value").eq("key", "portal_settings").maybeSingle().then(({ data }) => {
      if (data?.value?.applicationFee) setAppFee(Number(data.value.applicationFee));
    });
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", position: "relative" }}>
      {gallery && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setGallery(null)}>
          <button onClick={() => setGallery(null)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#fff", fontSize: 32, cursor: "pointer", lineHeight: 1 }}>×</button>
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            {gallery.index + 1} / {gallery.images.length}
          </div>
          <img
            src={gallery.images[gallery.index]}
            style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />
          {gallery.images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setGallery(g => ({ ...g, index: (g.index - 1 + g.images.length) % g.images.length })); }}
                style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer" }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setGallery(g => ({ ...g, index: (g.index + 1) % g.images.length })); }}
                style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer" }}>›</button>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }} onClick={e => e.stopPropagation()}>
                {gallery.images.map((img, i) => (
                  <img key={i} src={img} onClick={() => setGallery(g => ({ ...g, index: i }))}
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, cursor: "pointer", border: i === gallery.index ? "2px solid #fff" : "2px solid transparent", opacity: i === gallery.index ? 1 : 0.5 }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f5f7f5", minHeight: "100vh" }}>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(27,61,42,0.97)" : "#1b3d2a",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.3s ease",
        borderBottom: scrolled ? "1px solid rgba(76,175,125,0.2)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: "#4caf7d", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#fff",
          }}>G</div>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, letterSpacing: "-0.3px" }}>
            G&I Holdings LLC
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="tel:+13309696464" style={{ color: "#fff", fontSize: 13, textDecoration: "none", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 16px", borderRadius: 8 }}>
            Call us
          </a>
          <button onClick={onLoginClick} style={{
            background: "#4caf7d", color: "#fff", border: "none",
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>
            Tenant portal
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(160deg, #1b3d2a 0%, #2d5c42 60%, #3a7a58 100%)",
        paddingTop: 120, paddingBottom: 80, paddingLeft: 32, paddingRight: 32,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -80, right: -80, width: 400, height: 400,
          background: "rgba(76,175,125,0.08)", borderRadius: "50%",
        }} />
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          <h1 style={{
            color: "#fff", fontSize: 42, fontWeight: 700, lineHeight: 1.2,
            margin: "0 0 16px", letterSpacing: "-0.5px",
          }}>
            Quality rental homes<br />in Youngstown, Ohio
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.72)", fontSize: 16, lineHeight: 1.7,
            margin: "0 0 32px", maxWidth: 480,
          }}>
            G&I Holdings LLC manages residential rental properties with a focus
            on responsive service and well-maintained homes for our tenants.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(76,175,125,0.2)", border: "1px solid rgba(76,175,125,0.4)", borderRadius: 20, padding: "5px 14px", marginBottom: 20 }}>
            <span style={{ fontSize: 13 }}>🏠</span>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓ Section 8 vouchers welcome</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onLoginClick} style={{
              background: "#4caf7d", color: "#fff", border: "none",
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: "pointer",
            }}>
              Tenant portal login →
            </button>
            <a href="tel:+13309696464" style={{
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 500,
              cursor: "pointer", textDecoration: "none", display: "inline-block",
            }}>
              Call us
            </a>
            <button onClick={() => { document.getElementById("available-rentals").scrollIntoView({ behavior: "smooth" }); }} style={{
              background: "#1b3d2a", color: "#fff", border: "1px solid rgba(255,255,255,0.35)",
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: "pointer",
            }}>
              View available rentals ↓
            </button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ padding: "64px 32px", maxWidth: 800, margin: "0 auto" }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#1b3d2a", margin: "0 0 8px", textAlign: "center" }}>
          What we offer
        </h2>
        <p style={{ color: "#6b7280", fontSize: 15, textAlign: "center", margin: "0 0 40px" }}>
          Residential properties managed with care
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { icon: "🏠", title: "Residential rentals", desc: "Single-family and multi-unit rental homes across the Youngstown, Ohio area." },
            { icon: "🔧", title: "Maintenance", desc: "Responsive maintenance and repairs to keep your home in top condition." },
            { icon: "📱", title: "Online tenant portal", desc: "Pay rent, view invoices, and manage your account online at any time." },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: "#fff", border: "1px solid #e8ede8", borderRadius: 14,
              padding: "24px 20px",
            }}>
              <div style={{
                width: 44, height: 44, background: "#edf7f1", borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 14,
              }}>{icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1b3d2a", margin: "0 0 8px" }}>{title}</h3>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Available Rentals */}
      {listings.length > 0 && (
        <section id="available-rentals" style={{ padding: "64px 32px", maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#1b3d2a", margin: "0 0 8px", textAlign: "center" }}>
            Available rentals
          </h2>
          <p style={{ color: "#6b7280", fontSize: 15, textAlign: "center", margin: "0 0 24px" }}>
            Properties currently available in Youngstown, Ohio
          </p>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #4caf7d", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <div style={{ fontSize: 22 }}>🏠</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1b3d2a" }}>Section 8 / Housing Choice Vouchers accepted</div>
              <div style={{ fontSize: 13, color: "#2d6a47", marginTop: 2 }}>We proudly work with housing voucher holders. Apply now!</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
            {listings.map(l => (
              <div key={l.id} style={{ background: "#fff", border: "1px solid #e8ede8", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ position: "relative", overflow: "hidden", cursor: l.images?.length ? "pointer" : "default" }}
                  onClick={() => l.images?.length && setGallery({ images: l.images, index: 0 })}>
                  <div style={{ height: 200, background: "#2d5a3d", position: "relative", overflow: "hidden" }}>
                    {l.images?.[0]
                      ? <img src={l.images[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No photo</div>
                    }
                    <span style={{ position: "absolute", top: 12, left: 12, background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>Available</span>
                    {l.images?.length > 1 && (
                      <span style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 10 }}>
                        1 / {l.images.length} · tap to view all
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 3 }}>{l.address}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>{l.city}{l.zip ? ` ${l.zip}` : ""}</div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ background: "#f0fdf4", color: "#1b3d2a", border: "1px solid #4caf7d", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>✓ Section 8 accepted</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                    {l.beds && <span style={{ fontSize: 13, color: "#6b7280" }}>🛏 {l.beds} beds</span>}
                    {l.baths && <span style={{ fontSize: 13, color: "#6b7280" }}>🚿 {l.baths} baths</span>}
                    {l.sqft && <span style={{ fontSize: 13, color: "#6b7280" }}>📐 {Number(l.sqft).toLocaleString()} sqft</span>}
                  </div>
                  {l.description && (() => {
                    const isExpanded = expandedListings.has(l.id);
                    const LIMIT = 160;
                    const needsTruncation = l.description.length > LIMIT;
                    return (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                          {needsTruncation && !isExpanded ? l.description.slice(0, LIMIT).trimEnd() + "…" : l.description}
                        </p>
                        {needsTruncation && (
                          <button
                            onClick={() => setExpandedListings(prev => {
                              const next = new Set(prev);
                              if (isExpanded) next.delete(l.id); else next.add(l.id);
                              return next;
                            })}
                            style={{ background: "none", border: "none", color: "#1b3d2a", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" }}
                          >
                            {isExpanded ? "Read less ↑" : "Read more ↓"}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 16 }}>
                    ${Number(l.rent).toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>/mo</span>
                  </div>
                  {(() => {
                    let hasPaid = false;
                    let hasSubmitted = false;
                    try {
                      const applyData = localStorage.getItem("gi_apply");
                      hasPaid = !!applyData && JSON.parse(applyData)?.listingId === l.id;
                      hasSubmitted = localStorage.getItem("gi_apply_submitted_" + l.id) === "true";
                    } catch(e) {}
                    return (
                      <button
                        onClick={() => !hasSubmitted && onApply && onApply(l)}
                        style={{ display: "block", width: "100%", background: hasSubmitted ? "#6b7280" : hasPaid ? "#15803d" : "#1b3d2a", color: "#fff", border: "none", textAlign: "center", padding: "13px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: hasSubmitted ? "default" : "pointer" }}
                      >
                        {hasSubmitted ? "✅ Application submitted" : hasPaid ? "▶ Resume application" : "Apply now"}
                      </button>
                    );
                  })()}
                  <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "8px 0 0" }}>${l.application_fee || 30} application fee required</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section style={{
        background: "#fff", borderTop: "1px solid #e8ede8", borderBottom: "1px solid #e8ede8",
        padding: "64px 32px",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1b3d2a", margin: "0 0 14px" }}>
              About G&I Holdings LLC
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8, margin: "0 0 24px" }}>
              G&I Holdings LLC is a residential property management company serving the
              Youngstown, Ohio area. We are committed to providing quality housing and
              responsive management for all of our tenants.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "📍", label: "669 Bel Air Rd #1122, Bel Air, MD 21014 (mailing)" },
                { icon: "📞", label: "(330) 969-6464", href: "tel:+13309696464" },
                { icon: "✉️", label: "giholdingsllc8@gmail.com" },
                { icon: "🌐", label: "giholdingsllc.com" },
              ].map(({ icon, label, href }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#555" }}>
                  <span>{icon}</span>{href ? <a href={href} style={{ color: "#555", textDecoration: "none" }}>{label}</a> : <span>{label}</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #1b3d2a, #2d5c42)",
            borderRadius: 16, height: 220,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8,
          }}>
            <div style={{ fontSize: 52 }}>🏘️</div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 500 }}>G&I Holdings LLC</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Youngstown, Ohio</div>
          </div>
        </div>
      </section>

      {/* SMS Privacy */}
      <section style={{ padding: "48px 32px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ background: "#fff", border: "1px solid #e8ede8", borderRadius: 14, padding: "28px 32px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1b3d2a", margin: "0 0 12px" }}>
            SMS Communication Policy
          </h3>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, margin: "0 0 10px" }}>
            G&I Holdings LLC may send SMS text messages to tenants for account notifications including
            rent reminders, late fee alerts, and balance updates. Message frequency varies based on
            account activity. Message and data rates may apply.
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, margin: "0 0 10px" }}>
            <strong style={{ color: "#374151" }}>Your mobile information will not be sold or shared
            with third parties for promotional or marketing purposes.</strong>
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, margin: "0 0 16px" }}>
            To opt out, reply <strong style={{ color: "#374151" }}>STOP</strong> to any message.
            For help, reply <strong style={{ color: "#374151" }}>HELP</strong> or contact us at giholdingsllc8@gmail.com.
          </p>
          <a
            href="https://giholdingsllc.com/GI_Holdings_SMS_Consent_Form.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#1b3d2a", color: "#fff", textDecoration: "none",
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            }}
          >
            📄 View SMS Consent Form
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: "#1b3d2a", padding: "24px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          © 2026 G&I Holdings LLC. All rights reserved.
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="tel:+13309696464" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textDecoration: "none" }}>
            Call us
          </a>
          <button onClick={onLoginClick} style={{
            background: "none", border: "none", color: "#4caf7d",
            fontSize: 12, cursor: "pointer", padding: 0,
          }}>
            Tenant portal
          </button>
        </div>
      </footer>
    </div>
    </div>
  );
}
