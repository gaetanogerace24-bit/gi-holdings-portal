import { useState, useEffect } from "react";
import { saveSettings, loadSettings } from "../storage";

export default function AdminSettings({ supabase }) {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    companyName: "G&I Holdings LLC",
    email: "tenants@giholdings.com",
    phone: "(410) 555-0144",
    city: "Baltimore, MD",
    rentDueDay: "1",
    gracePeriodDays: "0",
    initialLateFee: "35",
    dailyLateFee: "10",
    reminderDaysBefore: "3",
    reminderOnDueDate: true,
    reminderWhenLate: true,
    reminderDailyWhileLate: false,
    adminEmail: "gaetano@giholdings.com",
    adminPassword: "GIHoldings2026!",
  });

  const update = (key, val) => setSettings({ ...settings, [key]: val });

  // Auto-save to localStorage whenever settings change
  useEffect(() => {
    try { localStorage.setItem("gi_settings", JSON.stringify(settings)); } catch(e) {}
  }, [settings]);

  const handleSave = async () => {
    try { localStorage.setItem("gi_settings", JSON.stringify(settings)); } catch(e) {}
    if (supabase) {
      await supabase.from("settings").upsert({ key: "portal_settings", value: settings, updated_at: new Date().toISOString() });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ padding: 28, maxWidth: 740, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Settings</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Manage your company info, late fees, and notifications</div>
      </div>

      {/* Company */}
      <Section title="🏢 Company info">
        <Grid>
          <Field label="Company name" value={settings.companyName} onChange={v => update("companyName", v)} />
          <Field label="Tenant contact email" value={settings.email} onChange={v => update("email", v)} />
          <Field label="Phone number" value={settings.phone} onChange={v => update("phone", v)} />
          <Field label="City / State" value={settings.city} onChange={v => update("city", v)} />
        </Grid>
      </Section>

      {/* Late fees */}
      <Section title="💰 Rent & late fee rules">
            <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          <strong>Current rules:</strong> Rent due the {settings.rentDueDay}st · $
          {settings.initialLateFee} late fee on the {Number(settings.rentDueDay) + 4}th · then $
          {settings.dailyLateFee}/day every day after until paid
        </div>
        <Grid>
          <Field label="Rent due — day of month" value={settings.rentDueDay} onChange={v => update("rentDueDay", v)} type="number" hint="e.g. 1 = 1st of month" />
          <Field label="Late fee start day" value={String(Number(settings.rentDueDay) + 4)} onChange={() => {}} type="number" hint="Auto-calculated (due day + 4)" />
          <Field label="Initial late fee ($)" value={settings.initialLateFee} onChange={v => update("initialLateFee", v)} type="number" hint="Charged on the 5th of the month" />
          <Field label="Daily late fee ($)" value={settings.dailyLateFee} onChange={v => update("dailyLateFee", v)} type="number" hint="Per day after the 5th until paid" />
        </Grid>
      </Section>

      {/* Reminders */}
      <Section title="🔔 Automatic reminders">
        <Field label="Send reminder X days before rent is due" value={settings.reminderDaysBefore} onChange={v => update("reminderDaysBefore", v)} type="number" hint={`e.g. 3 days before the ${settings.rentDueDay}st`} />
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["reminderOnDueDate", "Send reminder on rent due date"],
            ["reminderWhenLate", "Send reminder when payment is overdue"],
            ["reminderDailyWhileLate", "Send daily reminder while late (until paid)"],
          ].map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 14, color: "#1a1a1a" }}>{label}</span>
              <div onClick={() => update(key, !settings[key])} style={{
                width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                background: settings[key] ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s",
              }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: settings[key] ? 23 : 3, transition: "left 0.2s" }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Admin login */}
      <Section title="🔐 Owner login credentials">
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          ⚠️ Change these after deploying. This is how you log in as the owner.
        </div>
        <Grid>
          <Field label="Owner email" value={settings.adminEmail} onChange={v => update("adminEmail", v)} type="email" />
          <Field label="Owner password" value={settings.adminPassword} onChange={v => update("adminPassword", v)} type="text" />
        </Grid>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Note: Update this in App.jsx to take effect · Supabase auth coming next!</div>
      </Section>

      <button onClick={handleSave} style={{
        background: saved ? "#4caf7d" : "#1b3d2a", color: "#fff", border: "none",
        borderRadius: 12, padding: "14px 36px", fontFamily: "'DM Sans', sans-serif",
        fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
      }}>
        {saved ? "✅ Settings saved!" : "Save settings"}
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1a1a1a" }}>{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}
function Field({ label, value, onChange, type = "text", hint }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" }} />
      {hint && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
const selectSt = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" };
