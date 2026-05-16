import { useEffect, useState } from "react";

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToPortal = () => {
    sessionStorage.setItem('redirect', '/portal');
    window.location.href = "/portal";
  };

  return (
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
          <a href="mailto:giholdingsllc8@gmail.com" style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, textDecoration: "none" }}>
            Contact
          </a>
          <button onClick={goToPortal} style={{
            background: "#4caf7d", color: "#fff", border: "none",
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", transition: "background 0.2s",
          }}
            onMouseOver={e => e.target.style.background = "#3d9e6c"}
            onMouseOut={e => e.target.style.background = "#4caf7d"}
          >
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
        <div style={{
          position: "absolute", bottom: -60, left: -60, width: 300, height: 300,
          background: "rgba(76,175,125,0.05)", borderRadius: "50%",
        }} />
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(76,175,125,0.2)", border: "1px solid rgba(76,175,125,0.3)",
            padding: "5px 14px", borderRadius: 20, marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, background: "#4caf7d", borderRadius: "50%" }} />
            <span style={{ color: "#a8e6c3", fontSize: 12, fontWeight: 500 }}>
              Residential rentals — Youngstown, Ohio
            </span>
          </div>
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
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={goToPortal} style={{
              background: "#4caf7d", color: "#fff", border: "none",
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseOver={e => e.target.style.background = "#3d9e6c"}
              onMouseOut={e => e.target.style.background = "#4caf7d"}
            >
              Tenant portal login →
            </button>
            <a href="mailto:giholdingsllc8@gmail.com" style={{
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 500,
              cursor: "pointer", textDecoration: "none", display: "inline-block",
            }}>
              Contact us
            </a>
          </div>
        </div>
      </section>

      {/* Info bar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8ede8",
        padding: "14px 32px", display: "flex", gap: 32, flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {[
          { icon: "📍", text: "669 Bel Air Rd #1122, Bel Air, MD 21014" },
          { icon: "📞", text: "(330) 969-6464" },
          { icon: "✉️", text: "giholdingsllc8@gmail.com" },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555" }}>
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

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
              padding: "24px 20px", transition: "box-shadow 0.2s",
            }}
              onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(27,61,42,0.08)"}
              onMouseOut={e => e.currentTarget.style.boxShadow = "none"}
            >
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
                { icon: "📞", label: "(330) 969-6464" },
                { icon: "✉️", label: "giholdingsllc8@gmail.com" },
                { icon: "🌐", label: "giholdingsllc.com" },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#555" }}>
                  <span>{icon}</span><span>{label}</span>
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

      {/* SMS Privacy notice */}
      <section style={{ padding: "48px 32px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{
          background: "#fff", border: "1px solid #e8ede8", borderRadius: 14, padding: "28px 32px",
        }}>
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
          <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8, margin: 0 }}>
            To opt out, reply <strong style={{ color: "#374151" }}>STOP</strong> to any message.
            For help, reply <strong style={{ color: "#374151" }}>HELP</strong> or contact us at giholdingsllc8@gmail.com.
          </p>
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
          <a href="mailto:giholdingsllc8@gmail.com" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textDecoration: "none" }}>
            Contact
          </a>
          <button onClick={goToPortal} style={{
            background: "none", border: "none", color: "#4caf7d",
            fontSize: 12, cursor: "pointer", padding: 0,
          }}>
            Tenant portal
          </button>
        </div>
      </footer>
    </div>
  );
}
