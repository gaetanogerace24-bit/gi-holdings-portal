import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import SendInvoiceModal from "./SendInvoiceModal";
import PayContractorModal from "./PayContractorModal";

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

// Returns the live total for an invoice — skips late fees if payment is processing
function calcLiveTotal(inv) {
  if (!inv) return 0;
  if (inv.paid) return Number(inv.total || inv.rent || 0);
  if (inv.payment_status === "processing") return Number(inv.total || inv.rent || 0);
  if (inv.is_custom) return Number(inv.rent || 0);
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
  return today >= due ? "overdue" : "upcoming";
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
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#000" }}>✕</button>
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
          color: tab === t.key ? "#1f2937" : "#000",
          boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function Badge({ status }) {
  const cfg = {
    upcoming:   { color: "#2563eb", icon: "📅", label: "Upcoming" },
    overdue:    { color: "#dc2626", icon: "⏱",  label: "Overdue"  },
    completed:  { color: "#16a34a", icon: "✓",  label: "Completed" },
    current:    { color: "#16a34a", icon: "✓",  label: "Current"  },
    archived:   { color: "#000",    icon: "📦", label: "Archived"  },
    processing: { color: "#2563eb", icon: "↻",  label: "Processing" },
    pending:    { color: "#d97706", icon: "⏳", label: "Pending" },
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
      <div style={{ fontSize: 12, color: "#000", marginBottom: 2 }}>{sub}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: amountColor || "#1f2937" }}>{amount}</div>
      <div style={{ fontSize: 12, color: "#000", marginTop: 4 }}>{count} ›</div>
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
      events.push({ date: dayBefore, label: "Payment scheduled", color: "#2563eb", expand: true });
      events.push({ date: dayBefore, label: "Payment processing initiated", color: "#2563eb" });
      events.push({ date: pd, label: "Payment complete", color: "#2563eb", expand: true, bold: true });
    }
  } else if (inv.payment_status === "processing") {
    events.push({ date: new Date(), label: "Payment submitted — processing (3–5 business days)", color: "#2563eb" });
    events.push({ date: null, label: "Waiting for bank transfer to clear", color: "ghost" });
  } else {
    if (!inv.is_custom && overdueDay <= today) {
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
    events.push({ date: null, label: "Waiting for payment", color: "ghost" });
  }
  return (
    <div style={{ padding: "16px 0" }}>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ width: 95, flexShrink: 0, fontSize: 11, color: "#000", paddingTop: 1, textAlign: "right", paddingRight: 10 }}>
            {ev.date ? ev.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
            {ev.color === "ghost" ? <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2px dashed #d1d5db", background: "#fff" }} /> : <div style={{ width: 11, height: 11, borderRadius: "50%", background: ev.color }} />}
            {i < events.length - 1 && <div style={{ width: 2, minHeight: 22, flex: 1, background: ev.color === "ghost" ? "#e5e7eb" : ev.color === "#dc2626" ? "#fca5a5" : "#93c5fd", margin: "2px 0" }} />}
          </div>
          <div style={{ flex: 1, paddingLeft: 10, paddingBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, color: ev.color === "ghost" ? "#9ca3af" : "#1f2937", fontWeight: ev.bold ? 700 : 400 }}>{ev.label}</span>
            {ev.expand && <span style={{ color: "#000", fontSize: 14, marginLeft: 8 }}>›</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceBreakdown({ inv }) {
  const rent = Number(inv?.rent || 0);
  const lateFee = inv?.paid ? Number(inv?.late_fee || 0) : (inv?.is_custom || inv?.payment_status === "processing" ? 0 : calcLateFee(inv?.due_date));
  const total = rent + lateFee;
  const daysLate = lateFee > 35 ? Math.round((lateFee - 35) / 10) : 0;
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 14, color: "#000" }}>{inv?.is_custom ? "Charge amount" : "Monthly Rent"}</span>
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
  const status = inv?.payment_status === "processing" ? "processing" : getStatus(inv);
  const liveFee = inv?.paid ? Number(inv?.late_fee || 0) : (inv?.is_custom || inv?.payment_status === "processing" ? 0 : calcLateFee(inv?.due_date));
  const liveTotal = inv?.payment_status === "processing" ? Number(inv?.total || inv?.rent || 0) : Number(inv?.rent || 0) + liveFee;
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Invoice details" onClose={onClose} />
      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{tenant?.address}</div>
        <div style={{ fontSize: 13, color: "#000", marginTop: 2 }}>{tenant?.name}</div>
      </div>
      <div style={{ margin: "14px 20px", background: "#f9fafb", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#000" }}>{inv?.is_custom ? inv?.month?.split(" —")[0] : "Rent & Fees"}</div>
          <Badge status={status} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{fmt(liveTotal)}</div>
        <div style={{ fontSize: 13, color: "#000" }}>Due {fmtDate(inv?.due_date)}</div>
        {inv?.paid && liveFee > 0 && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>Paid Late</div>}
        <div style={{ fontSize: 11, color: "#000", marginTop: 6 }}>Invoice {invoiceNum(inv?.id)}</div>
      </div>
      {!inv?.paid && inv?.payment_status !== "processing" && !confirmDelete && (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionBtn icon="◉" label="Mark as paid" onClick={() => onMarkPaid(inv)} />
          <ActionBtn icon="✏️" label="Edit invoice" onClick={() => onEdit(inv)} />
          <ActionBtn icon="🗑" label="Delete invoice" onClick={() => setConfirmDelete(true)} danger />
        </div>
      )}
      {inv?.payment_status === "processing" && (
        <div style={{ margin: "0 20px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#1e40af" }}>
          ⏳ Payment is processing — ACH transfer clears in 3–5 business days.
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
          <div style={{ fontSize: 13, color: "#000", marginBottom: 12 }}>This will undo the payment and reset the invoice back to unpaid.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmUnpaid(false)} style={{ flex: 1, padding: 12, border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
            <button onClick={() => { onMarkUnpaid(inv); setConfirmUnpaid(false); }} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: "#d97706", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Yes, mark unpaid</button>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div style={{ margin: "0 20px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>Delete this invoice?</div>
          <div style={{ fontSize: 13, color: "#000", marginBottom: 12 }}>This cannot be undone.</div>
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
        <div style={{ fontSize: 13, color: "#000" }}>{tenant?.name}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
        <div>
          <div style={{ fontSize: 12, color: "#000" }}>Total amount</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(active.reduce((s, i) => s + calcLiveTotal(i), 0))}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#000" }}>Invoices</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{active.length}</div>
        </div>
      </div>
      <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
        {sorted.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#000" }}>No invoices yet</div>}
        {sorted.map((inv, i) => {
          const status = inv.payment_status === "processing" ? "processing" : getStatus(inv);
          const isDeleted = inv.deleted;
          const liveTotal = calcLiveTotal(inv);
          const label = inv.is_custom ? (inv.month?.split(" —")[0] || "Custom charge") : "Rent & Fees";
          return (
            <div key={inv.id} onClick={() => !isDeleted && onSelect(inv)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: isDeleted ? "default" : "pointer", opacity: isDeleted ? 0.45 : 1 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: isDeleted ? "#9ca3af" : "#1f2937" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>Due {fmtDate(inv.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(liveTotal)}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {isDeleted ? <span style={{ color: "#000" }}>🗑 Deleted</span>
                    : status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed {inv.paid_date ? fmtDate(inv.paid_date) : ""}</span>
                    : status === "processing" ? <span style={{ color: "#2563eb", fontWeight: 600 }}>↻ Processing</span>
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
    if (filter === "nextmonth") {
      const parts = (inv.due_date || "").split("T")[0].split("-");
      if (parts.length !== 3) return false;
      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      return due.getMonth() === nextMonth.getMonth() && due.getFullYear() === nextMonth.getFullYear();
    }
    if (filter === "thismonth") {
      if (inv.paid && inv.paid_date) {
        const pd = new Date(inv.paid_date);
        if (!isNaN(pd)) return pd.getMonth() === thisMonth.getMonth() && pd.getFullYear() === thisMonth.getFullYear();
      }
      const parts = (inv.due_date || "").split("T")[0].split("-");
      if (parts.length !== 3) return false;
      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      return due.getMonth() === thisMonth.getMonth() && due.getFullYear() === thisMonth.getFullYear();
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  const totalAmt = filtered.reduce((s, inv) => s + (calcLiveTotal(inv)), 0);
  const filterBtns = defaultFilter === "nextmonth"
    ? [{ key: "nextmonth", label: "Next month" }, { key: "all", label: "All time" }]
    : [{ key: "thismonth", label: "This month" }, { key: "all", label: "All time" }];
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div style={{ display: "flex", margin: "12px 20px 0", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
        {filterBtns.map(btn => (
          <button key={btn.key} onClick={() => setFilter(btn.key)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", background: filter === btn.key ? "#fff" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: filter === btn.key ? "#1f2937" : "#000", boxShadow: filter === btn.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{btn.label}</button>
        ))}
      </div>
      <div style={{ padding: "8px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#000" }}>{sorted.length} invoice{sorted.length !== 1 ? "s" : ""}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{fmt(totalAmt)}</div>
      </div>
      <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "8px 20px", overflow: "hidden" }}>
        {sorted.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#000" }}>No invoices</div>}
        {sorted.map((inv, i) => {
          const tenant = tenants.find(t => t.id === inv.tenant_id);
          const status = inv.payment_status === "processing" ? "processing" : getStatus(inv);
          const liveTotal = calcLiveTotal(inv);
          const label = inv.is_custom ? (inv.month?.split(" —")[0] || "Custom charge") : "Rent & Fees";
          return (
            <div key={inv.id} onClick={() => onSelect(inv, tenant || { name: inv.tenant_name || "Deleted tenant", address: inv.tenant_address || "—" })}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{tenant?.name || inv.tenant_name || "Deleted tenant"}</div>
                <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>{label} · {tenant?.address || inv.tenant_address || "—"}</div>
                <div style={{ fontSize: 12, color: "#000", marginTop: 1 }}>Due {fmtDate(inv.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: status === "overdue" ? "#dc2626" : status === "completed" ? "#16a34a" : "#1f2937" }}>{fmt(liveTotal)}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  {status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Completed</span>
                    : status === "processing" ? <span style={{ color: "#2563eb", fontWeight: 600 }}>↻ Processing</span>
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

function ProcessingSheet({ invoices = [], customInvoices = [], tenants = [], onClose, onSelect }) {
  const tenantName = (id) => tenants.find(t => t.id === id)?.name || "Tenant";
  const total = invoices.length + customInvoices.length;
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Processing" onClose={onClose} />
      {total === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>↻</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No payments processing</div>
          <div style={{ fontSize: 14, color: "#000", lineHeight: 1.6 }}>When a tenant submits a bank payment, it shows here until the ACH transfer clears (3–5 business days), then moves to Completed automatically.</div>
        </div>
      ) : (
        <div style={{ padding: "8px 20px" }}>
          {invoices.map(inv => (
            <div key={inv.id} onClick={() => onSelect && onSelect(inv)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{tenantName(inv.tenant_id)}</div>
                <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>{inv.month}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{fmt(calcLiveTotal(inv))}</div>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>›</span>
              </div>
            </div>
          ))}
          {customInvoices.map(inv => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{tenantName(inv.tenant_id)}</div>
                <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>{inv.title}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{fmt(Number(inv.amount || 0))}</div>
            </div>
          ))}
        </div>
      )}
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
  const leaseStart = tenant?.leaseStart || tenant?.lease_start;
  const leaseEnd = tenant?.leaseEnd || tenant?.lease_end;
  const monthsRemaining = leaseEnd ? Math.max(0, Math.round((new Date(leaseEnd) - new Date()) / (1000 * 60 * 60 * 24 * 30))) : null;
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title="Rent collection details" onClose={onClose} />
      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant?.address}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Badge status={overdueList.length > 0 ? "overdue" : "current"} />
          {monthsRemaining !== null && <span style={{ fontSize: 13, color: "#000" }}>{monthsRemaining} months remaining</span>}
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
              <div style={{ fontSize: 12, color: "#000" }}>{fmtDate(lastPayment.paid_date)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{fmt(lastPayment.total || lastPayment.rent)}</div>
            </> : <div style={{ fontSize: 13, color: "#000" }}>No payments yet</div>}
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Next Payment</div>
            {nextPayment ? <>
              <div style={{ fontSize: 12, color: "#000" }}>Due {fmtDate(nextPayment.due_date)}</div>
              <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{fmt(Number(nextPayment.rent))}</div>
            </> : <div style={{ fontSize: 13, color: "#000" }}>No upcoming</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Current tenant</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{tenant?.name}</div>
          <div style={{ fontSize: 13, color: "#000", marginTop: 4 }}>{tenant?.email || tenant?.login_email || "—"}</div>
          <div style={{ fontSize: 13, color: "#000", marginTop: 2 }}>{tenant?.phone || "—"}</div>
        </div>
      </div>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>End & archive rent collection</div>
        <div style={{ fontSize: 13, color: "#000", marginTop: 4, marginBottom: 12 }}>Tenant will be moved to the Archived tab.</div>
        {!confirmArchive ? (
          <button onClick={() => setConfirmArchive(true)} style={{ width: "100%", padding: 16, background: "#dc2626", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>End & archive</button>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>Are you sure?</div>
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
  const isSection8 = tenant.section8 || tenant.section_8;
  const s8Amount = Number(tenant.section8_amount || tenant.section8Amount || 0);
  const tenantPortion = Number(tenant.tenant_portion || tenant.tenantPortion || 0);
  const leaseStart = tenant.lease_start || tenant.leaseStart || "";
  const leaseEnd = tenant.lease_end || tenant.leaseEnd || "";
  const monthToMonth = tenant.month_to_month || tenant.monthToMonth || false;

  return (
    <div style={{ borderBottom: "1px solid #f3f4f6", padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 20, marginTop: 2, opacity: 0.5 }}>🏢</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>{tenant.address}</div>
            <div style={{ fontSize: 13, color: "#000", marginTop: 2 }}>{tenant.name}</div>
            <div style={{ fontSize: 11, color: "#000", marginTop: 2 }}>Archived {archivedAt}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <Badge status="archived" />
          <div style={{ fontSize: 11, color: "#000", marginTop: 4 }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          {/* Tenant info */}
          <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>Tenant info</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Full name</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{tenant.name || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Address</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{tenant.address || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Email</div>
                <div style={{ fontSize: 13, color: "#1f2937" }}>{tenant.email || tenant.login_email || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Phone</div>
                <div style={{ fontSize: 13, color: "#1f2937" }}>{tenant.phone || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Portal login</div>
                <div style={{ fontSize: 13, color: "#1f2937" }}>{tenant.login_email || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Monthly rent</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{fmt(tenant.rent || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Security deposit</div>
                <div style={{ fontSize: 13, color: "#1f2937" }}>{fmt(tenant.deposit || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Lease term</div>
                <div style={{ fontSize: 13, color: "#1f2937" }}>
                  {monthToMonth ? "Month to month" : leaseStart && leaseEnd ? `${fmtDate(leaseStart)} – ${fmtDate(leaseEnd)}` : "—"}
                </div>
              </div>
              {tenant.notes && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Notes</div>
                  <div style={{ fontSize: 13, color: "#1f2937" }}>{tenant.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Section 8 */}
          {isSection8 && (
            <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>🏛 Section 8</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ background: "#fff", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Housing pays</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0d9488" }}>{fmt(s8Amount)}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Tenant pays</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{fmt(tenantPortion)}</div>
                </div>
                <div style={{ background: "#fff", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Total rent</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{fmt(s8Amount + tenantPortion)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Payment history */}
          <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.7px" }}>Payment history</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmt(totalPaid)} collected</div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              {sorted.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>No invoices</div>}
              {sorted.map((inv, i) => {
                const status = getStatus(inv);
                const liveTotal = calcLiveTotal(inv);
                return (
                  <div key={inv.id} onClick={() => onSelect(inv, tenant)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer", background: "#fff" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#000" }}>{inv.month}</div>
                      <div style={{ fontSize: 11, color: "#000" }}>Due {fmtDate(inv.due_date)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(liveTotal)}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>{status === "completed" ? <span style={{ color: "#16a34a" }}>✓ Paid</span> : <span style={{ color: "#dc2626" }}>Unpaid</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete */}
          <div style={{ paddingTop: 4 }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "8px 16px", background: "none", border: "1.5px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>🗑 Delete from archive</button>
            ) : (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Delete {tenant.name} from archive?</div>
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

export default function AdminPayments({ tenants = [], invoices: propInvoices = [], setInvoices: propSetInvoices, initialProcessingCustomInvoices = [], initialPaidCustomInvoices = [], initialPaidClientInvoices = [] }) {
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
  const [selectedSentInvoice, setSelectedSentInvoice] = useState(null);
  const [showPayContractor, setShowPayContractor] = useState(false);
  const [processingCustomInvoices, setProcessingCustomInvoices] = useState(initialProcessingCustomInvoices);
  const [paidCustomInvoices] = useState(initialPaidCustomInvoices);
  const [paidClientInvoices] = useState(initialPaidClientInvoices);
  console.log("paidCustomInvoices:", initialPaidCustomInvoices, paidCustomInvoices);

  useEffect(() => { setInvoicesLocal(propInvoices); }, [propInvoices]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("tenants").select("*").eq("archived", true);
      if (data) setArchivedTenants(data);
    };
    load();
  }, []);


  const reloadInvoices = async () => {
    const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (data) setInvoices(data);
  };

  const now = new Date();
  const currentMonthName = getCurrentMonthName();
  const allActive = invoices.filter(i => !i.deleted);
  const activeTenants = tenants.filter(t => !t.archived);
  const activeTenantIds = new Set(activeTenants.map(t => t.id));
  const allActiveNonArchived = allActive.filter(i => !i.tenant_id || activeTenantIds.has(i.tenant_id));

  const unpaidList = allActiveNonArchived.filter(i => !i.paid && i.payment_status !== "processing" && getStatus(i) === "upcoming" && (() => { const parts = (i.due_date || "").split("T")[0].split("-"); if (parts.length !== 3) return false; const due = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])); return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear(); })());
  const unpaidTotal = unpaidList.reduce((s, i) => s + Number(i.rent || 0), 0);
  const upcomingList   = allActiveNonArchived.filter(i => !i.paid && i.payment_status !== "processing" && getStatus(i) === "upcoming");
  const overdueList    = allActiveNonArchived.filter(i => !i.paid && i.payment_status !== "processing" && getStatus(i) === "overdue");
  const completedList  = allActiveNonArchived.filter(i => i.paid);
  const processingList = allActiveNonArchived.filter(i => !i.paid && i.payment_status === "processing");

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const upcomingNextMonth = upcomingList.filter(i => {
    const parts = (i.due_date || "").split("T")[0].split("-");
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return due.getMonth() === nextMonthDate.getMonth() && due.getFullYear() === nextMonthDate.getFullYear();
  });

  const completedThisMonth = completedList.filter(i => {
    if (i.paid_date) {
      const pd = new Date(i.paid_date);
      if (!isNaN(pd)) return pd.getMonth() === now.getMonth() && pd.getFullYear() === now.getFullYear();
    }
    const parts = (i.due_date || "").split("T")[0].split("-");
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
  });

  const upcomingTotal   = upcomingNextMonth.reduce((s, i) => s + Number(i.rent || 0), 0);
  const overdueTotal    = overdueList.reduce((s, i) => s + calcLiveTotal(i), 0);
  const paidCustomThisMonth = paidCustomInvoices;
  const completedTotal = completedThisMonth.reduce((s, i) => s + Number(i.total || i.rent || 0), 0)
    + paidCustomThisMonth.reduce((s, i) => s + Number(i.amount || 0), 0)
    + paidClientInvoices.filter(i => {
        if (!i.updated_at) return false;
        const d = new Date(i.updated_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((s, i) => s + Number(i.amount || 0), 0);
  const completedCount = completedThisMonth.length + paidCustomThisMonth.length
    + paidClientInvoices.filter(i => {
        if (!i.updated_at) return false;
        const d = new Date(i.updated_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
  const processingTotal = processingList.reduce((s, i) => s + calcLiveTotal(i), 0)
    + processingCustomInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const processingCount = processingList.length + processingCustomInvoices.length;

  const section8Tenants = activeTenants.filter(t => t.section8 && (Number(t.section8_amount || t.section8Amount || 0) > 0));
  const section8Total = section8Tenants.reduce((s, t) => s + Number(t.section8_amount || t.section8Amount || 0), 0);

  const tenantInvoices = (id) => allActive.filter(i => i.tenant_id === id);
  const getOverdueCount = (t) => tenantInvoices(t.id).filter(i => !i.paid && getStatus(i) === "overdue").length;
  const getDisplayAmount = (t) => {
    const thisMonth = tenantInvoices(t.id).find(i => i.month === currentMonthName);
    return thisMonth ? calcLiveTotal(thisMonth) : Number(t.rent || 0);
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
    if (inv.is_custom) {
      await supabase.from("custom_invoices").delete().eq("tenant_id", inv.tenant_id).eq("amount", Number(inv.rent));
      setSentInvoices(prev => prev.filter(i => !(i.tenant_id === inv.tenant_id && Number(i.amount) === Number(inv.rent))));
    }
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
    const [{ data: tenantInvs }, { data: clientInvs }] = await Promise.all([
      supabase.from("custom_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("contractor_payments").select("*").order("created_at", { ascending: false }),
    ]);
    const merged = [
      ...(tenantInvs || []).map(i => ({ ...i, _type: "tenant" })),
      ...(clientInvs || []).map(i => ({
        ...i,
        _type: "client",
        title: i.description,
        paid: i.status === "paid" || i.status === "completed",
        _clientStatus: i.status,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setSentInvoices(merged);
  };

  const handleDeleteCustomInvoice = async (id, type) => {
    if (type === "client") {
      await supabase.from("contractor_payments").delete().eq("id", id);
    } else {
      const inv = sentInvoices.find(i => i.id === id);
      await supabase.from("custom_invoices").delete().eq("id", id);
      if (inv) {
        await supabase.from("invoices").delete().eq("tenant_id", inv.tenant_id).eq("is_custom", true).eq("rent", Number(inv.amount));
      }
      reloadInvoices();
    }
    setSentInvoices(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateClientStatus = async (id, newStatus) => {
    await supabase.from("contractor_payments").update({ status: newStatus }).eq("id", id);
    setSentInvoices(prev => prev.map(i => i.id === id ? { ...i, _clientStatus: newStatus, paid: newStatus === "paid" || newStatus === "completed" } : i));
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

  const clientStatusColor = (s) => s === "completed" ? "#16a34a" : s === "processing" ? "#2563eb" : s === "paid" ? "#16a34a" : "#dc2626";
  const clientStatusLabel = (s) => s === "completed" ? "✓ Completed" : s === "processing" ? "↻ Processing" : s === "paid" ? "✓ Paid" : "⏱ Unpaid";

  // Helper to get tenant invoice status label
  const getTenantInvStatusLabel = (inv) => {
    if (inv.paid) return <span style={{ color: "#16a34a" }}>✓ Paid</span>;
    if (inv.payment_status === "processing") return <span style={{ color: "#2563eb", fontWeight: 600 }}>↻ Processing</span>;
    return <span style={{ color: "#dc2626", fontWeight: 600 }}>⏱ Unpaid</span>;
  };

  return (
    <div className="admin-page-content" style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", maxWidth: 580 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Rent Collection</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <SummaryCard badgeColor="#16a34a" badgeLabel="✓ Completed" badgeBorder={true} sub="This month" amount={fmt(completedTotal)} amountColor="#16a34a" count={`${completedCount} invoice${completedCount !== 1 ? "s" : ""}`} onClick={() => setSheet("allCompleted")} />
        <div onClick={() => overdueList.length > 0 && setSheet("allOverdue")} style={{ cursor: overdueList.length > 0 ? "pointer" : "default" }}>
          <SummaryCard badgeColor="#dc2626" badgeLabel="⏱ Overdue" badgeBorder={true} sub="All time" amount={fmt(overdueTotal)} amountColor={overdueTotal > 0 ? "#dc2626" : undefined} count={`${overdueList.length} invoice${overdueList.length !== 1 ? "s" : ""}`} />
        </div>
        <SummaryCard badgeColor="#2563eb" badgeLabel="↻ Processing" badgeBorder={true} sub="All time" amount={fmt(processingTotal)} amountColor={processingTotal > 0 ? "#2563eb" : undefined} count={`${processingCount} invoice${processingCount !== 1 ? "s" : ""}`} onClick={() => setSheet("processing")} />
        <SummaryCard badgeColor="#000" badgeLabel="📅 Upcoming" badgeBorder={false} sub="Next month" amount={fmt(upcomingTotal)} count={`${upcomingNextMonth.length} invoice${upcomingNextMonth.length !== 1 ? "s" : ""}`} onClick={() => setSheet("allUpcoming")} />
        <div style={{ gridColumn: "1 / -1" }}>
          <SummaryCard badgeColor="#0d9488" badgeLabel="🏛 Section 8" badgeBorder={true} sub="Expected this month" amount={fmt(section8Total)} amountColor="#0d9488" count={`${section8Tenants.length} tenant${section8Tenants.length !== 1 ? "s" : ""}`} onClick={() => setSheet("section8")} />
        </div>
      </div>

      <button onClick={() => setShowSendInvoice(true)} style={{ width: "100%", padding: 16, background: "#0f1a14", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        📤 Send Invoice
      </button>

      <button onClick={() => setShowPayContractor(true)} style={{ width: "100%", padding: 14, background: "none", border: "1.5px solid #1b3d2a", borderRadius: 12, color: "#1b3d2a", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        📋 Send Invoice to Client
      </button>

      <div style={{ marginBottom: 14 }}>
        <button onClick={() => { loadSentInvoices(); setSelectedSentInvoice(null); setShowSentInvoices(true); }} style={{ background: "none", border: "none", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          View sent invoices →
        </button>
      </div>

      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {["active", "archived"].map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", background: mainTab === t ? "#fff" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: mainTab === t ? "#1f2937" : "#000", boxShadow: mainTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "archived" && archivedTenants.length > 0 && (
              <span style={{ marginLeft: 6, background: "#e5e7eb", color: "#000", fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 6 }}>{archivedTenants.length}</span>
            )}
          </button>
        ))}
      </div>

      {mainTab === "active" && (
        <div>
          {activeTenants.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#000" }}>No active tenants</div>}
          {activeTenants.map(tenant => {
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
                      <div style={{ fontSize: 13, color: "#000", marginTop: 2 }}>{tenant.name}</div>
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
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#000" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No archived tenants</div>
            </div>
          ) : (
            archivedTenants.map(tenant => (
              <ArchivedTenantCard key={tenant.id} tenant={tenant} invoices={allActive.filter(i => i.tenant_id === tenant.id)} onSelect={(inv, t) => { setSelectedInvoice(inv); setSelectedTenant(t); setSheet("invoice"); }} onDelete={handleDeleteArchived} />
            ))
          )}
        </div>
      )}

      {sheet === "allUnpaid" && <FilteredInvoiceSheet title="Unpaid Invoices" invoices={unpaidList} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv, tenant) => { setSelectedInvoice(inv); setSelectedTenant(tenant); setSheet("invoice"); }} defaultFilter="thismonth" />}
      {sheet === "allUpcoming" && <FilteredInvoiceSheet title="Upcoming Invoices" invoices={upcomingList} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv, tenant) => { setSelectedInvoice(inv); setSelectedTenant(tenant); setSheet("invoice"); }} defaultFilter="nextmonth" />}
      {sheet === "allCompleted" && <FilteredInvoiceSheet title="Completed Invoices" invoices={[...completedList, ...paidCustomInvoices.map(i => ({ ...i, paid: true, rent: i.amount, is_custom: true, month: i.title })), ...paidClientInvoices.map(i => ({ ...i, paid: true, rent: i.amount, is_custom: true, month: i.description, due_date: i.updated_at, tenant_name: i.name, tenant_address: "Client invoice", paid_date: i.updated_at }))]} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv, tenant) => { setSelectedInvoice(inv); setSelectedTenant(tenant); setSheet("invoice"); }} defaultFilter="thismonth" />}
      {sheet === "processing" && <ProcessingSheet invoices={processingList} customInvoices={processingCustomInvoices} tenants={tenants} onClose={() => setSheet(null)} onSelect={(inv) => { setSelectedInvoice(inv); setSheet(null); }} />}
      {sheet === "section8" && (
        <Sheet onClose={() => setSheet(null)}>
          <SheetHeader title="Section 8 / Housing Authority" onClose={() => setSheet(null)} />
          <div style={{ padding: "8px 20px 4px" }}>
            <div style={{ fontSize: 13, color: "#0d9488", fontWeight: 600, marginBottom: 4 }}>
              {section8Tenants.length} tenant{section8Tenants.length !== 1 ? "s" : ""} — {fmt(section8Total)} expected this month
            </div>
          </div>
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "8px 20px", overflow: "hidden" }}>
            {section8Tenants.map((t, i) => {
              const s8 = Number(t.section8_amount || t.section8Amount || 0);
              const tp = Number(t.tenant_portion || t.tenantPortion || 0);
              return (
                <div key={t.id} style={{ padding: "14px 16px", borderBottom: i < section8Tenants.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.address}</div>
                  </div>
                  <div style={{ marginTop: 8, background: "#f0fdfa", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>🏛 Housing: <strong>{fmt(s8)}</strong></span>
                    <span>🏠 Tenant: <strong>{fmt(tp)}</strong></span>
                    <span>Total: <strong>{fmt(s8 + tp)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 32 }} />
        </Sheet>
      )}
      {sheet === "allOverdue" && (
        <Sheet onClose={() => setSheet(null)}>
          <SheetHeader title="Overdue Invoices" onClose={() => setSheet(null)} />
          <div style={{ padding: "8px 20px 4px" }}>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{overdueList.length} overdue — {fmt(overdueTotal)} total</div>
          </div>
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
            {overdueList.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              const liveTotal = calcLiveTotal(inv);
              return (
                <div key={inv.id} onClick={() => { setSelectedTenant(tenant); setSelectedInvoice(inv); setSheet("invoice"); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: i < overdueList.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{tenant?.name}</div>
                    <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>{tenant?.address}</div>
                    <div style={{ fontSize: 12, color: "#000", marginTop: 1 }}>Due {fmtDate(inv.due_date)}</div>
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

      {showSentInvoices && !selectedSentInvoice && (
        <Sheet onClose={() => { setShowSentInvoices(false); setSelectedSentInvoice(null); }}>
          <SheetHeader title="Sent Invoices" onClose={() => setShowSentInvoices(false)} />
          <div style={{ padding: "8px 20px 4px" }}>
            <div style={{ fontSize: 13, color: "#000" }}>{sentInvoices.length} invoice{sentInvoices.length !== 1 ? "s" : ""} sent</div>
          </div>
          <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "12px 20px", overflow: "hidden" }}>
            {sentInvoices.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#000" }}>No invoices sent yet</div>}
            {sentInvoices.map((inv, i) => {
              const tenant = tenants.find(t => t.id === inv.tenant_id);
              const isClient = inv._type === "client";
              const displayName = isClient ? inv.name : tenant?.name;
              const displaySub = isClient ? "Client invoice" : tenant?.address;
              const displayTitle = isClient ? inv.description : inv.title;
              const baseAmount = Number(inv.amount || 0);
              const calcInvLateFee = () => {
                if (!inv.late_fee_enabled || inv.paid || inv.status === "completed") return 0;
                const startDay = inv.late_fee_start_day;
                const initialFee = Number(inv.initial_late_fee || 0);
                const dailyFee = Number(inv.daily_late_fee || 0);
                const dateStr = inv.due_date || inv.date;
                if (!dateStr || !startDay) return 0;
                const today = new Date(); today.setHours(0,0,0,0);
                const parts = dateStr.split("T")[0].split("-");
                const due = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
                const feeStart = new Date(due.getFullYear(), due.getMonth(), startDay);
                if (today < feeStart) return 0;
                const msPerDay = 1000*60*60*24;
                const daysLate = Math.floor((today.getTime() - feeStart.getTime()) / msPerDay);
                return initialFee + (daysLate * dailyFee);
              };
              const displayAmount = baseAmount + calcInvLateFee();
              return (
                <div key={inv.id}
                  onClick={() => setSelectedSentInvoice(inv)}
                  style={{ padding: "14px 16px", borderBottom: i < sentInvoices.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: isClient ? "#eff6ff" : "#f0f9f4", color: isClient ? "#2563eb" : "#166534", border: `1px solid ${isClient ? "#93c5fd" : "#bbf7d0"}`, borderRadius: 4, padding: "1px 6px" }}>
                          {isClient ? "CLIENT" : "TENANT"}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{displayTitle}</div>
                      <div style={{ fontSize: 12, color: "#000", marginTop: 2 }}>{displayName} · {displaySub}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {isClient ? (
                          <span style={{ color: clientStatusColor(inv._clientStatus), fontWeight: 600 }}>{clientStatusLabel(inv._clientStatus)}</span>
                        ) : (
                          getTenantInvStatusLabel(inv)
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{fmt(displayAmount)}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>Tap to view ›</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 32 }} />
        </Sheet>
      )}

      {showSentInvoices && selectedSentInvoice && (() => {
        const inv = selectedSentInvoice;
        const isClient = inv._type === "client";
        const tenant = !isClient ? tenants.find(t => t.id === inv.tenant_id) : null;

        // Shared fields
        const displayName = isClient ? inv.name : (tenant?.name || "—");
        const displaySub = isClient ? "Client invoice" : (tenant?.address || "—");
        const displayTitle = isClient ? inv.description : inv.title;
        const baseDisplayAmount = Number(inv.amount || 0);
        const displayAmount = baseDisplayAmount;

        // Late fee fields
        const lateFeeOn = inv.late_fee_enabled;
        const startDay = inv.late_fee_start_day;
        const initialFee = inv.initial_late_fee;
        const dailyFee = inv.daily_late_fee;

        // Compute late fee start date for tenant invoices with due_date
        let lateFeeStartDate = null;
        if (lateFeeOn && inv.due_date && startDay) {
          const parts = inv.due_date.split("T")[0].split("-");
          if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(startDay));
            lateFeeStartDate = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          }
        }

        return (
          <Sheet onClose={() => setSelectedSentInvoice(null)}>
            <div style={{ display: "flex", alignItems: "center", padding: "20px 20px 0", gap: 10 }}>
              <button onClick={() => setSelectedSentInvoice(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#000", padding: 0 }}>‹</button>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Invoice details</div>
            </div>

            {/* Header card */}
            <div style={{ margin: "14px 20px", background: "#f9fafb", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: isClient ? "#eff6ff" : "#f0f9f4", color: isClient ? "#2563eb" : "#166534", border: `1px solid ${isClient ? "#93c5fd" : "#bbf7d0"}`, borderRadius: 4, padding: "1px 6px" }}>
                  {isClient ? "CLIENT" : "TENANT"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#000", marginBottom: 4 }}>{displayName} · {displaySub}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{fmt(displayAmount)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1f2937", marginBottom: 8 }}>{displayTitle}</div>
              {inv.notes && <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{inv.notes}</div>}

              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {isClient && inv.email && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Email</span>
                    <span style={{ color: "#1f2937" }}>{inv.email}</span>
                  </div>
                )}
                {isClient && inv.phone && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Phone</span>
                    <span style={{ color: "#1f2937" }}>{inv.phone}</span>
                  </div>
                )}
                {isClient && inv.date && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Invoice date</span>
                    <span style={{ color: "#1f2937" }}>{fmtDate(inv.date)}</span>
                  </div>
                )}
                {isClient && inv.completion_date && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>Job completed</span>
                    <span style={{ color: "#1f2937" }}>{fmtDate(inv.completion_date)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#6b7280" }}>Due</span>
                  <span style={{ color: "#1f2937" }}>{isClient ? "Upon receipt" : fmtDate(inv.due_date)}</span>
                </div>
              </div>

              {/* Status */}
              {isClient ? (
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: clientStatusColor(inv._clientStatus), fontWeight: 600, fontSize: 13 }}>{clientStatusLabel(inv._clientStatus)}</span>
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>{getTenantInvStatusLabel(inv)}</div>
              )}

              {/* Payment link for clients */}
              {isClient && inv.stripe_payment_link && (
                <div style={{ marginTop: 10 }}>
                  🔗 <a href={inv.stripe_payment_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>View payment link</a>
                </div>
              )}
            </div>

            {/* Late fee rules */}
            {lateFeeOn ? (
              <div style={{ margin: "0 20px 16px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#991b1b", marginBottom: 10 }}>⚠️ Late fee rules</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#000" }}>Fees start</span>
                    <span style={{ fontWeight: 600, color: "#1f2937" }}>Day {startDay} of the month{lateFeeStartDate ? ` (${lateFeeStartDate})` : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#000" }}>Initial fee</span>
                    <span style={{ fontWeight: 600, color: "#dc2626" }}>{fmt(initialFee)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#000" }}>Daily fee after that</span>
                    <span style={{ fontWeight: 600, color: "#dc2626" }}>{fmt(dailyFee)}/day</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ margin: "0 20px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, fontSize: 13, color: "#6b7280" }}>
                No late fee rules on this invoice.
              </div>
            )}

            {/* Late fee tracker */}
            {lateFeeOn && (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              // Determine fee start date
              const refDateStr = isClient ? inv.date : inv.due_date;
              let feeStartDate = null;
              if (refDateStr && startDay) {
                const parts = refDateStr.split("T")[0].split("-");
                if (parts.length === 3) {
                  feeStartDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(startDay));
                  feeStartDate.setHours(0, 0, 0, 0);
                }
              }

              const msPerDay = 1000 * 60 * 60 * 24;
              const isLate = feeStartDate && today >= feeStartDate;
              const daysLate = isLate ? Math.floor((today.getTime() - feeStartDate.getTime()) / msPerDay) : 0;
              const feesAccrued = isLate ? Number(initialFee) + (daysLate * Number(dailyFee)) : 0;
              const totalOwed = displayAmount + feesAccrued;

              const cardBg = isLate ? "#fef2f2" : "#f9fafb";
              const numColor = isLate ? "#dc2626" : "#1f2937";
              const labelColor = isLate ? "#991b1b" : "#6b7280";

              return (
                <div style={{ margin: "0 20px 16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 12 }}>Late fee tracker</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div style={{ background: cardBg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>Status</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: numColor }}>
                        {isLate ? `${daysLate} day${daysLate !== 1 ? "s" : ""} late` : "Not late yet"}
                      </div>
                    </div>
                    <div style={{ background: cardBg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>Days late</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: numColor }}>{daysLate}</div>
                    </div>
                    <div style={{ background: cardBg, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>Fees accrued</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: numColor }}>{fmt(feesAccrued)}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${isLate ? "#fca5a5" : "#e5e7eb"}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: isLate ? "#991b1b" : "#6b7280", fontWeight: 600 }}>Total now owed</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: isLate ? "#dc2626" : "#1f2937" }}>{fmt(totalOwed)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Delete button */}
            <div style={{ padding: "0 20px" }}>
              <button onClick={() => { handleDeleteCustomInvoice(inv.id, inv._type); setSelectedSentInvoice(null); }}
                style={{ width: "100%", padding: 14, border: "1.5px solid #fca5a5", borderRadius: 12, background: "#fff", color: "#dc2626", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                🗑 Delete invoice
              </button>
            </div>
            <div style={{ height: 32 }} />
          </Sheet>
        );
      })()}

      {showSendInvoice && (
        <SendInvoiceModal
          tenants={activeTenants}
          onClose={() => setShowSendInvoice(false)}
          onSent={() => { setShowSendInvoice(false); reloadInvoices(); }}
        />
      )}
      {showPayContractor && <PayContractorModal onClose={() => setShowPayContractor(false)} />}
      {editingInvoice && <EditModal inv={editingInvoice} onClose={() => setEditingInvoice(null)} onSave={handleEditSave} />}
    </div>
  );
}







