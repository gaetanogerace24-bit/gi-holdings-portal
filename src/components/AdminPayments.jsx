import { useState, useEffect } from "react";
import { supabase } from "../supabase";

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getCurrentMonthName() {
  const now = new Date();
  return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
}

function fmt(amount) {
  return "$" + Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fix timezone issue — parse date string without converting to UTC
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  // Handle ISO timestamps or "May 1, 2026" style strings
  if (dateStr.includes("T") || dateStr.includes(",")) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  // Handle "2026-04-01" style — parse manually to avoid timezone shift
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

// ─── SHARED UI ────────────────────────────────────────────────────────────────
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
  }[status] || { color: "#2563eb", icon: "📅", label: "Upcoming" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: cfg.color, border: `1.5px solid ${cfg.color}` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: 14, border: `1.5px solid ${danger ? "#fee2e2" : "#e5e7eb"}`, borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 600, color: danger ? "#dc2626" : "#1f2937", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
      {icon} {label}
    </button>
  );
}

function SummaryCard({ badgeColor, badgeLabel, badgeBorder, sub, amount, amountColor, count }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
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

// ─── PAYMENT TIMELINE ─────────────────────────────────────────────────────────
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
      const pd = new Date(inv.paid_date);
      const dayBefore = new Date(pd.getTime() - 24 * 60 * 60 * 1000);
      events.push({ date: dayBefore, label: "Tenant scheduled payment", color: "#2563eb", expand: true });
      events.push({ date: dayBefore, label: "Payment processing initiated", color: "#2563eb" });
      events.push({ date: pd, label: "Payment complete", color: "#2563eb", expand: true, bold: true });
    }
  } else {
    if (overdueDay <= today) {
      events.push({ date: overdueDay, label: "Payment overdue", color: "#dc2626", expand: true });
      if (feeStart <= today) {
        events.push({ date: new Date(feeStart), label: "$35.00 one-time late fee added", color: "#dc2626", expand: true });
        const msPerDay = 1000 * 60 * 60 * 24;
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
            {ev.color === "ghost"
              ? <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2px dashed #d1d5db", background: "#fff" }} />
              : <div style={{ width: 11, height: 11, borderRadius: "50%", background: ev.color }} />
            }
            {i < events.length - 1 && (
              <div style={{ width: 2, minHeight: 22, flex: 1, background: ev.color === "ghost" ? "#e5e7eb" : ev.color === "#dc2626" ? "#fca5a5" : "#93c5fd", margin: "2px 0" }} />
            )}
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

// ─── INVOICE BREAKDOWN ────────────────────────────────────────────────────────
function InvoiceBreakdown({ inv }) {
  const rent = Number(inv?.rent || 0);
  const lateFee = inv?.paid ? Number(inv?.late_fee || 0) : calcLateFee(inv?.due_date);
  const total = rent + lateFee;
  const daysLate = lateFee > 35 ? Math.round((lateFee - 35) / 10) : 0;
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 14, color: "#6b7280" }}>Monthly Rent</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(rent)}</span>
      </div>
      {lateFee > 0 && <>
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
      <div style={{ marginTop: 12, padding: 12, background: "#f9fafb", borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>Late fee policy</div>
        <div style={{ fontSize: 13 }}>Day 5 after due: $35.00 one-time fee</div>
        <div style={{ fontSize: 13 }}>Day 6 onward: +$10.00 every day until paid</div>
      </div>
    </div>
  );
}

// ─── INVOICE DETAIL SHEET ─────────────────────────────────────────────────────
function InvoiceDetailSheet({ inv, tenant, onClose, onMarkPaid, onEdit, onDelete }) {
  const [tab, setTab] = useState("timeline");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = getStatus(inv);
  const liveFee = inv?.paid ? Number(inv?.late_fee || 0) : calcLateFee(inv?.due_date);
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
          <div style={{ fontSize: 13, color: "#6b7280" }}>Rent & Fees</div>
          <Badge status={status} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{fmt(liveTotal)}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Due {fmtDate(inv?.due_date)}</div>
        {inv?.paid && liveFee > 0 && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>Paid Late</div>}
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Invoice {invoiceNum(inv?.id)}</div>
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Receiving bank account</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>M&T Bank Checking - 4248</div>
        </div>
      </div>

      {!inv?.paid && !confirmDelete && (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionBtn icon="◉" label="Mark as paid" onClick={() => onMarkPaid(inv)} />
          <ActionBtn icon="✏️" label="Edit invoice" onClick={() => onEdit(inv)} />
          <ActionBtn icon="🗑" label="Delete invoice" onClick={() => setConfirmDelete(true)} danger />
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

// ─── INVOICE LIST SHEET ───────────────────────────────────────────────────────
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
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {fmt(active.reduce((s, i) => s + (i.paid ? Number(i.total || i.rent) : Number(i.rent) + calcLateFee(i.due_date)), 0))}
          </div>
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
          const liveTotal = inv.paid ? Number(inv.total || inv.rent) : Number(inv.rent) + calcLateFee(inv.due_date);
          return (
            <div key={inv.id} onClick={() => !isDeleted && onSelect(inv)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: isDeleted ? "default" : "pointer", opacity: isDeleted ? 0.45 : 1 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: isDeleted ? "#9ca3af" : "#1f2937" }}>Rent & Fees</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Due {fmtDate(inv.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(liveTotal)}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {isDeleted ? <span style={{ color: "#9ca3af" }}>🗑 Deleted</span>
                    : status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed {inv.paid_date ? fmtDate(inv.paid_date) : ""}</span>
                    : status === "overdue" ? <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Overdue</span>
                    : <span style={{ color: "#2563eb" }}>📅 Upcoming</span>
                  }
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

// ─── RENT COLLECTION DETAIL SHEET ────────────────────────────────────────────
function CollectionDetailSheet({ tenant, invoices, onClose, onViewInvoices }) {
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
              ✕ {overdueList.length} Overdue invoice{overdueList.length > 1 ? "s" : ""}
            </div>
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

      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Receiving bank accounts</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>For rent & fees</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>M&T Bank</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Checking Account - 4248</div>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Tenant ACH payment fee</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Charged to</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>You</div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>End & archive rent collection</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 12 }}>Any unpaid invoices will be canceled, and your tenant will be notified.</div>
        <button style={{ width: "100%", padding: 16, background: "#dc2626", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>End & archive</button>
      </div>
      <div style={{ height: 32 }} />
    </Sheet>
  );
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────
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
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#1b3d2a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function AdminPayments({ tenants = [], invoices: propInvoices = [], setInvoices: propSetInvoices }) {
  const [invoices, setInvoicesLocal] = useState(propInvoices);
  const setInvoices = (val) => { setInvoicesLocal(val); if (propSetInvoices) propSetInvoices(val); };

  const [mainTab, setMainTab] = useState("active");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  useEffect(() => { setInvoicesLocal(propInvoices); }, [propInvoices]);

  const now = new Date();
  const currentMonthName = getCurrentMonthName();
  const allActive = invoices.filter(i => !i.deleted);

  const upcomingList = allActive.filter(i => !i.paid && getStatus(i) === "upcoming");
  const overdueList  = allActive.filter(i => !i.paid && getStatus(i) === "overdue");
  const completedList = allActive.filter(i => i.paid && i.month === currentMonthName);

  const upcomingTotal  = upcomingList.reduce((s, i) => s + Number(i.rent || 0), 0);
  const overdueTotal   = overdueList.reduce((s, i) => s + Number(i.rent || 0) + calcLateFee(i.due_date), 0);
  const completedTotal = completedList.reduce((s, i) => s + Number(i.total || i.rent || 0), 0);

  const tenantInvoices = (id) => allActive.filter(i => i.tenant_id === id);
  const getPropertyStatus = (t) => tenantInvoices(t.id).some(i => !i.paid && getStatus(i) === "overdue") ? "overdue" : "current";
  const getOverdueCount = (t) => tenantInvoices(t.id).filter(i => !i.paid && getStatus(i) === "overdue").length;
  const getDisplayAmount = (t) => {
    const thisMonth = tenantInvoices(t.id).find(i => i.month === currentMonthName);
    return thisMonth ? Number(thisMonth.rent) + (thisMonth.paid ? 0 : calcLateFee(thisMonth.due_date)) : Number(t.rent || 0);
  };

  const handleMarkPaid = async (inv) => {
    const paidDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const liveFee = calcLateFee(inv.due_date);
    const liveTotal = Number(inv.rent) + liveFee;
    await supabase.from("invoices").update({ paid: true, paid_date: paidDate, late_fee: liveFee, total: liveTotal, updated_at: now.toISOString() }).eq("id", inv.id);
    setInvoices(invoices.map(i => i.id === inv.id ? { ...i, paid: true, paid_date: paidDate, late_fee: liveFee, total: liveTotal } : i));
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

  return (
    <div className="admin-page-content" style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", maxWidth: 580 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Rent Collection</h1>
        <button style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <SummaryCard badgeColor="#6b7280" badgeLabel="📅 Upcoming" badgeBorder={false} sub="This month" amount={fmt(upcomingTotal)} count={`${upcomingList.length} invoice${upcomingList.length !== 1 ? "s" : ""}`} />
        <SummaryCard badgeColor="#2563eb" badgeLabel="↻ Processing" badgeBorder={true} sub="All time" amount="$0.00" count="0 invoices" />
        <SummaryCard badgeColor="#dc2626" badgeLabel="⏱ Overdue" badgeBorder={true} sub="All time" amount={fmt(overdueTotal)} amountColor={overdueTotal > 0 ? "#dc2626" : undefined} count={`${overdueList.length} invoice${overdueList.length !== 1 ? "s" : ""}`} />
        <SummaryCard badgeColor="#16a34a" badgeLabel="✓ Completed" badgeBorder={true} sub="This month" amount={fmt(completedTotal)} amountColor="#16a34a" count={`${completedList.length} invoice${completedList.length !== 1 ? "s" : ""}`} />
      </div>

      <button style={{ width: "100%", padding: 16, background: "#0f1a14", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 20, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        + Set up rent collection
      </button>

      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {["active", "expired", "archived"].map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", background: mainTab === t ? "#fff" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: mainTab === t ? "#1f2937" : "#6b7280", boxShadow: mainTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div>
        {tenants.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No properties yet</div>}
        {tenants.map(tenant => {
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

      {sheet === "detail" && selectedTenant && (
        <CollectionDetailSheet tenant={selectedTenant} invoices={tenantInvoices(selectedTenant.id)} onClose={() => { setSheet(null); setSelectedTenant(null); }} onViewInvoices={() => setSheet("invoices")} />
      )}
      {sheet === "invoices" && selectedTenant && (
        <InvoiceListSheet tenant={selectedTenant} invoices={tenantInvoices(selectedTenant.id)} onClose={() => setSheet(null)} onSelect={inv => { setSelectedInvoice(inv); setSheet("invoice"); }} />
      )}
      {sheet === "invoice" && selectedInvoice && selectedTenant && (
        <InvoiceDetailSheet inv={selectedInvoice} tenant={selectedTenant} onClose={() => { setSheet("invoices"); setSelectedInvoice(null); }} onMarkPaid={handleMarkPaid} onEdit={inv => setEditingInvoice(inv)} onDelete={handleDelete} />
      )}
      {editingInvoice && (
        <EditModal inv={editingInvoice} onClose={() => setEditingInvoice(null)} onSave={handleEditSave} />
      )}
    </div>
  );
}
