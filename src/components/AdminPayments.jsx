import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import SendInvoiceModal from "./SendInvoiceModal";

// ─── LATE FEE CALCULATOR ─────────────────────────────────────────────────────
function calcLateFee(dueDateStr) {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dueDateStr.split("T")[0].split("-");
  const due = new Date(Number(year), Number(month) - 1, Number(day));
  const feeStart = new Date(due.getFullYear(), due.getMonth(), 5);
  if (today < feeStart) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysAfterFeeStart = Math.floor((today - feeStart) / msPerDay);
  return 35 + daysAfterFeeStart * 10;
}

function calcTotal(inv) {
  if (!inv) return 0;
  if (inv.paid) return Number(inv.total || inv.rent || 0);
  return Number(inv.rent || 0) + calcLateFee(inv.due_date);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function getCurrentMonthName() { const now = new Date(); return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear(); }
function fmt(amount) { return "$" + Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  if (dateStr.includes("T") || dateStr.includes(",")) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return dateStr;
}

function getStatus(inv) {
  if (!inv) return "upcoming";
  if (inv.paid) return "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = (inv.due_date || "").split("T")[0].split("-");
  if (parts.length !== 3) return "upcoming";
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return today > due ? "overdue" : "upcoming";
}

function invoiceNum(id) {
  if (!id) return "—";
  const p = id.replace(/-/g, "").toUpperCase();
  return `#${p.slice(0,7)}-${p.slice(7,12)}`;
}

function Sheet({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "rgba(0,0,0,0.4)", position: "absolute", inset: 0 }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "92vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
    </div>
  );
}

function TabBar({ tab, setTab, tabs }) {
  return (
    <div style={{ display: "flex", margin: "14px 20px 0", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === t.key ? "#fff" : "transparent",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
          color: tab === t.key ? "#1f2937" : "#6b7280",
          boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function Badge({ status }) {
  const cfg = {
    upcoming:  { color: "#2563eb", icon: "📅", label: "Upcoming" },
    overdue:   { color: "#dc2626", icon: "⏱",  label: "Overdue"  },
    completed: { color: "#16a34a", icon: "✓",  label: "Completed" },
    current:   { color: "#16a34a", icon: "✓",  label: "Current"  },
    archived:  { color: "#6b7280", icon: "📦", label: "Archived"  },
  }[status] || { color: "#2563eb", icon: "📅", label: "Upcoming" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: cfg.color, border: `1.5px solid ${cfg.color}` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function ActionBtn({ icon, label, onClick, danger, warning }) {
  const borderColor = danger ? "#fee2e2" : warning ? "#fef3c7" : "#e5e7eb";
  const textColor = danger ? "#dc2626" : warning ? "#d97706" : "#1f2937";
  return (
    <button onClick={onClick} style={{ width: "100%", padding: 14, border: `1.5px solid ${borderColor}`, borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 600, color: textColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
      {icon} {label}
    </button>
  );
}

function SummaryCard({ badgeColor, badgeLabel, badgeBorder, sub, amount, amountColor, count, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: badgeColor, borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, border: badgeBorder ? `1.5px solid ${badgeColor}` : "1px solid #e5e7eb" }}>
          {badgeLabel}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>{sub}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: amountColor || "#1f2937" }}>{amount}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{count} ›</div>
    </div>
  );
}

function PaymentTimeline({ inv }) {
  if (!inv) return null;
  const events = [];
  const today = new Date();
  today.setHours(23, 59, 0, 0);
  const createdAt = new Date(inv.created_at || inv.due_date);
  events.push({ date: createdAt, label: "Invoice created", color: "#2563eb" });
  const parts = (inv.due_date || "").split("T")[0].split("-");
  const due = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date(inv.due_date);
  const feeStart = new Date(due.getFullYear(), due.getMonth(), 5);
  const overdueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
  if (inv.paid) {
    if (Number(inv.late_fee) > 0) {
      events.push({ date: overdueDay, label: "Payment overdue", color: "#dc2626", expand: true });
      events.push({ date: feeStart, label: "$35.00 one-time late fee added", color: "#dc2626", expand: true });
    }
    if (inv.paid_date) {
      const pdStr = inv.paid_date.split("T")[0];
      const pdParts = pdStr.split("-");
      const pd = pdParts.length === 3 ? new Date(Number(pdParts[0]), Number(pdParts[1]) - 1, Number(pdParts[2])) : new Date(inv.paid_date);
      const dayBefore = new Date(pd.getFullYear(), pd.getMonth(), pd.getDate() - 1);
      events.push({ date: dayBefore, label: "Tenant scheduled payment", color: "#2563eb", expand: true });
      events.push({ date: dayBefore, label: "Payment processing initiated", color: "#2563eb" });
      events.push({ date: pd, label: "Payment complete", color: "#2563eb", expand: true, bold: true });
    }
  } else {
    if (overdueDay <= today) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdueBeforeFee = Math.floor((Math.min(feeStart, today) - overdueDay) / msPerDay);
      for (let d = 0; d <= daysOverdueBeforeFee; d++) {
        events.push({ date: new Date(overdueDay.getTime() + d * msPerDay), label: "Payment overdue", color: "#dc2626", expand: true });
      }
      if (feeStart <= today) {
        events.push({ date: new Date(feeStart), label: "$35.00 one-time late fee added", color: "#dc2626", expand: true });
        const days = Math.floor((today - feeStart) / msPerDay);
        for (let d = 1; d <= days; d++) {
          events.push({ date: new Date(feeStart.getTime() + d * msPerDay), label: "$10.00 daily late fee added", color: "#dc2626", expand: true });
        }
      }
    }
    events.push({ date: null, label: "Waiting for tenant to schedule payment", color: "ghost" });
  }
  return (
    <div style={{ padding: "16px 0" }}>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ width: 95, flexShrink: 0, fontSize: 11, color: "#6b7280", paddingTop: 1, textAlign: "right", paddingRight: 10 }}>
            {ev.date ? ev.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
            {ev.color === "ghost" ? <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2px dashed #d1d5db", background: "#fff" }} /> : <div style={{ width: 11, height: 11, borderRadius: "50%", background: ev.color }} />}
            {i < events.length - 1 && <div style={{ width: 2, minHeight: 22, flex: 1, background: ev.color === "ghost" ? "#e5e7eb" : ev.color === "#dc2626" ? "#fca5a5" : "#93c5fd", margin: "2px 0" }} />}
          </div>
          <div style={{ flex: 1, paddingLeft: 10, paddingBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, color: ev.color === "ghost" ? "#9ca3af" : "#1f2937", fontWeight: ev.bold ? 700 : 400 }}>{ev.label}</span>
            {ev.expand && <span style={{ color: "#9ca3af", fontSize: 14, marginLeft: 8 }}>›</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceBreakdown({ inv }) {
  const rent = Number(inv?.rent || 0);
  const lateFee = inv?.paid ? Number(inv?.late_fee || 0) : calcLateFee(inv?.due_date);
  const total = rent + lateFee;
  const daysLate = lateFee > 35 ? Math.round((lateFee - 35) / 10) : 0;
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 14, color: "#6b7280" }}>{inv?.is_custom ? "Charge amount" : "Monthly Rent"}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(rent)}</span>
      </div>
      {!inv?.is_custom && lateFee > 0 && <>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 14, color: "#dc2626" }}>One-time late fee (day 5)</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>$35.00</span>
        </div>
        {daysLate > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 14, color: "#dc2626" }}>Daily fees ({daysLate} day{daysLate !== 1 ? "s" : ""} × $10)</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>{fmt(daysLate * 10)}</span>
          </div>
        )}
      </>}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(total)}</span>
      </div>
    </div>
  );
}

function InvoiceDetailSheet({ inv, tenant, onClose, onMarkPaid, onMarkUnpaid, onEdit, onDelete }) {
  const [tab, setTab] = useState("timeline");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnpaid, setConfirmUnpaid] = useState(false);
  const status = getStatus(inv);
  const liveFee = inv?.paid ? Number(inv?.late_fee || 0) : (inv?.is_custom ? 0 : calcLateFee(inv?.due_date));
  const liveTotal = Number(inv?.rent || 0) + liveFee;

  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Invoice details" onClose={onClose} />
      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{tenant?.address}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.name}</div>
      </div>
      <div style={{ margin: "14px 20px", background: "#f9fafb", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{inv?.is_custom ? inv?.month?.split(" —")[0] : "Rent & Fees"}</div>
          <Badge status={status} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{fmt(liveTotal)}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Due {fmtDate(inv?.due_date)}</div>
        {inv?.paid && liveFee > 0 && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>Paid Late</div>}
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Invoice {invoiceNum(inv?.id)}</div>
      </div>

      {!inv?.paid && !confirmDelete && (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionBtn icon="◉" label="Mark as paid" onClick={() => onMarkPaid(inv)} />
          <ActionBtn icon="✏️" label="Edit invoice" onClick={() => onEdit(inv)} />
          <ActionBtn icon="🗑" label="Delete invoice" onClick={() => setConfirmDelete(true)} danger />
        </div>
      )}

      {inv?.paid && !confirmUnpaid && (
        <div style={{ padding: "0 20px" }}>
          <ActionBtn icon="↩️" label="Mark as unpaid (override)" onClick={() => setConfirmUnpaid(true)} warning />
        </div>
      )}

      {confirmUnpaid && (
        <div style={{ margin: "0 20px 10px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>Mark this invoice as unpaid?</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>This will undo the payment and reset the invoice back to unpaid.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmUnpaid(false)} style={{ flex: 1, padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={() => { onMarkUnpaid(inv); setConfirmUnpaid(false); }} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#d97706", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Yes, mark unpaid</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ margin: "0 20px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>Delete this invoice?</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>This cannot be undone.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={() => onDelete(inv)} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Delete</button>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #f3f4f6", margin: "12px 20px 0" }} />
      <TabBar tab={tab} setTab={setTab} tabs={[{ key: "timeline", label: "Payment timeline" }, { key: "breakdown", label: "Invoice breakdown" }]} />
      <div style={{ padding: "0 20px" }}>
        {tab === "timeline" && <PaymentTimeline inv={inv} />}
        {tab === "breakdown" && <InvoiceBreakdown inv={inv} />}
      </div>
    </Sheet>
  );
}

function InvoiceListSheet({ tenant, invoices, onClose, onSelect }) {
  const sorted = [...invoices].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  const active = invoices.filter(i => !i.deleted);
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Invoices" onClose={onClose} />
      <div style={{ padding: "8px 20px 4px" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{tenant?.address}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{tenant?.name}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total amount</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(active.reduce((s, i) => s + (i.paid ? Number(i.total || i.rent) : Number(i.rent) + (i.is_custom ? 0 : calcLateFee(i.due_date))), 0))}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Invoices</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{active.length}</div>
        </div>
      </div>
      <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
        {sorted.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No invoices yet</div>}
        {sorted.map((inv, i) => {
          const status = getStatus(inv);
          const isDeleted = inv.deleted;
          const liveTotal = inv.paid ? Number(inv.total || inv.rent) : Number(inv.rent) + (inv.is_custom ? 0 : calcLateFee(inv.due_date));
          const label = inv.is_custom ? (inv.month?.split(" —")[0] || "Custom charge") : "Rent & Fees";
          return (
            <div key={inv.id} onClick={() => !isDeleted && onSelect(inv)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: isDeleted ? "default" : "pointer", opacity: isDeleted ? 0.45 : 1 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: isDeleted ? "#9ca3af" : "#1f2937" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Due {fmtDate(inv.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(liveTotal)}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {isDeleted ? <span style={{ color: "#9ca3af" }}>🗑 Deleted</span>
                    : status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed {inv.paid_date ? fmtDate(inv.paid_date) : ""}</span>
                    : status === "overdue" ? <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Overdue</span>
                    : <span style={{ color: "#2563eb" }}>📅 Upcoming</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 32 }} />
    </Sheet>
  );
}

function FilteredInvoiceSheet({ title, invoices, tenants, onClose, onSelect, defaultFilter = "all" }) {
  const [filter, setFilter] = useState(defaultFilter);
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const filtered = invoices.filter(inv => {
    if (filter === "all") return true;
    const parts = (inv.due_date || "").split("T")[0].split("-");
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    if (filter === "thismonth") return due.getMonth() === thisMonth.getMonth() && due.getFullYear() === thisMonth.getFullYear();
    if (filter === "nextmonth") return due.getMonth() === nextMonth.getMonth() && due.getFullYear() === nextMonth.getFullYear();
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  const totalAmt = filtered.reduce((s, inv) => s + (inv.paid ? Number(inv.total || inv.rent) : Number(inv.rent) + (inv.is_custom ? 0 : calcLateFee(inv.due_date))), 0);
  const filterBtns = defaultFilter === "nextmonth"
    ? [{ key: "nextmonth", label: "Next month" }, { key: "all", label: "All time" }]
    : [{ key: "thismonth", label: "This month" }, { key: "all", label: "All time" }];
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div style={{ display: "flex", margin: "12px 20px 0", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
        {filterBtns.map(btn => (
          <button key={btn.key} onClick={() => setFilter(btn.key)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", background: filter === btn.key ? "#fff" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: filter === btn.key ? "#1f2937" : "#6b7280", boxShadow: filter === btn.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{btn.label}</button>
        ))}
      </div>
      <div style={{ padding: "8px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{sorted.length} invoice{sorted.length !== 1 ? "s" : ""}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{fmt(totalAmt)}</div>
      </div>
      <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "8px 20px", overflow: "hidden" }}>
        {sorted.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No invoices</div>}
        {sorted.map((inv, i) => {
          const tenant = tenants.find(t => t.id === inv.tenant_id);
          const status = getStatus(inv);
          const liveTotal = inv.paid ? Number(inv.total || inv.rent) : Number(inv.rent) + (inv.is_custom ? 0 : calcLateFee(inv.due_date));
          const label = inv.is_custom ? (inv.month?.split(" —")[0] || "Custom charge") : "Rent & Fees";
          return (
            <div key={inv.id} onClick={() => onSelect(inv, tenant)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{tenant?.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{label} · {tenant?.address}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Due {fmtDate(inv.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: status === "overdue" ? "#dc2626" : status === "completed" ? "#16a34a" : "#1f2937" }}>{fmt(liveTotal)}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed</span>
                    : status === "overdue" ? <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Overdue</span>
                    : <span style={{ color: "#2563eb" }}>📅 Upcoming</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 32 }} />
    </Sheet>
  );
}

function ProcessingSheet({ onClose }) {
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Processing" onClose={onClose} />
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>↻</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Payment Processing</div>
        <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>This section will show payments currently in processing once your merchant account is connected.</div>
      </div>
      <div style={{ height: 32 }} />
    </Sheet>
  );
}

function CollectionDetailSheet({ tenant, invoices, onClose, onViewInvoices, onArchive }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const sorted = [...invoices].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  const paid = sorted.filter(i => i.paid);
  const lastPayment = paid[0] || null;
  const upcoming = sorted.filter(i => !i.paid && getStatus(i) === "upcoming");
  const nextPayment = upcoming[upcoming.length - 1] || null;
  const overdueList = sorted.filter(i => !i.paid && getStatus(i) === "overdue");
  const tenantStatus = overdueList.length > 0 ? "overdue" : "current";
  const leaseStart = tenant?.leaseStart || tenant?.lease_start;
  const leaseEnd = tenant?.leaseEnd || tenant?.lease_end;
  const monthsRemaining = leaseEnd ? Math.max(0, Math.round((new Date(leaseEnd) - new Date()) / (1000 * 60 * 60 * 24 * 30))) : null;
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Rent collection details" onClose={onClose} />
      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant?.address}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.address}, Youngstown, OH</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Badge status={tenantStatus} />
          {monthsRemaining !== null && <span style={{ fontSize: 13, color: "#6b7280" }}>{monthsRemaining} months remaining</span>}
        </div>
      </div>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Payments</div>
          <button onClick={onViewInvoices} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>View all invoices</button>
        </div>
        {overdueList.length > 0 && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>✕ {overdueList.length} Overdue invoice{overdueList.length > 1 ? "s" : ""}</div>
            <button onClick={onViewInvoices} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: 700, textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>View</button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Last Payment</div>
            {lastPayment ? <>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(lastPayment.paid_date)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{fmt(lastPayment.total || lastPayment.rent)}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Rent & fees ›</div>
            </> : <div style={{ fontSize: 13, color: "#9ca3af" }}>No payments yet</div>}
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Next Payment</div>
            {nextPayment ? <>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Due {fmtDate(nextPayment.due_date)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{fmt(Number(nextPayment.rent))}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Rent & fees ›</div>
            </> : <div style={{ fontSize: 13, color: "#9ca3af" }}>No upcoming</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Current tenant</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{tenant?.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{tenant?.contactEmail || tenant?.contact_email}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.phone || "—"}</div>
        </div>
      </div>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Rent collection terms</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          {leaseStart && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(leaseStart)}</div></div>}
          {leaseEnd && <><div style={{ width: 2, height: 14, background: "#93c5fd", marginLeft: 4, marginBottom: 4 }} /><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(leaseEnd)}</div></div></>}
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{fmt(tenant?.rent)}<span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>/month</span></div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>📅 Due on <strong style={{ color: "#1f2937" }}>1st</strong> of every month</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>ⓘ Late fee: <strong style={{ color: "#1f2937" }}>$35.00 + $10.00/day</strong></div>
        </div>
      </div>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>End & archive rent collection</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 12 }}>Tenant will be moved to the Archived tab. All their records and invoice history will be saved permanently.</div>
        {!confirmArchive ? (
          <button onClick={() => setConfirmArchive(true)} style={{ width: "100%", padding: 16, background: "#dc2626", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>End & archive</button>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>Are you sure?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>This will end {tenant?.name}'s tenancy and move them to the archived tab. Their full history is preserved.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmArchive(false)} style={{ flex: 1, padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={() => { onArchive(tenant); setConfirmArchive(false); }} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#dc2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Yes, archive</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 32 }} />
    </Sheet>
  );
}

function ArchivedTenantCard({ tenant, invoices, onSelect, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sorted = [...invoices].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  const totalPaid = invoices.filter(i => i.paid).reduce((s, i) => s + Number(i.total || i.rent || 0), 0);
  const archivedAt = tenant.archived_at ? fmtDate(tenant.archived_at) : "—";
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6", padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 20, marginTop: 2, opacity: 0.5 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6b7280" }}>{tenant.address}</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{tenant.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Archived {archivedAt}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <Badge status="archived" />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 14, background: "#f9fafb", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div><div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Email</div><div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{tenant.email || "—"}</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Phone</div><div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{tenant.phone || "—"}</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Rent</div><div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{fmt(tenant.rent)}/mo</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Total collected</div><div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>{fmt(totalPaid)}</div></div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Invoice history ({invoices.length})</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {sorted.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No invoices</div>}
            {sorted.map((inv, i) => {
              const status = getStatus(inv);
              const liveTotal = inv.paid ? Number(inv.total || inv.rent) : Number(inv.rent) + (inv.is_custom ? 0 : calcLateFee(inv.due_date));
              return (
                <div key={inv.id} onClick={() => onSelect(inv, tenant)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer", background: "#fff" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{inv.month}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Due {fmtDate(inv.due_date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(liveTotal)}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Paid</span> : <span style={{ color: "#dc2626" }}>Unpaid</span>}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 16px", background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>🗑 Delete from archive</button>
            ) : (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Delete {tenant.name} from archive?</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>This permanently removes all their records. This cannot be undone.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                  <button onClick={() => onDelete(tenant)} style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Yes, delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ inv, onClose, onSave }) {
  const [rent, setRent] = useState(String(inv?.rent || ""));
  const [dueDate, setDueDate] = useState(inv?.due_date || "");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    const lateFee = calcLateFee(dueDate);
    await onSave(inv, { rent: Number(rent), due_date: dueDate, late_fee: lateFee, total: Number(rent) + lateFee });
    setSaving(false);
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Edit invoice</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Rent amount</label>
          <input value={rent} onChange={e => setRent(e.target.value)} type="number" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Due date</label>
          <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#1b3d2a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayments({ tenants = [], invoices: propInvoices = [], setInvoices: propSetInvoices }) {
  const [invoices, setInvoicesLocal] = useState(propInvoices);
  const setInvoices = (val) => { setInvoicesLocal(val); if (propSetInvoices) propSetInvoices(val); };
  const [mainTab, setMainTab] = useState("active");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [archivedTenants, setArchivedTenants] = useState([]);
  const [showSendInvoice, setShowSendInvoice] = useState(false);
  const [showSentInvoices, setShowSentInvoices] = useState(false);
  const [sentInvoices, setSentInvoices] = useState([]);

  useEffect(() => { setInvoicesLocal(propInvoices); }, [propInvoices]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("tenants").select("*").eq("archived", true);
      if (data) setArchivedTenants(data);
    };
    load();
  }, []);

  // ── KEY FIX: reload invoices from Supabase ──────────────────────
  const reloadInvoices = async () => {
    const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (data) setInvoices(data);
  };

  const now = new Date();
  const currentMonthName = getCurrentMonthName();
  const allActive = invoices.filter(i => !i.deleted);
  const activeTenants = tenants.filter(t => !t.archived);

  const upcomingList  = allActive.filter(i => !i.paid && getStatus(i) === "upcoming");
  const overdueList   = allActive.filter(i => !i.paid && getStatus(i) === "overdue");
  const completedList = allActive.filter(i => i.paid);

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const upcomingNextMonth = upcomingList.filter(i => {
    const parts = (i.due_date || "").split("T")[0].split("-");
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return due.getMonth() === nextMonthDate.getMonth() && due.getFullYear() === nextMonthDate.getFullYear();
  });

  const completedThisMonth = completedList.filter(i => {
    const parts = (i.due_date || "").split("T")[0].split("-");
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
  });

  const upcomingTotal  = upcomingNextMonth.reduce((s, i) => s + Number(i.rent || 0), 0);
  const overdueTotal   = overdueList.reduce((s, i) => s + Number(i.rent || 0) + calcLateFee(i.due_date), 0);
  const completedTotal = completedThisMonth.reduce((s, i) => s + Number(i.total || i.rent || 0), 0);

  const tenantInvoices = (id) => allActive.filter(i => i.tenant_id === id);
  const getPropertyStatus = (t) => tenantInvoices(t.id).some(i => !i.paid && getStatus(i) === "overdue") ? "overdue" : "current";
  const getOverdueCount = (t) => tenantInvoices(t.id).filter(i => !i.paid && getStatus(i) === "overdue").length;
  const getDisplayAmount = (t) => {
    const thisMonth = tenantInvoices(t.id).find(i => i.month === currentMonthName);
    return thisMonth ? Number(thisMonth.rent) + (thisMonth.paid ? 0 : calcLateFee(thisMonth.due_date)) : Number(t.rent || 0);
  };

  const handleMarkPaid = async (inv) => {
    const paidDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const liveFee = inv.is_custom ? 0 : calcLateFee(inv.due_date);
    const liveTotal = Number(inv.rent) + liveFee;
    await supabase.from("invoices").update({ paid: true, paid_date: paidDate, late_fee: liveFee, total: liveTotal, updated_at: now.toISOString() }).eq("id", inv.id);
    setInvoices(invoices.map(i => i.id === inv.id ? { ...i, paid: true, paid_date: paidDate, late_fee: liveFee, total: liveTotal } : i));
    setSheet("invoices");
    setSelectedInvoice(null);
  };

  const handleMarkUnpaid = async (inv) => {
    await supabase.from("invoices").update({ paid: false, paid_date: null, late_fee: 0, total: Number(inv.rent), updated_at: now.toISOString() }).eq("id", inv.id);
    setInvoices(invoices.map(i => i.id === inv.id ? { ...i, paid: false, paid_date: null, late_fee: 0, total: Number(inv.rent) } : i));
    setSheet("invoices");
    setSelectedInvoice(null);
  };

  const handleDelete = async (inv) => {
    await supabase.from("invoices").update({ deleted: true }).eq("id", inv.id);
    setInvoices(invoices.map(i => i.id === inv.id ? { ...i, deleted: true } : i));
    setSheet("invoices");
    setSelectedInvoice(null);
  };

  const handleEditSave = async (inv, updates) => {
    await supabase.from("invoices").update({ ...updates, updated_at: now.toISOString() }).eq("id", inv.id);
    setInvoices(invoices.map(i => i.id === inv.id ? { ...i, ...updates } : i));
    setEditingInvoice(null);
  };

  const loadSentInvoices = async () => {
    const { data } = await supabase.from("custom_invoices").select("*").order("created_at", { ascending: false });
    if (data) setSentInvoices(data);
  };

  const handleDeleteCustomInvoice = async (id) => {
    // Get the custom invoice first so we can match it in invoices table
    const inv = sentInvoices.find(i => i.id === id);
    // Delete from custom_invoices
    await supabase.from("custom_invoices").delete().eq("id", id);
    // Also delete the matching row from invoices table
    if (inv) {
      await supabase.from("invoices")
        .delete()
        .eq("tenant_id", inv.tenant_id)
        .eq("is_custom", true)
        .eq("rent", Number(inv.amount));
    }
    setSentInvoices(prev => prev.filter(i => i.id !== id));
    // Reload invoices so the list updates instantly
    reloadInvoices();
  };

  const handleArchive = async (tenant) => {
    const archivedAt = now.toISOString();
    await supabase.from("tenants").update({ archived: true, archived_at: archivedAt }).eq("id", tenant.id);
    setArchivedTenants(prev => [...prev, { ...tenant, archived: true, archived_at: archivedAt }]);
    setSheet(null);
    setSelectedTenant(null);
  };

  const handleDeleteArchived = async (tenant) => {
    await supabase.from("tenants").delete().eq("id", tenant.id);
    setArchivedTenants(prev => prev.filter(t => t.id !== tenant.id));
  };

  return (
    <div className="admin-page-content" style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", maxWidth: 580 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Rent Collection</h1>
        <button style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <SummaryCard badgeColor="#16a34a" badgeLabel="✓ Completed" badgeBorder={true} sub="This month" amount={fmt(completedTotal)} amountColor="#16a34a" count={`${completedThisMonth.length} invoice${completedThisMonth.length !== 1 ? "s" : ""}`} onClick={() => setSheet("allCompleted")} />
        <div onClick={() => overdueList.length > 0 && setSheet("allOverdue")} style={{ cursor: overdueList.length > 0 ? "pointer" : "default" }}>
          <SummaryCard badgeColor="#dc2626" badgeLabel="⏱ Overdue" badgeBorder={true} sub="All time" amount={fmt(overdueTotal)} amountColor={overdueTotal > 0 ? "#dc2626" : undefined} count={`${overdueList.length} invoice${overdueList.length !== 1 ? "s" : ""}`} />
        </div>
        <SummaryCard badgeColor="#2563eb" badgeLabel="↻ Processing" badgeBorder={true} sub="All time" amount="$0.00" count="0 invoices" onClick={() => setSheet("processing")} />
        <SummaryCard badgeColor="#6b7280" badgeLabel="📅 Upcoming" badgeBorder={false} sub="Next month" amount={fmt(upcomingTotal)} count={`${upcomingNextMonth.length} invoice${upcomingNextMonth.length !== 1 ? "s" : ""}`} onClick={() => setSheet("allUpcoming")} />
      </div>

      <button onClick={() => setShowSendInvoice(true)} style={{ width: "100%", padding: 16, background: "#0f1a14", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        📤 Send Invoice
      </button>
      <button onClick={() => { loadSentInvoices(); setShowSentInvoices(true); }} style={{ width: "100%", padding: "8px", background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>
        View sent invoices →
      </button>

      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {["active", "archived"].map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", background: mainTab === t ? "#fff" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: mainTab === t ? "#1f2937" : "#6b7280", boxShadow: mainTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "archived" && archivedTenants.length > 0 && (
              <span style={{ marginLeft: 6, background: "#e5e7eb", color: "#6b7280", fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 6 }}>{archivedTenants.length}</span>
            )}
          </button>
        ))}
      </div>

      {mainTab === "active" && (
        <div>
          {activeTenants.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No active tenants</div>}
          {activeTenants.map(tenant => {
            const status = getPropertyStatus(tenant);
            const overdueCount = getOverdueCount(tenant);
            const amount = getDisplayAmount(tenant);
            return (
              <div key={tenant.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "16px 0" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                    <div style={{ fontSize: 20, marginTop: 2 }}>🏢</div>
                    <div style={{ flex: 1 }}>
                      <button onClick={() => { setSelectedTenant(tenant); setSheet("detail"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "'DM Sans', sans-serif" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{tenant.address}</div>
                      </button>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant.name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{fmt(amount)}</div>
                    {overdueCount > 0 ? (
                      <button onClick={() => { setSelectedTenant(tenant); setSheet("invoices"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <span style={{ fontSize: 12, color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>⏱ {overdueCount}</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>✓ Current</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mainTab === "archived" && (
        <div>
          {archivedTenants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No archived tenants</div>
              <div style={{ fontSize: 13 }}>When you end a tenancy, the tenant will appear here with their full history.</div>
            </div>
          ) : (
            archivedTenants.map(tenant => (
              <ArchivedTenantCard key={tenant.id} tenant={tenant} invoices={allActive.filter(i => i.tenant_id === tenant.id)} onSelect={(inv, t) => { setSelectedInvoice(inv); setSelectedTenant(t); setSheet("invoice"); }} onDelete={handleDeleteArchived} />
            ))
          )}
        </div>
      )}

      {sheet === "allUpcoming" && <FilteredInvoiceSheet title="Upcoming Invoices" invoices={upcomingList} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv, tenant) => { setSelectedInvoice(inv); setSelectedTenant(tenant); setSheet("invoice"); }} defaultFilter="nextmonth" />}
      {sheet === "allCompleted" && <FilteredInvoiceSheet title="Completed Invoices" invoices={completedList} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv, tenant) => { setSelectedInvoice(inv); setSelectedTenant(tenant); setSheet("invoice"); }} defaultFilter="thismonth" />}
      {sheet === "processing" && <ProcessingSheet onClose={() => setSheet(null)} />}
      {sheet === "allOverdue" && (
        <Sheet onClose={() => setSheet(null)}>
          <SheetHeader title="Overdue Invoices" onClose={() => setSheet(null)} />
          <div style={{ padding: "8px 20px 4px" }}>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{overdueList.length} overdue invoice{overdueList.length !== 1 ? "s" : ""} — {fmt(overdueTotal)} total</div>
          </div>
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
            {overdueList.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              const liveTotal = Number(inv.rent) + calcLateFee(inv.due_date);
              return (
                <div key={inv.id} onClick={() => { setSelectedTenant(tenant); setSelectedInvoice(inv); setSheet("invoice"); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < overdueList.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{tenant?.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{tenant?.address}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>Due {fmtDate(inv.due_date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{fmt(liveTotal)}</div>
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>⏱ Overdue</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 32 }} />
        </Sheet>
      )}
      {sheet === "detail" && selectedTenant && <CollectionDetailSheet tenant={selectedTenant} invoices={tenantInvoices(selectedTenant.id)} onClose={() => { setSheet(null); setSelectedTenant(null); }} onViewInvoices={() => setSheet("invoices")} onArchive={handleArchive} />}
      {sheet === "invoices" && selectedTenant && <InvoiceListSheet tenant={selectedTenant} invoices={tenantInvoices(selectedTenant.id)} onClose={() => setSheet(null)} onSelect={inv => { setSelectedInvoice(inv); setSheet("invoice"); }} />}
      {sheet === "invoice" && selectedInvoice && selectedTenant && <InvoiceDetailSheet inv={selectedInvoice} tenant={selectedTenant} onClose={() => { setSheet("invoices"); setSelectedInvoice(null); }} onMarkPaid={handleMarkPaid} onMarkUnpaid={handleMarkUnpaid} onEdit={inv => setEditingInvoice(inv)} onDelete={handleDelete} />}

      {showSentInvoices && (
        <Sheet onClose={() => setShowSentInvoices(false)}>
          <SheetHeader title="Sent Invoices" onClose={() => setShowSentInvoices(false)} />
          <div style={{ padding: "8px 20px 4px" }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{sentInvoices.length} invoice{sentInvoices.length !== 1 ? "s" : ""} sent</div>
          </div>
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
            {sentInvoices.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No invoices sent yet</div>}
            {sentInvoices.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              return (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sentInvoices.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{inv.title}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{tenant?.name} · {tenant?.address}</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>{inv.paid ? <span style={{ color: "#16a34a" }}>✓ Paid {inv.paid_date || ""}</span> : <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Unpaid</span>}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>${Number(inv.amount).toLocaleString()}</div>
                    <button onClick={() => handleDeleteCustomInvoice(inv.id)} style={{ fontSize: 12, color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "4px 10px", background: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>🗑 Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 32 }} />
        </Sheet>
      )}

      {/* ── KEY FIX: reloadInvoices called after sending so list updates instantly ── */}
      {showSendInvoice && (
        <SendInvoiceModal
          tenants={activeTenants}
          onClose={() => setShowSendInvoice(false)}
          onSent={() => { setShowSendInvoice(false); reloadInvoices(); }}
        />
      )}
      {editingInvoice && <EditModal inv={editingInvoice} onClose={() => setEditingInvoice(null)} onSave={handleEditSave} />}
    </div>
  );
}
