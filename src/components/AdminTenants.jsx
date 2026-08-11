import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const EMPTY_FORM = { name: "", email: "", phone: "", unit: "", address: "", rent: "", leaseStart: "", leaseEnd: "", notes: "", public_note: "", deposit: "", section8: false, section8Amount: "", tenantPortion: "", monthToMonth: false, loginEmail: "", customLateFee: false, lateFeeStartDay: "", initialLateFee: "", dailyLateFee: "", proratedFirst: false, proratedMoveInDate: "" };
const DOC_CATEGORIES = ["Lease agreement", "Move-in inspection", "Community rules", "Other"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function generateLeaseInvoices(tenantId, leaseStart, leaseEnd, rent, tenantName, tenantAddress) {
  if (!leaseStart || !leaseEnd || !rent) return 0;
  const startStr = leaseStart.split("T")[0];
  const endStr = leaseEnd.split("T")[0];
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return 0;
  const start = new Date(sy, sm - 1, 1);
  const end = new Date(ey, em - 1, 1);
  if (end <= start) return 0;

  // Build the full list of invoices this lease term should have
  const allInvoices = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const year = cursor.getFullYear();
    const monthNum = cursor.getMonth() + 1;
    const monthName = MONTH_NAMES[cursor.getMonth()];
    allInvoices.push({
      tenant_id: tenantId, tenant_name: tenantName || null, tenant_address: tenantAddress || null,
      month: `${monthName} ${year}`, year, month_num: monthNum,
      rent: Number(rent), late_fee: 0, total: Number(rent), paid: false,
      due_date: `${year}-${String(monthNum).padStart(2, "0")}-01`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const endDay = ed || 1;
  const daysInEndMonth = new Date(ey, em, 0).getDate();
  if (endDay > 1) {
    const proratedRent = Math.round((Number(rent) / daysInEndMonth) * endDay * 100) / 100;
    allInvoices.push({
      tenant_id: tenantId, tenant_name: tenantName || null, tenant_address: tenantAddress || null,
      month: `${MONTH_NAMES[em - 1]} ${ey} (Prorated ${endDay} days)`,
      year: ey, month_num: em, rent: proratedRent, late_fee: 0, total: proratedRent, paid: false,
      due_date: `${ey}-${String(em).padStart(2, "0")}-01`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  }

  // Fetch ALL existing invoices for this tenant (including soft-deleted)
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, due_date, paid, deleted, rent")
    .eq("tenant_id", tenantId);

  const existingAll = existing || [];

  // Hard delete soft-deleted invoices that overlap with what we're about to create
  const dueDatesToGenerate = new Set(allInvoices.map(inv => inv.due_date));
  const toHardDelete = existingAll.filter(inv => inv.deleted && dueDatesToGenerate.has(inv.due_date));
  if (toHardDelete.length > 0) {
    await supabase.from("invoices").delete().in("id", toHardDelete.map(i => i.id));
  }

  // Also delete unpaid invoices where the rent amount changed (not paid ones — leave those alone)
  const toUpdateRent = existingAll.filter(inv =>
    !inv.deleted && !inv.paid && dueDatesToGenerate.has(inv.due_date) &&
    Number(inv.rent) !== Number(rent)
  );
  if (toUpdateRent.length > 0) {
    await supabase.from("invoices").delete().in("id", toUpdateRent.map(i => i.id));
  }

  // Re-fetch after deletions to get current state
  const { data: afterDelete } = await supabase
    .from("invoices")
    .select("due_date")
    .eq("tenant_id", tenantId)
    .eq("deleted", false);

  const existingDates = new Set((afterDelete || []).map(inv => inv.due_date));

  // Only insert invoices whose due_date doesn't already exist
  const toInsert = allInvoices.filter(inv => !existingDates.has(inv.due_date));

  if (toInsert.length > 0) {
    await supabase.from("invoices").insert(toInsert);
  }

  return toInsert.length;
}

export default function AdminTenants({ tenants, setTenants, onInvoicesChanged, onNavigateToDocuments, isActive }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedDocs, setExpandedDocs] = useState(null);
  const [docForm, setDocForm] = useState({ name: "", category: "Lease agreement", url: "" });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [regenMsg, setRegenMsg] = useState(null);
  const [showAccess, setShowAccess] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accessSaved, setAccessSaved] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [showProrated, setShowProrated] = useState(false);
  const [proratedMoveIn, setProratedMoveIn] = useState("");
  const [sendingProrated, setSendingProrated] = useState(false);
  const [proratedMsg, setProratedMsg] = useState(null);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setRegenMsg(null); setShowAccess(false); };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({
      ...t,
      rent: String(t.rent || ""),
      deposit: String(t.deposit || ""),
      email: t.email || "",
      loginEmail: t.login_email || t.email || "",
      phone: t.phone || "",
      leaseStart: t.leaseStart || t.lease_start || "",
      leaseEnd: t.leaseEnd || t.lease_end || "",
      section8Amount: t.section8Amount || t.section8_amount || "",
      tenantPortion: t.tenantPortion || t.tenant_portion || "",
      public_note: t.public_note || "",
      notes: t.notes || "",
      monthToMonth: t.month_to_month || t.monthToMonth || false,
      customLateFee: Boolean(t.custom_late_fee),
      lateFeeStartDay: String(t.late_fee_start_day || ""),
      initialLateFee: String(t.initial_late_fee || ""),
      dailyLateFee: String(t.daily_late_fee || ""),
    });
    setShowForm(true);
    setRegenMsg(null);
    setShowAccess(false);
    setNewPassword("");
    setAccessSaved(false);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); setRegenMsg(null); setShowAccess(false); };

  const handleSaveAccess = async () => {
    if (!editing || !form.loginEmail) return;
    setSavingAccess(true);
    const updates = { login_email: form.loginEmail.trim(), updated_at: new Date().toISOString() };
    if (newPassword.trim()) updates.portal_password = newPassword.trim();
    await supabase.from("tenants").update(updates).eq("id", editing);
    setTenants(tenants.map(t => t.id === editing ? { ...t, login_email: form.loginEmail.trim(), portal_password: newPassword || t.portal_password } : t));
    setAccessSaved(true);
    setSavingAccess(false);
    setTimeout(() => setAccessSaved(false), 3000);
    setNewPassword("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const tenantData = {
      name: form.name, email: form.email || "", phone: form.phone || "",
      unit: form.unit || "", address: form.address || "",
      rent: Number(form.rent) || 0, deposit: Number(form.deposit) || 0,
      lease_start: form.leaseStart || "", lease_end: form.leaseEnd || "",
      notes: form.notes || "", public_note: form.public_note || "",
      section8: Boolean(form.section8),
      section8_amount: Number(form.section8Amount || form.section8_amount) || 0,
      tenant_portion: Number(form.tenantPortion || form.tenant_portion) || 0,
      month_to_month: Boolean(form.monthToMonth),
      custom_late_fee: Boolean(form.customLateFee),
      late_fee_start_day: form.customLateFee && form.lateFeeStartDay ? Number(form.lateFeeStartDay) : null,
      initial_late_fee: form.customLateFee && form.initialLateFee ? Number(form.initialLateFee) : null,
      daily_late_fee: form.customLateFee && form.dailyLateFee ? Number(form.dailyLateFee) : null,
      emergency: "(330) 969-6464", contact_email: "tenants@giholdings.com",
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const existing = tenants.find(t => t.id === editing);
      if (existing && !existing.login_email) {
        tenantData.login_email = form.email || "";
      }
      await supabase.from("tenants").update(tenantData).eq("id", editing);
      const { data: fresh } = await supabase.from("tenants").select("*").eq("id", editing).single();
      if (fresh) {
        setTenants(tenants.map(t => t.id === editing ? {
          ...fresh, leaseStart: fresh.lease_start, leaseEnd: fresh.lease_end,
          section8Amount: fresh.section8_amount, tenantPortion: fresh.tenant_portion,
          monthToMonth: fresh.month_to_month, contactEmail: fresh.contact_email, documents: fresh.documents || [],
        } : t));
      }
    } else {
      const { data } = await supabase.from("tenants").insert({ ...tenantData, login_email: form.email || "", paid: false, documents: [] }).select().single();
      if (data) {
        setTenants([...tenants, { ...data, leaseStart: data.lease_start, leaseEnd: data.lease_end, section8Amount: data.section8_amount, tenantPortion: data.tenant_portion, monthToMonth: data.month_to_month }]);

        // Create prorated invoice if toggled on
        if (form.proratedFirst && form.proratedMoveInDate && form.rent) {
          const d = new Date(form.proratedMoveInDate);
          const year = d.getFullYear();
          const month = d.getMonth();
          const day = d.getDate();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const daysRemaining = daysInMonth - day + 1;
          const rentAmount = form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0);
          const proratedAmount = Math.round((rentAmount / daysInMonth) * daysRemaining * 100) / 100;
          const monthName = `${MONTH_NAMES[month]} ${year}`;
          const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          await supabase.from("invoices").insert({
            tenant_id: data.id,
            month: `${monthName} — Prorated (${daysRemaining} days)`,
            year, month_num: month + 1,
            rent: proratedAmount, late_fee: 0, total: proratedAmount,
            paid: false, due_date: dueDate, is_custom: true,
            tenant_name: form.name || null,
            tenant_address: form.address || null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          });
        }
      }
    }
    setSaving(false);
    closeForm();
  };

  const handleRegenerate = async () => {
    if (!editing || !form.leaseStart || !form.leaseEnd) return;
    setRegenerating(true);
    setRegenMsg(null);
    const currentTenantData = tenants.find(t => t.id === editing);
    const count = await generateLeaseInvoices(editing, form.leaseStart, form.leaseEnd, form.rent, currentTenantData?.name, currentTenantData?.address);
    if (onInvoicesChanged) await onInvoicesChanged();
    setRegenMsg(
      count > 0
        ? `✅ ${count} new invoice${count !== 1 ? "s" : ""} added for the lease term.`
        : `✅ All invoices are already up to date — nothing to add.`
    );
    setRegenerating(false);
  };

  const handleGenerateNextMonth = async () => {
    if (!editing) return;
    setGeneratingNext(true);
    const now = new Date();
    const targetYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const targetMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    const targetMonthNum = targetMonth + 1;
    const targetDueDate = `${targetYear}-${String(targetMonthNum).padStart(2,"0")}-01`;
    const targetMonthName = `${MONTH_NAMES[targetMonth]} ${targetYear}`;

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("tenant_id", editing)
      .eq("due_date", targetDueDate)
      .eq("deleted", false);

    if (existing && existing.length > 0) {
      setRegenMsg(`✅ ${targetMonthName} invoice already exists — nothing to add.`);
    } else {
      const rentAmount = form.section8
        ? Number(form.tenantPortion || form.tenant_portion || 0)
        : Number(form.rent || 0);
      await supabase.from("invoices").insert({
        tenant_id: editing, month: targetMonthName, year: targetYear,
        month_num: targetMonthNum, rent: rentAmount, late_fee: 0, total: rentAmount,
        paid: false, due_date: targetDueDate,
        tenant_name: form.name || null,
        tenant_address: form.address || null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (onInvoicesChanged) await onInvoicesChanged();
      setRegenMsg(`✅ ${targetMonthName} invoice created for $${rentAmount.toLocaleString()}.`);
    }
    setGeneratingNext(false);
  };

  const handleSendProrated = async () => {
    if (!editing || !proratedMoveIn) return;
    setSendingProrated(true);
    setProratedMsg(null);

    const moveIn = new Date(proratedMoveIn);
    const year = moveIn.getFullYear();
    const month = moveIn.getMonth(); // 0-indexed
    const day = moveIn.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemaining = daysInMonth - day + 1;
    const rentAmount = form.section8
      ? Number(form.tenantPortion || form.tenant_portion || 0)
      : Number(form.rent || 0);
    const proratedAmount = Math.round((rentAmount / daysInMonth) * daysRemaining * 100) / 100;
    const monthName = `${MONTH_NAMES[month]} ${year}`;
    const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    await supabase.from("invoices").insert({
      tenant_id: editing,
      month: `${monthName} — Prorated (${daysRemaining} days)`,
      year, month_num: month + 1,
      rent: proratedAmount, late_fee: 0, total: proratedAmount,
      paid: false, due_date: dueDate,
      is_custom: true,
      tenant_name: form.name || null,
      tenant_address: form.address || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });

    if (onInvoicesChanged) await onInvoicesChanged();
    setProratedMsg(`✅ Prorated invoice created — $${proratedAmount.toFixed(2)} for ${daysRemaining} days in ${monthName}. Toggle again to generate another.`);
    setShowProrated(false);
    setProratedMoveIn("");
    setSendingProrated(false);
  };

  const handleRemove = async (id, name) => {
    if (window.confirm(`Remove ${name}? This cannot be undone.`)) {
      await supabase.from("properties").update({ tenant_id: null, status: "vacant", planner_stage: "vacant" }).eq("tenant_id", id);
      await supabase.from("tenants").delete().eq("id", id);
      setTenants(tenants.filter(t => t.id !== id));
    }
  };

  const addDocument = async (tenantId) => {
    if (!docForm.name.trim()) return;
    const doc = { ...docForm, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), id: Date.now() };
    const tenant = tenants.find(t => t.id === tenantId);
    const newDocs = [...(tenant?.documents || []), doc];
    await supabase.from("tenants").update({ documents: newDocs, updated_at: new Date().toISOString() }).eq("id", tenantId);
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, documents: newDocs } : t));
    setDocForm({ name: "", category: "Lease agreement", url: "" });
  };

  const removeDocument = async (tenantId, docId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    const newDocs = (tenant?.documents || []).filter(d => d.id !== docId);
    await supabase.from("tenants").update({ documents: newDocs, updated_at: new Date().toISOString() }).eq("id", tenantId);
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, documents: newDocs } : t));
  };

  const invoicePreview = (() => {
    if (form.monthToMonth || !form.leaseStart || !form.leaseEnd) return null;
    try {
      const [sy, sm] = form.leaseStart.split("T")[0].split("-").map(Number);
      const [ey, em, ed] = form.leaseEnd.split("T")[0].split("-").map(Number);
      const start = new Date(sy, sm - 1, 1);
      const end = new Date(ey, em - 1, 1);
      if (!sy || !sm || !ey || !em || end <= start) return null;
      let count = 0;
      const cursor = new Date(start);
      while (cursor < end) { count++; cursor.setMonth(cursor.getMonth() + 1); }
      const endDay = ed || 1;
      const daysInEndMonth = new Date(ey, em, 0).getDate();
      const isProrated = endDay > 1;
      if (isProrated) count++;
      const proratedRent = isProrated ? Math.round((Number(form.rent) / daysInEndMonth) * endDay * 100) / 100 : null;
      return { count, startLabel: `${MONTH_NAMES[sm-1]} ${sy}`, endLabel: `${MONTH_NAMES[em-1]} ${ey}`, isProrated, proratedRent, endDay };
    } catch { return null; }
  })();

  const currentTenant = tenants.find(t => t.id === editing);
  const currentPassword = currentTenant?.portal_password || "—";
  const [showLeaseOverview, setShowLeaseOverview] = useState(false);
  const [showS8Inspections, setShowS8Inspections] = useState(false);
  const [inspectionHistory, setInspectionHistory] = useState([]);
  const [selectedS8TenantId, setSelectedS8TenantId] = useState(null);

  useEffect(() => {
    if (isActive === false) {
      setShowLeaseOverview(false);
      setShowS8Inspections(false);
      setExpandedDocs(null);
      setShowForm(false);
      setSelectedS8TenantId(null);
    }
  }, [isActive]);

  const loadInspectionHistory = async () => {
    const { data } = await supabase
      .from("inspection_history")
      .select("*, properties(address, planner_stage), tenants(name, section8, section8_amount, tenant_portion, rent)")
      .order("inspected_at", { ascending: false });
    setInspectionHistory(data || []);
  };

  const getLeaseInfo = (t) => {
    const end = t.leaseEnd || t.lease_end;
    const start = t.leaseStart || t.lease_start;
    if (t.month_to_month || t.monthToMonth || !end) return { status: "month-to-month", label: "Month-to-month", start, end: null };
    const today = new Date(); today.setHours(0,0,0,0);
    const endDate = new Date(end); endDate.setHours(0,0,0,0);
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const status = daysLeft < 0 ? "expired" : daysLeft <= 90 ? "warning" : "ok";
    const months = Math.floor(Math.abs(daysLeft) / 30);
    const days = Math.abs(daysLeft) % 30;
    const label = daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? "Expires today!" : `${months > 0 ? months + "mo " : ""}${days}d left`;
    return { daysLeft, status, label, start, end };
  };

  const activeTenants = tenants.filter(t => !t.archived);

  return (
    <div className="admin-page-content" style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Tenants & Units</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {activeTenants.length === 0 ? "No tenants yet" : `${activeTenants.length} tenant${activeTenants.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setShowLeaseOverview(!showLeaseOverview); setShowS8Inspections(false); }} style={{ ...outlineBtn, fontSize: 13, padding: "10px 16px", borderColor: showLeaseOverview ? "#1b3d2a" : "#e5e7eb", color: showLeaseOverview ? "#1b3d2a" : "#374151", fontWeight: 600 }}>
            📅 Lease Overview
          </button>
          <button onClick={() => { const next = !showS8Inspections; setShowS8Inspections(next); setShowLeaseOverview(false); if (next) loadInspectionHistory(); }} style={{ ...outlineBtn, fontSize: 13, padding: "10px 16px", borderColor: showS8Inspections ? "#1b3d2a" : "#e5e7eb", color: showS8Inspections ? "#1b3d2a" : "#374151", fontWeight: 600 }}>
            🏠 S8 Inspections
          </button>
          <button onClick={openAdd} style={greenBtn}>+ Add tenant</button>
        </div>
      </div>

      {showLeaseOverview && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>📅 Lease Overview</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>⚠️ Warning shown when lease ends within 90 days</div>
          </div>
          <div>
            {activeTenants.map((t, i) => {
              const info = getLeaseInfo(t);
              const badgeColor = info.status === "expired" ? "#dc2626" : info.status === "warning" ? "#d97706" : info.status === "month-to-month" ? "#6b7280" : "#16a34a";
              const badgeBg = info.status === "expired" ? "#fef2f2" : info.status === "warning" ? "#fffbeb" : info.status === "month-to-month" ? "#f3f4f6" : "#f0fdf4";
              const icon = info.status === "expired" ? "🔴 " : info.status === "warning" ? "⚠️ " : info.status === "month-to-month" ? "🔄 " : "✅ ";
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 160px", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i < activeTenants.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Start</div>
                    <div style={{ fontSize: 13, color: "#1a1a1a" }}>{info.start ? new Date(info.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>End</div>
                    <div style={{ fontSize: 13, color: "#1a1a1a" }}>{info.end ? new Date(info.end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: badgeColor, background: badgeBg, border: `1.5px solid ${badgeColor}`, borderRadius: 20, padding: "4px 12px", display: "inline-block" }}>
                      {icon}{info.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showS8Inspections && (() => {
        const tenantsWithHistory = new Set(inspectionHistory.filter(h => h.inspection_date).map(h => h.tenant_id));
        const s8Tenants = activeTenants.filter(t => t.section8 && tenantsWithHistory.has(t.id));
        const today = new Date(); today.setHours(0,0,0,0);
        const activeCount = s8Tenants.filter(t => inspectionHistory.find(h => h.tenant_id === t.id && !h.completed_at)).length;
        const selected = selectedS8TenantId ? s8Tenants.find(t => t.id === selectedS8TenantId) : null;

        if (selected) {
          const tenantHistory = inspectionHistory.filter(h => h.tenant_id === selected.id).sort((a, b) => new Date(b.inspected_at) - new Date(a.inspected_at));
          const current = tenantHistory.find(h => !h.completed_at);
          const past = tenantHistory.filter(h => h.completed_at);
          const inspDate = current?.inspection_date ? new Date(current.inspection_date + "T00:00:00") : null;
          const daysUntil = inspDate ? Math.ceil((inspDate - today) / (1000 * 60 * 60 * 24)) : null;
          const initials = selected.name.split(" ").map(n => n[0]).join("").slice(0, 2);
          return (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 24, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setSelectedS8TenantId(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" }}>←</button>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{selected.address}</div>
                {current && <span style={{ marginLeft: "auto", background: "#fffbeb", color: "#d97706", border: "1.5px solid #d97706", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>🔍 In inspection</span>}
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{selected.name} · ${(Number(selected.section8_amount || 0) + Number(selected.tenant_portion || 0)).toLocaleString()}/mo</div>
                {current && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Inspection date</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{inspDate ? inspDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                    </div>
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Days until</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: daysUntil <= 3 ? "#dc2626" : "#d97706" }}>{daysUntil !== null ? (daysUntil === 0 ? "Today!" : daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`) : "—"}</div>
                    </div>
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Notes</div>
                      <div style={{ fontSize: 13, color: current.notes ? "#1a1a1a" : "#9ca3af", fontStyle: current.notes ? "normal" : "italic" }}>{current.notes || "No notes added"}</div>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: past.length > 0 ? 16 : 0 }}>
                  {current && (
                    <button onClick={async () => {
                      if (!confirm("Remove this inspection record?")) return;
                      await supabase.from("inspection_history").delete().eq("id", current.id);
                      setInspectionHistory(prev => prev.filter(h => h.id !== current.id));
                      setSelectedS8TenantId(null);
                    }} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>🗑 Remove</button>
                  )}
                  {!current && tenantHistory.length > 0 && (
                    <button onClick={async () => {
                      if (!confirm("Remove all inspection records for this property?")) return;
                      const ids = tenantHistory.map(h => h.id);
                      await supabase.from("inspection_history").delete().in("id", ids);
                      setInspectionHistory(prev => prev.filter(h => !ids.includes(h.id)));
                      setSelectedS8TenantId(null);
                    }} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>🗑 Remove</button>
                  )}
                </div>
                {past.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Past inspections</div>
                    {past.map(h => (
                      <div key={h.id} style={{ padding: "8px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{h.inspection_date ? new Date(h.inspection_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, fontStyle: h.notes ? "normal" : "italic" }}>{h.notes || "No notes"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 24, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>🏠 Section 8 inspection history</div>
              {activeCount > 0 && <span style={{ background: "#fffbeb", color: "#d97706", border: "1.5px solid #d97706", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{activeCount} active</span>}
            </div>
            {s8Tenants.length === 0 ? (
              <div style={{ padding: "24px 20px", color: "#9ca3af", fontSize: 14 }}>No Section 8 inspections yet.</div>
            ) : s8Tenants.map((t, i) => {
              const current = inspectionHistory.find(h => h.tenant_id === t.id && !h.completed_at);
              const initials = t.name.split(" ").map(n => n[0]).join("").slice(0, 2);
              return (
                <div key={t.id} onClick={() => setSelectedS8TenantId(t.id)} style={{ padding: "14px 20px", borderBottom: i < s8Tenants.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#166534", flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{t.address}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.name}</div>
                  </div>
                  {current ? (
                    <span style={{ background: "#fffbeb", color: "#d97706", border: "1.5px solid #d97706", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>🔍 In inspection</span>
                  ) : (
                    <span style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 10px", fontSize: 11 }}>Past</span>
                  )}
                  <span style={{ color: "#9ca3af", fontSize: 16 }}>›</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "2px solid #4caf7d", marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a", marginBottom: 20 }}>{editing ? "📋 Tenant Information" : "➕ Add new tenant"}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <FormField label="Full name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Gary Thornton" />
            <FormField label="Monthly rent ($)" value={form.rent} onChange={v => setForm({ ...form, rent: v })} placeholder="e.g. 900" type="number" />
            <FormField label="Property address" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="510 W Evergreen Ave, Youngstown OH" />
            <FormField label="Security deposit ($)" value={form.deposit} onChange={v => setForm({ ...form, deposit: v })} placeholder="e.g. 850" type="number" />
            <FormField label="Contact email" value={form.email || ""} onChange={v => setForm({ ...form, email: v })} placeholder="tenant@email.com" type="email" />
            <FormField label={<>Phone <span style={{ color: "#1a1a1a", fontWeight: 400, textTransform: "none" }}>(Add +1)</span></>} value={form.phone || ""} onChange={v => setForm({ ...form, phone: v })} placeholder="+1 (330) 555-0000" />
            <FormField label="Lease start" value={form.leaseStart || ""} onChange={v => setForm({ ...form, leaseStart: v })} type="date" />
            <FormField label="Lease end" value={form.leaseEnd || ""} onChange={v => setForm({ ...form, leaseEnd: v })} type="date" disabled={form.monthToMonth} />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 14 }}>
            ℹ️ "Contact email" is just for your records — it does NOT change the tenant's portal login. Update login credentials in the section below.
          </div>

          <div style={{ padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Month-to-month lease</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>No fixed end date — invoices generate monthly on the 1st</div>
              </div>
              <Toggle on={form.monthToMonth} onToggle={() => setForm({ ...form, monthToMonth: !form.monthToMonth, leaseEnd: !form.monthToMonth ? "" : form.leaseEnd })} />
            </div>
          </div>

          {invoicePreview && editing && !form.monthToMonth && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 8, fontSize: 13, color: "#1b3d2a" }}>
                📅 <strong>{invoicePreview.count} invoice{invoicePreview.count !== 1 ? "s" : ""}</strong> covering {invoicePreview.startLabel} → {invoicePreview.endLabel}
                {invoicePreview.isProrated && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                    Last invoice prorated: {invoicePreview.endDay} days × ${invoicePreview.proratedRent?.toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleRegenerate} disabled={regenerating} style={{ flex: 1, padding: "9px 12px", background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {regenerating ? "⏳ Regenerating..." : "🔄 Regenerate lease invoices"}
                </button>
              </div>
              {regenMsg && (
                <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#1b3d2a" }}>
                  {regenMsg}
                </div>
              )}
            </div>
          )}

          {form.monthToMonth && editing && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleGenerateNextMonth} disabled={generatingNext} style={{ flex: 1, padding: "9px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {generatingNext ? "⏳ Creating..." : "➕ Generate next month's invoice"}
                </button>
              </div>
              {regenMsg && (
                <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#1b3d2a" }}>
                  {regenMsg}
                </div>
              )}

              {/* Prorated first month */}
              <div style={{ marginTop: 10, border: "1px solid #fcd34d", borderRadius: 10, background: "#fffbeb", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>📅 Prorated first month</div>
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>Charge tenant for partial month if they moved in mid-month</div>
                  </div>
                  <div onClick={() => { setShowProrated(v => !v); setProratedMsg(null); }}
                    style={{ width: 40, height: 22, borderRadius: 11, background: showProrated ? "#d97706" : "#d1d5db", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ position: "absolute", top: 2, left: showProrated ? 19 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                </div>
                {showProrated && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #fcd34d", paddingTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Move-in date</div>
                        <input type="date" value={proratedMoveIn} onChange={e => setProratedMoveIn(e.target.value)}
                          style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 12, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#fff" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Monthly rent</div>
                        <div style={{ padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 12, background: "#fff", color: "#92400e", fontWeight: 600 }}>
                          ${(form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0)).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Prorated amount</div>
                        <div style={{ padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 13, background: "#fff", color: "#92400e", fontWeight: 700 }}>
                          {(() => {
                            if (!proratedMoveIn) return "—";
                            const d = new Date(proratedMoveIn);
                            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                            const daysRemaining = daysInMonth - d.getDate() + 1;
                            const rent = form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0);
                            return `$${(Math.round((rent / daysInMonth) * daysRemaining * 100) / 100).toFixed(2)}`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <button onClick={handleSendProrated} disabled={!proratedMoveIn || sendingProrated}
                      style={{ width: "100%", padding: "9px", background: proratedMoveIn ? "#d97706" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: proratedMoveIn ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
                      {sendingProrated ? "⏳ Creating..." : "Send prorated invoice →"}
                    </button>
                  </div>
                )}
              </div>
              {proratedMsg && (
                <div style={{ background: "#f0f9f4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginTop: 8, fontSize: 13, color: "#1b3d2a" }}>
                  {proratedMsg}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: "14px 16px", background: "#f0f9f4", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1b3d2a" }}>Section 8 / Housing voucher</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Housing authority pays part of rent</div>
              </div>
              <Toggle on={form.section8} onToggle={() => setForm({ ...form, section8: !form.section8 })} />
            </div>
            {form.section8 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <FormField label="Housing pays ($/mo)" value={form.section8Amount} onChange={v => setForm({ ...form, section8Amount: v })} placeholder="e.g. 1014" type="number" />
                <FormField label="Tenant pays ($/mo)" value={form.tenantPortion} onChange={v => setForm({ ...form, tenantPortion: v })} placeholder="e.g. 261" type="number" />
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px", background: "#fffbeb", borderRadius: 10, border: "1px solid #fcd34d", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}>⚙️ Custom late fee rules</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Override global settings for this tenant only</div>
              </div>
              <Toggle on={form.customLateFee} onToggle={() => setForm({ ...form, customLateFee: !form.customLateFee })} />
            </div>
            {form.customLateFee && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                  ⚠️ These override the global Settings for this tenant.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <Label>Late fee start day</Label>
                    <input type="number" value={form.lateFeeStartDay} onChange={e => setForm({ ...form, lateFeeStartDay: e.target.value })} placeholder="e.g. 10" style={inputSt} />
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Day of month fees kick in</div>
                  </div>
                  <div>
                    <Label>Initial late fee ($)</Label>
                    <input type="number" value={form.initialLateFee} onChange={e => setForm({ ...form, initialLateFee: e.target.value })} placeholder="e.g. 35" style={inputSt} />
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Charged on start day</div>
                  </div>
                  <div>
                    <Label>Daily late fee ($)</Label>
                    <input type="number" value={form.dailyLateFee} onChange={e => setForm({ ...form, dailyLateFee: e.target.value })} placeholder="e.g. 10" style={inputSt} />
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Per day after start day</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {editing && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowAccess(!showAccess)} style={{
                width: "100%", padding: "13px 16px", background: showAccess ? "#1b3d2a" : "#f9fafb",
                border: `1.5px solid ${showAccess ? "#1b3d2a" : "#e5e7eb"}`, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🔑</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: showAccess ? "#fff" : "#1a1a1a" }}>Portal access credentials</div>
                    <div style={{ fontSize: 12, color: showAccess ? "rgba(255,255,255,0.6)" : "#9ca3af", marginTop: 1 }}>
                      {currentTenant?.login_email || form.loginEmail || "No login set"}
                    </div>
                  </div>
                </div>
                <span style={{ color: showAccess ? "#fff" : "#9ca3af", fontSize: 14 }}>{showAccess ? "▲" : "▼"}</span>
              </button>

              {showAccess && (
                <div style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "16px" }}>
                  <div style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                    ⚠️ This is the email & password the tenant uses to sign in.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <Label>Login email</Label>
                      <input value={form.loginEmail || ""} onChange={e => setForm({ ...form, loginEmail: e.target.value })} style={inputSt} placeholder="login@email.com" />
                    </div>
                    <div>
                      <Label>Current password</Label>
                      <div style={{ position: "relative" }}>
                        <input type={showPassword ? "text" : "password"} value={currentPassword} readOnly style={{ ...inputSt, background: "#f3f4f6", color: "#6b7280", paddingRight: 36 }} />
                        <button onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#9ca3af" }}>
                          {showPassword ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Label>Set new password</Label>
                    <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current password" style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={handleSaveAccess} disabled={savingAccess} style={{ ...greenBtn, fontSize: 13, padding: "9px 18px" }}>
                      {savingAccess ? "Saving..." : accessSaved ? "✅ Saved!" : "Save login credentials"}
                    </button>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Tenant logs in at giholdingsllc.com</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 14, border: "1px solid #fcd34d", borderRadius: 10, background: "#fffbeb", padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>📅 Prorated first month</div>
                <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>Charge tenant for partial month if they move in mid-month</div>
              </div>
              <div onClick={() => setForm({ ...form, proratedFirst: !form.proratedFirst })}
                style={{ width: 40, height: 22, borderRadius: 11, background: form.proratedFirst ? "#d97706" : "#d1d5db", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: form.proratedFirst ? 19 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>
            {form.proratedFirst && (
              <div style={{ marginTop: 12, borderTop: "1px solid #fcd34d", paddingTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Move-in date</div>
                    <input type="date" value={form.proratedMoveInDate} onChange={e => setForm({ ...form, proratedMoveInDate: e.target.value })}
                      style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 12, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Monthly rent</div>
                    <div style={{ padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 12, background: "#fff", color: "#92400e", fontWeight: 600 }}>
                      ${(form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0)).toLocaleString() || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>Prorated amount</div>
                    <div style={{ padding: "7px 9px", borderRadius: 7, border: "1px solid #fcd34d", fontSize: 13, background: "#fff", color: "#92400e", fontWeight: 700 }}>
                      {(() => {
                        if (!form.proratedMoveInDate || !form.rent) return "—";
                        const d = new Date(form.proratedMoveInDate);
                        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                        const daysRemaining = daysInMonth - d.getDate() + 1;
                        const rent = form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0);
                        return `$${(Math.round((rent / daysInMonth) * daysRemaining * 100) / 100).toFixed(2)}`;
                      })()}
                    </div>
                  </div>
                </div>
                {editing ? (
                  <button onClick={async () => {
                    if (!form.proratedMoveInDate || !form.rent) return;
                    const moveIn = new Date(form.proratedMoveInDate);
                    const year = moveIn.getFullYear();
                    const month = moveIn.getMonth();
                    const day = moveIn.getDate();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysRemaining = daysInMonth - day + 1;
                    const rentAmount = form.section8 ? Number(form.tenantPortion || 0) : Number(form.rent || 0);
                    const proratedAmount = Math.round((rentAmount / daysInMonth) * daysRemaining * 100) / 100;
                    const monthName = `${MONTH_NAMES[month]} ${year}`;
                    const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    await supabase.from("invoices").insert({
                      tenant_id: editing,
                      month: `${monthName} — Prorated (${daysRemaining} days)`,
                      year, month_num: month + 1,
                      rent: proratedAmount, late_fee: 0, total: proratedAmount,
                      paid: false, due_date: dueDate,
                      is_custom: true,
                      tenant_name: form.name || null,
                      tenant_address: form.address || null,
                      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                    });
                    if (onInvoicesChanged) await onInvoicesChanged();
                    alert(`✅ Prorated invoice created — $${proratedAmount.toFixed(2)} for ${daysRemaining} days in ${monthName}.`);
                    setForm({ ...form, proratedFirst: false, proratedMoveInDate: "" });
                  }} disabled={!form.proratedMoveInDate || !form.rent}
                    style={{ width: "100%", marginTop: 8, padding: "9px", background: (form.proratedMoveInDate && form.rent) ? "#d97706" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (form.proratedMoveInDate && form.rent) ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
                    Generate prorated invoice →
                  </button>
                ) : (
                  <div style={{ fontSize: 11, color: "#b45309", marginTop: 8 }}>A prorated invoice will be created automatically when you add this tenant.</div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>
              🔒 Private notes <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>(only you see this)</span>
            </div>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Private notes — tenant cannot see this..." rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>
              💬 Tenant message <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>(tenant sees this in their portal)</span>
            </div>
            <textarea value={form.public_note || ""} onChange={e => setForm({ ...form, public_note: e.target.value })} placeholder="Message for tenant — they will see this in their My Unit tab..." rows={2} style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #bbf7d0", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", resize: "none", background: "#f0f9f4" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...greenBtn, opacity: form.name ? 1 : 0.5 }}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add tenant"}
            </button>
            <button onClick={closeForm} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 14, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {activeTenants.length === 0 && !showForm && !showS8Inspections && !showLeaseOverview && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>No tenants added yet</div>
          <button onClick={openAdd} style={greenBtn}>+ Add your first tenant</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!showS8Inspections && !showLeaseOverview && !showForm && activeTenants.map(t => {
          const docsOpen = expandedDocs === t.id;
          const isM2M = t.month_to_month || t.monthToMonth;
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 2 }}>{t.address}</div>
                  {isM2M && <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", marginTop: 4, display: "inline-block" }}>Month-to-month</span>}
                </div>
                <div style={{ textAlign: "right", marginRight: 16 }}>
                  {t.section8 ? (() => {
                    const s8 = Number(t.section8_amount || t.section8Amount || 0);
                    const tp = Number(t.tenant_portion || t.tenantPortion || 0);
                    const total = s8 + tp;
                    return (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a" }}>${total.toLocaleString()}/mo</div>
                        <div style={{ fontSize: 11, color: "#1a1a1a" }}>S8: ${s8.toLocaleString()} + Tenant: ${tp.toLocaleString()}</div>
                      </>
                    );
                  })() : (
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#1b3d2a" }}>${(t.rent || 0).toLocaleString()}/mo</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(t)} style={outlineBtn}>Tenant Information</button>
                  <button onClick={() => handleRemove(t.id, t.name)} style={{ ...outlineBtn, borderColor: "#fee2e2", color: "#dc2626" }}>Remove</button>
                </div>
              </div>
              {t.notes && (
                <div style={{ margin: "0 20px 14px 20px", fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>📝 {t.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: on ? "#1b3d2a" : "#d1d5db", position: "relative", transition: "background 0.2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: on ? 23 : 3, transition: "left 0.2s" }} />
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", disabled }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1a1a", boxSizing: "border-box", opacity: disabled ? 0.5 : 1, background: disabled ? "#f9fafb" : "#fff" }} />
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 6 }}>{children}</div>;
}

function docIcon(cat) {
  if (cat === "Lease agreement") return "📄";
  if (cat === "Move-in inspection") return "🔑";
  if (cat === "Community rules") return "📜";
  return "📋";
}

const greenBtn = { background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
const outlineBtn = { padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", color: "#6b7280" };
const inputSt = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1a1a1a", boxSizing: "border-box" };


