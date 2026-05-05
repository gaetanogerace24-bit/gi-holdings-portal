import { useState } from "react";

export default function LoginScreen({ onLogin, loginError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const result = await onLogin(email, password);
    if (result === false) {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const displayError = loginError || error;

  return (
    <div style={{
      minHeight: "100vh", background: "#1b3d2a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "linear-gradient(135deg, #4caf7d, #2d7a52)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, marginBottom: 14, marginLeft: "auto", marginRight: "auto",
          boxShadow: "0 8px 32px rgba(76,175,125,0.35)",
        }}>🏡</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: "#fff", fontWeight: 600, letterSpacing: "-0.3px" }}>
          G&I Holdings
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Tenant Portal</div>
      </div>

      <div style={{
        background: "#fff", borderRadius: 20, padding: "28px 24px",
        width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Sign in to your portal</div>

        <div style={fieldLabel}>Email address</div>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@email.com"
          style={inputStyle}
          onKeyDown={handleKeyDown}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <div style={{ ...fieldLabel, marginTop: 12 }}>Password</div>
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
          style={inputStyle}
          onKeyDown={handleKeyDown}
        />

        {displayError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", marginTop: 12, fontSize: 13, color: "#dc2626" }}>
            {displayError}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{ ...btnStyle(loading), marginTop: 18 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
          Need help? Contact your landlord
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        © 2026 G&I Holdings LLC · All rights reserved
      </div>
    </div>
  );
}

const fieldLabel = { fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14, border: "1.5px solid #e5e7eb", outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", color: "#1a1a1a" };
const btnStyle = (loading) => ({ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loading ? "#9ca3af" : "#1b3d2a", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" });
