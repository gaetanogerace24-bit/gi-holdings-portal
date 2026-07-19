import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const DEFAULTS = {
  companyName: "G&I Holdings LLC",
  email: "tenants@giholdings.com",
  phone: "(330) 969-6464",
  city: "Youngstown, OH",
  rentDueDay: "1",
  initialLateFee: "35",
  dailyLateFee: "10",
  reminderDaysBefore: "3",
  adminEmail: "gaetano@giholdings.com",
  adminPassword: "GIHoldings2026!",
};

async function saveFields(fields) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "portal_settings")
    .maybeSingle();
  const latest = { ...DEFAULTS, ...(data?.value || {}) };
  const merged = { ...latest, ...fields };
  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: "portal_settings", value: merged, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw error;
  return merged;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [reminderStatus, setReminderStatus] = useState("idle");
  const [ownerStatus, setOwnerStatus] = useState("idle");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "portal_settings")
          .maybeSingle();
        setSettings({ ...DEFAULTS, ...(data?.value || {}) });
      } catch (e) {
        console.error("Failed to load settings:", e);
        setSettings(DEFAULTS);
      }
    }
    load();
  }, []);

  if (settings === null) {
    return (
      <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, marginBottom: 8 }}>Settings</h1>
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleSaveCompany = async () => {
    setCompanyStatus("saving");
    try {
      const merged = await saveFields({
        companyName: settings.companyName,
        email: settings.email,
        phone: settings.phone,
        city: settings.city,
      });
      setSettings(merged);
      setCompanyStatus("saved");
      setTimeout(() => setCompanyStatus("idle"), 3000);
    } catch (e) {
      console.error("Save failed:", e);
      setCompanyStatus("error");
      setTimeout(() => setCompanyStatus("idle"), 3000);
    }
  };

  const handleSaveReminder = async () => {
    setReminderStatus("saving");
    try {
      const merged = await saveFields({
        reminderDaysBefore: settings.reminderDaysBefore,
      });
      setSettings(merged);
      setReminderStatus("saved");
      setTimeout(() => setReminderStatus("idle"), 3000);
    } catch (e) {
      console.error("Save failed:", e);
      setReminderStatus("error");
      setTimeout(() => setReminderStatus("idle"), 3000);
    }
  };

  const handleSaveOwner = async () => {
    setOwnerStatus("saving");
    try {
      const merged = await saveFields({
        adminEmail: settings.adminEmail,
        adminPassword: settings.adminPassword,
      });
      setSettings(merged);
      setOwnerStatus("saved");
      setTimeout(() => setOwnerStatus("idle"), 3000);
    } catch (e) {
      console.error("Save failed:", e);
      setOwnerStatus("error");
      setTimeout(() => setOwnerStatus("idle"), 3000);
    }
  };

  return (
    <div className="admin-page-content" style={{ padding: 28, maxWidth: 740, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Settings</h1>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Manage your company info and notifications</div>
      </div>

      <Section title="🏢 Company info">
        <Grid>
          <Field label="Company name" value={settings.companyName} onChange={v => update("companyName", v)} />
          <Field label="Tenant contact email" value={settings.email} onChange={v => update("email", v)} />
          <Field label="Phone number" value={settings.phone} onChange={v => update("phone", v)} />
          <Field label="State" value={settings.city} onChange={v => update("city", v)} />
        </Grid>
        <SaveButton status={companyStatus} onClick={handleSaveCompany} label="Save company info" />
      </Section>

      <Section title="🔔 Automatic rent reminders">
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          Send tenants an early reminder X days before rent is due on the 1st.
        </div>
        <Field label="Send reminder X days before rent is due" value={settings.reminderDaysBefore} onChange={v => update("reminderDaysBefore", v)} type="number" />
        <SaveButton status={reminderStatus} onClick={handleSaveReminder} label="Save reminder setting" />
      </Section>

      <Section title="🔐 Owner login credentials">
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          ⚠️ These are your owner login credentials.
        </div>
        <Grid>
          <Field label="Owner email" value={settings.adminEmail} onChange={v => update("adminEmail", v)} type="email" />
          <Field label="Owner password" value={settings.adminPassword} onChange={v => update("adminPassword", v)} />
        </Grid>
        <SaveButton status={ownerStatus} onClick={handleSaveOwner} label="Save owner login" />
      </Section>
    </div>
  );
}

function SaveButton({ status, onClick, label }) {
  return (
    <button onClick={onClick} disabled={status === "saving"} style={{
      marginTop: 16,
      background: status === "saved" ? "#4caf7d" : status === "error" ? "#dc2626" : status === "saving" ? "#9ca3af" : "#1b3d2a",
      color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px",
      fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700,
      cursor: status === "saving" ? "not-allowed" : "pointer", transition: "background 0.2s",
    }}>
      {status === "saving" ? "Saving..." : status === "saved" ? "✅ Saved!" : status === "error" ? "❌ Error — try again" : label}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div className="two-col-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
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
