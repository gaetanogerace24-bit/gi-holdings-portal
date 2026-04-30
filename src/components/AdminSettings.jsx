import { useState } from "react";

export default function AdminSettings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    companyName: "G&I Holdings LLC",
    email: "tenants@giholdings.com",
    phone: "(410) 555-0144",
    address: "Baltimore, MD",
    dueDay: "1",
    gracePeriod: "5",
    lateFeeType: "flat",
    lateFeeAmount: "150",
    lateFeePercent: "5",
    reminderDaysBefore: "3",
    reminderOnDueDate: true,
    reminderAfterDue: true,
  });

  const update = (key, val) => setSettings({ ...settings, [key]: val });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Settings</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Manage your portal, fees, and notifications</div>
      </div>

      {/* Company info */}
      <Section title="Company info">
        <Grid>
          <Field label="Company name" value={settings.companyName} onChange={v => update("companyName", v)} />
          <Field label="Contact email" value={settings.email} onChange={v => update("email", v)} />
          <Field label="Phone number" value={settings.phone} onChange={v => update("phone", v)} />
          <Field label="City / State" value={settings.address} onChange={v => update("address", v)} />
        </Grid>
      </Section>

      {/* Rent & late fees */}
      <Section title="Rent & late fees">
        <Grid>
          <Field label="Rent due day of month" value={settings.dueDay} onChange={v => update("dueDay", v)} type="number" hint="e.g. 1 = 1st of month" />
          <Field label="Grace period (days)" value={settings.gracePeriod} onChange={v => update("gracePeriod", v)} type="number" hint="Days before late fee applies" />
        </Grid>

        <div style={{ marginBottom: 16 }}>
          <Label>Late fee type</Label>
          <div style={{ display: "flex", gap: 10 }}>
            {[["flat", "Flat fee ($)"], ["percent", "Percentage (%)"]].map(([val, label]) => (
              <button key={val} onClick={() => update("lateFeeType", val)} style={{
                flex: 1, padding: "10px", borderRadius: 10,
                border: settings.lateFeeType === val ? "2px solid #1b3d2a" : "1.5px solid #e5e7eb",
                background: settings.lateFeeType === val ? "#f0f9f4" : "#fff",
                color: settings.lateFeeType === val ? "#1b3d2a" : "#6b7280",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {settings.lateFeeType === "flat" ? (
          <Field label="Flat late fee amount ($)" value={settings.lateFeeAmount} onChange={v => update("lateFeeAmount", v)} type="number" hint="e.g. $150 flat fee" />
        ) : (
          <Field label="Late fee percentage (%)" value={settings.lateFeePercent} onChange={v => update("lateFeePercent", v)} type="number" hint="e.g. 5% of monthly rent" />
        )}
      </Section>

      {/* Notifications */}
      <Section title="Automatic reminders">
        <Field label="Send reminder X days before due date" value={settings.reminderDaysBefore} onChange={v => update("reminderDaysBefore", v)} type="number" hint="e.g. 3 days before the 1st" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {[
            ["reminderOnDueDate", "Send reminder on due date"],
            ["reminderAfterDue", "Send reminder when payment is overdue"],
          ].map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f9fafb", borderRadius: 10 }}>
              <span style={{ fontSize: 14, color: "#1a1a1a" }}>{label}</span>
              <div
                onClick={() => update(key, !settings[key])}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                  background: settings[key] ? "#1b3d2a" : "#d1d5db",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3, transition: "left 0.2s",
                  left: settings[key] ? 23 : 3,
                }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Save */}
      <button onClick={handleSave} style={{
        background: saved ? "#4caf7d" : "#1b3d2a", color: "#fff", border: "none",
        borderRadius: 12, padding: "14px 32px", fontFamily: "'DM Sans', sans-serif",
        fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
      }}>
        {saved ? "✅ Saved!" : "Save settings"}
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
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>{children}</div>;
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function Field({ label, value, onChange, type = "text", hint }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Label>{label}</Label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box" }}
      />
      {hint && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
