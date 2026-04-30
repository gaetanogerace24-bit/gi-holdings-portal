import { useState } from "react";

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("email"); // "email" or "sms"
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form"); // "form" or "sms-code"
  const [code, setCode] = useState("");

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => {
      if (mode === "sms" && step === "form") {
        setStep("sms-code");
        setLoading(false);
      } else {
        onLogin(email, password);
      }
    }, 1000);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#1b3d2a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Logo block */}
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

      {/* Card */}
      <div style={{
        background: "#fff", borderRadius: 20, padding: "28px 24px",
        width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {step === "sms-code" ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Enter your code</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>We sent a 6-digit code to {phone}</div>
            <input
              value={code} onChange={e => setCode(e.target.value)}
              placeholder="000000"
              style={{
                width: "100%", padding: "13px 14px", borderRadius: 12, fontSize: 22,
                border: "1.5px solid #e5e7eb", outline: "none", letterSpacing: 8,
                textAlign: "center", fontFamily: "'DM Sans', sans-serif", marginBottom: 14,
              }}
            />
            <button onClick={handleSubmit} style={btnStyle(loading)}>
              {loading ? "Verifying..." : "Verify & Sign in"}
            </button>
            <button onClick={() => setStep("form")} style={linkBtn}>← Back</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Sign in to your portal</div>

            {/* Toggle */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
              {["email", "sms"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, border: "none",
                  background: mode === m ? "#fff" : "transparent",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  color: mode === m ? "#1b3d2a" : "#6b7280", cursor: "pointer",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}>
                  {m === "email" ? "📧 Email" : "📱 SMS"}
                </button>
              ))}
            </div>

            {mode === "email" ? (
              <>
                <div style={fieldLabel}>Email address</div>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inputStyle} />
                <div style={{ ...fieldLabel, marginTop: 12 }}>Password</div>
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" style={inputStyle} />
              </>
            ) : (
              <>
                <div style={fieldLabel}>Phone number</div>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (410) 555-0000" style={inputStyle} />
              </>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{ ...btnStyle(loading), marginTop: 18 }}>
              {loading ? "Signing in..." : mode === "email" ? "Sign in" : "Send code"}
            </button>

            <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#9ca3af" }}>
              Need help? Contact your landlord
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        © 2026 G&I Holdings LLC · All rights reserved
      </div>
    </div>
  );
}

const fieldLabel = { fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14,
  border: "1.5px solid #e5e7eb", outline: "none", fontFamily: "'DM Sans', sans-serif",
  boxSizing: "border-box", color: "#1a1a1a",
};
const btnStyle = (loading) => ({
  width: "100%", padding: "13px", borderRadius: 12, border: "none",
  background: loading ? "#9ca3af" : "#1b3d2a", color: "#fff",
  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
});
const linkBtn = {
  width: "100%", padding: "10px", border: "none", background: "none",
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#6b7280", cursor: "pointer", marginTop: 6,
};
