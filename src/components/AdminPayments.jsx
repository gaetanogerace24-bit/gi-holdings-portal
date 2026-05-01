import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getCurrentMonthName() {
  const now = new Date();
  return MONTH_NAMES[now.getMonth()] + " " + now.getFullYear();
}

function formatCurrency(amount) {
  return "$" + Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function generateInvoiceNumber(invoiceId) {
  if (!invoiceId) return "—";
  const hash = String(invoiceId).replace(/-/g, "").slice(0, 7).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `#${hash}-${suffix}`;
}

function getInvoiceStatus(inv) {
  if (!inv) return "upcoming";
  if (inv.paid) return "completed";
  const now = new Date();
  const due = new Date(inv.due_date || `${inv.year}-${String(inv.month_num || 1).padStart(2,"0")}-01`);
  if (now > due) return "overdue";
  return "upcoming";
}

function StatusBadge({ status, small }) {
  const configs = {
    upcoming:  { bg: "transparent", color: "#2563eb", border: "1.5px solid #2563eb", icon: "📅", label: "Upcoming" },
    overdue:   { bg: "transparent", color: "#dc2626", border: "1.5px solid #dc2626", icon: "⏱", label: "Overdue" },
    completed: { bg: "transparent", color: "#16a34a", border: "1.5px solid #16a34a", icon: "✓", label: "Completed" },
    processing:{ bg: "transparent", color: "#2563eb", border: "1.5px solid #2563eb", icon: "↻", label: "Processing" },
    current:   { bg: "transparent", color: "#16a34a", border: "1.5px solid #16a34a", icon: "✓", label: "Current" },
  };
  const cfg = configs[status] || configs.upcoming;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "2px 8px" : "4px 10px",
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: cfg.border,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// Payment Timeline Component
function PaymentTimeline({ invoice, tenant }) {
  const events = [];
  if (!invoice) return null;

  const createdDate = invoice.created_at ? new Date(invoice.created_at) : new Date();
  events.push({ date: createdDate, label: "Invoice created", type: "blue" });

  const dueDate = new Date(invoice.due_date || `${invoice.year}-${String(invoice.month_num || 1).padStart(2,"0")}-01`);
  const now = new Date();

  if (!invoice.paid) {
    const overdueDate = new Date(dueDate);
    overdueDate.setDate(overdueDate.getDate() + 1);
    if (now > overdueDate) {
      events.push({ date: overdueDate, label: "Payment overdue", type: "red", expandable: true });

      // Late fee start (day 5)
      const feeStartDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 5);
      if (now >= feeStartDate) {
        events.push({ date: feeStartDate, label: "$35.00 one-time late fee added", type: "red", expandable: true });

        // Daily fees from day 6
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysOfDailyFees = Math.floor((now - feeStartDate) / msPerDay);
        for (let d = 1; d <= daysOfDailyFees; d++) {
          const feeDate = new Date(feeStartDate.getTime() + d * msPerDay);
          events.push({ date: feeDate, label: "$10.00 daily late fee added", type: "red", expandable: true });
        }
      }
    }
    events.push({ date: null, label: "Waiting for tenant to schedule payment", type: "ghost" });
  } else {
    // Paid invoice timeline
    if (invoice.paid_date) {
      const paidDateObj = new Date(invoice.paid_date);
      events.push({ date: paidDateObj, label: "Tenant scheduled payment", type: "blue", expandable: true });
      events.push({ date: paidDateObj, label: "Payment processing initiated", type: "blue" });
      const completedDate = new Date(paidDateObj.getTime() + 6 * 24 * 60 * 60 * 1000);
      events.push({ date: completedDate, label: "Payment complete", type: "blue", expandable: true, bold: true });
    }
  }

  return (
    <div style={{ padding: "16px 0" }}>
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 0 }}>
          {/* Date column */}
          <div style={{ width: 90, flexShrink: 0, fontSize: 13, color: "#6b7280", paddingTop: 2, textAlign: "right" }}>
            {ev.date ? ev.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
          </div>

          {/* Timeline dot + line */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
            {ev.type === "ghost" ? (
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px dashed #d1d5db", background: "#fff", flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                background: ev.type === "red" ? "#dc2626" : "#2563eb",
              }} />
            )}
            {i < events.length - 1 && (
              <div style={{
                width: 2, flex: 1, minHeight: 24,
                background: ev.type === "ghost" ? "#e5e7eb" : (ev.type === "red" ? "#fca5a5" : "#93c5fd"),
                margin: "2px 0",
              }} />
            )}
          </div>

          {/* Label */}
          <div style={{ flex: 1, fontSize: 13, color: ev.type === "ghost" ? "#9ca3af" : "#1f2937", fontWeight: ev.bold ? 700 : 400, paddingTop: 0, paddingBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span>{ev.label}</span>
            {ev.expandable && <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>›</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Invoice Breakdown Component
function InvoiceBreakdown({ invoice, tenant }) {
  const rent = Number(invoice?.rent || 0);
  const lateFee = Number(invoice?.late_fee || 0);
  const total = Number(invoice?.total || rent);

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 14, color: "#6b7280" }}>Monthly Rent</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(rent)}</span>
      </div>
      {lateFee > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 14, color: "#dc2626" }}>Late Fees</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>{formatCurrency(lateFee)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(total)}</span>
      </div>
      <div style={{ marginTop: 16, padding: "12px", background: "#f9fafb", borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Late fee policy</div>
        <div style={{ fontSize: 13, color: "#374151" }}>$35.00 if late by 4 days</div>
        <div style={{ fontSize: 13, color: "#374151" }}>+$10.00 per additional day</div>
      </div>
    </div>
  );
}

// Invoice Detail Sheet
function InvoiceDetailSheet({ invoice, tenant, onClose, onMarkPaid, onEdit, onDelete }) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = getInvoiceStatus(invoice);
  const invoiceNum = generateInvoiceNumber(invoice?.id);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "rgba(0,0,0,0.4)", position: "absolute", inset: 0 }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto", padding: "0 0 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Invoice details</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{tenant?.address}</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>{tenant?.name}</div>
        </div>

        {/* Invoice card */}
        <div style={{ margin: "16px 20px", background: "#f9fafb", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Rent & Fees</div>
            <StatusBadge status={status} small />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>{formatCurrency(invoice?.total || invoice?.rent)}</div>
          {invoice?.paid && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Paid Late</div>}
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
            Due {formatDate(invoice?.due_date)}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>Invoice {invoiceNum}</div>
          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Receiving bank account</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>M&T Bank Checking - 4248</div>
          </div>
        </div>

        {/* Action buttons */}
        {!invoice?.paid && (
          <>
            <div style={{ padding: "0 20px 12px" }}>
              <button onClick={() => onMarkPaid(invoice)} style={{ width: "100%", padding: "14px", border: "1.5px solid #e5e7eb", borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 600, color: "#1f2937", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
                <span>◉</span> Mark as paid
              </button>
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              <button onClick={() => onEdit(invoice)} style={{ width: "100%", padding: "14px", border: "1.5px solid #e5e7eb", borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 600, color: "#1f2937", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
                <span>✏️</span> Edit invoice
              </button>
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", padding: "14px", border: "1.5px solid #fee2e2", borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 600, color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
                🗑 Delete invoice
              </button>
            </div>
          </>
        )}

        {confirmDelete && (
          <div style={{ margin: "0 20px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#991b1b", marginBottom: 8 }}>Delete this invoice?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px", border: "1.5px solid #e5e7eb", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={() => onDelete(invoice)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Delete</button>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #f3f4f6", margin: "0 20px" }} />

        {/* Tabs */}
        <div style={{ display: "flex", margin: "16px 20px 0", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
          {["timeline", "breakdown"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
              background: activeTab === t ? "#fff" : "transparent",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
              color: activeTab === t ? "#1f2937" : "#6b7280",
              boxShadow: activeTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
              {t === "timeline" ? "Payment timeline" : "Invoice breakdown"}
            </button>
          ))}
        </div>

        <div style={{ padding: "0 20px" }}>
          {activeTab === "timeline" && <PaymentTimeline invoice={invoice} tenant={tenant} />}
          {activeTab === "breakdown" && <InvoiceBreakdown invoice={invoice} tenant={tenant} />}
        </div>
      </div>
    </div>
  );
}

// Invoice List Sheet
function InvoiceListSheet({ tenant, invoices, onClose, onSelectInvoice, onAddInvoice }) {
  const sortedInvoices = [...invoices].sort((a, b) => new Date(b.due_date || b.created_at) - new Date(a.due_date || a.created_at));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "rgba(0,0,0,0.4)", position: "absolute", inset: 0 }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto", padding: "0 0 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Invoices</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ padding: "8px 20px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{tenant?.address}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{tenant?.name}</div>
        </div>

        <div style={{ padding: "12px 20px" }}>
          <button onClick={onAddInvoice} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
            ⊕ Add invoice
          </button>
        </div>

        <div style={{ border: "1px solid #f3f4f6", borderRadius: 12, margin: "0 20px", overflow: "hidden" }}>
          {sortedInvoices.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No invoices yet</div>
          )}
          {sortedInvoices.map((inv, i) => {
            const status = getInvoiceStatus(inv);
            const isDeleted = inv.deleted;
            return (
              <div key={inv.id} onClick={() => !isDeleted && onSelectInvoice(inv)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px",
                borderBottom: i < sortedInvoices.length - 1 ? "1px solid #f3f4f6" : "none",
                cursor: isDeleted ? "default" : "pointer",
                opacity: isDeleted ? 0.5 : 1,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: isDeleted ? "#9ca3af" : "#1f2937" }}>
                    {inv.month || "Rent"} & Fees
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    Due {formatDate(inv.due_date)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(inv.total || inv.rent)}</div>
                  {isDeleted ? (
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>🗑 Deleted</div>
                  ) : status === "completed" ? (
                    <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>✓ Completed {inv.paid_date ? formatDate(inv.paid_date) : ""}</div>
                  ) : status === "overdue" ? (
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>⏱ Overdue</div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2 }}>📅 Upcoming</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Rent Collection Detail Sheet
function RentCollectionDetailSheet({ tenant, invoices, onClose, onViewInvoices }) {
  const sortedInvoices = [...invoices].sort((a, b) => new Date(b.due_date || b.created_at) - new Date(a.due_date || a.created_at));
  const paidInvoices = sortedInvoices.filter(inv => inv.paid);
  const lastPayment = paidInvoices[0] || null;
  const upcomingInvoices = sortedInvoices.filter(inv => !inv.paid && getInvoiceStatus(inv) === "upcoming");
  const nextPayment = upcomingInvoices[upcomingInvoices.length - 1] || sortedInvoices.find(inv => !inv.paid) || null;

  const leaseStart = tenant?.leaseStart || tenant?.lease_start;
  const leaseEnd = tenant?.leaseEnd || tenant?.lease_end;

  const monthsRemaining = leaseEnd ? Math.max(0, Math.round((new Date(leaseEnd) - new Date()) / (1000 * 60 * 60 * 24 * 30))) : null;

  const tenantStatus = invoices.some(inv => !inv.paid && getInvoiceStatus(inv) === "overdue") ? "overdue" : "current";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "rgba(0,0,0,0.4)", position: "absolute", inset: 0 }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "92vh", overflowY: "auto", padding: "0 0 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Rent collection details</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{tenant?.address}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.address}, Youngstown, OH</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <StatusBadge status={tenantStatus} small />
            {monthsRemaining !== null && (
              <span style={{ fontSize: 13, color: "#6b7280" }}>{monthsRemaining} months remaining</span>
            )}
          </div>
        </div>

        {/* Payments section */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Payments</div>
            <button onClick={onViewInvoices} style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>View all invoices</button>
          </div>

          {/* Overdue alert */}
          {tenantStatus === "overdue" && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                <span>✕</span>
                {invoices.filter(inv => !inv.paid && getInvoiceStatus(inv) === "overdue").length} Overdue invoice
              </div>
              <button onClick={onViewInvoices} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 13, fontWeight: 700, textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>View</button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Last Payment</div>
              {lastPayment ? (
                <>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDate(lastPayment.paid_date || lastPayment.due_date)}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{formatCurrency(lastPayment.total || lastPayment.rent)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                    Rent & fees <span style={{ color: "#9ca3af" }}>›</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No payments yet</div>
              )}
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Next Payment</div>
              {nextPayment ? (
                <>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Due {formatDate(nextPayment.due_date)}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{formatCurrency(nextPayment.total || nextPayment.rent)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                    Rent & fees <span style={{ color: "#9ca3af" }}>›</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No upcoming</div>
              )}
            </div>
          </div>
        </div>

        {/* Current tenant */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Current tenant</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{tenant?.name}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{tenant?.contactEmail || tenant?.contact_email}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.phone || "—"}</div>
          </div>
        </div>

        {/* Rent collection terms */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Rent collection terms</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
            {/* Timeline dots */}
            {leaseStart && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(leaseStart)}</div>
              </div>
            )}
            {leaseEnd && (
              <>
                <div style={{ width: 2, height: 16, background: "#93c5fd", marginLeft: 4, marginBottom: 6 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(leaseEnd)}</div>
                </div>
              </>
            )}

            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>First monthly rent payment on {formatDate(invoices.filter(i => !i.paid || i.paid)[0]?.due_date)}</span>
              <span style={{ color: "#9ca3af" }}>›</span>
            </div>

            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{formatCurrency(tenant?.rent)}<span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>/month</span></div>

            <div style={{ fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              📅 Due on <strong style={{ color: "#1f2937" }}>1st</strong> of every month
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
              ⓘ Late fee: <strong style={{ color: "#1f2937" }}>$35.00 + $10.00/day</strong>
            </div>
          </div>
        </div>

        {/* Receiving bank */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Receiving bank accounts</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>For rent & fees</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>M&T Bank</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Checking Account - 4248</div>
          </div>
        </div>

        {/* Tenant ACH */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Tenant ACH payment fee</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Charged to</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>You</div>
          </div>
        </div>

        {/* End & archive */}
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>End & archive rent collection</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 12 }}>
            Any unpaid invoices will be canceled, and your tenant will be notified. Processing payments will proceed.
          </div>
          <button style={{ width: "100%", padding: "16px", background: "#dc2626", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            End & archive
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Invoice Modal
function EditInvoiceModal({ invoice, onClose, onSave }) {
  const [rent, setRent] = useState(String(invoice?.rent || ""));
  const [dueDate, setDueDate] = useState(invoice?.due_date || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const lateFee = Number(invoice?.late_fee || 0);
    await onSave(invoice, { rent: Number(rent), due_date: dueDate, total: Number(rent) + lateFee });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Edit invoice</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Rent amount</label>
          <input value={rent} onChange={e => setRent(e.target.value)} type="number"
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Due date</label>
          <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date"
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 15, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 10, background: "#1b3d2a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AdminPayments({ tenants, invoices: propInvoices = [], setInvoices: propSetInvoices }) {
  const [invoices, setInvoicesLocal] = useState(propInvoices);
  const setInvoices = (val) => { setInvoicesLocal(val); if (propSetInvoices) propSetInvoices(val); };

  const [activeMainTab, setActiveMainTab] = useState("active"); // active | expired | archived
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [sheet, setSheet] = useState(null); // "detail" | "invoices" | "invoice"
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  useEffect(() => { setInvoicesLocal(propInvoices); }, [propInvoices]);

  const now = new Date();
  const currentMonthName = getCurrentMonthName();

  // Summary stats
  const upcomingInvoices = invoices.filter(inv => !inv.paid && getInvoiceStatus(inv) === "upcoming");
  const overdueInvoices = invoices.filter(inv => !inv.paid && getInvoiceStatus(inv) === "overdue");
  const completedThisMonth = invoices.filter(inv => inv.paid && inv.month === currentMonthName);
  const upcomingTotal = upcomingInvoices.reduce((s, inv) => s + Number(inv.total || inv.rent || 0), 0);
  const overdueTotal = overdueInvoices.reduce((s, inv) => s + Number(inv.total || inv.rent || 0), 0);
  const completedTotal = completedThisMonth.reduce((s, inv) => s + Number(inv.total || inv.rent || 0), 0);

  const tenantInvoices = (tenantId) => invoices.filter(inv => inv.tenant_id === tenantId);

  const getPropertyStatus = (tenant) => {
    const tInvoices = tenantInvoices(tenant.id);
    if (tInvoices.some(inv => !inv.paid && getInvoiceStatus(inv) === "overdue")) return "overdue";
    return "current";
  };

  const getOverdueCount = (tenant) => tenantInvoices(tenant.id).filter(inv => !inv.paid && getInvoiceStatus(inv) === "overdue").length;

  const getCurrentMonthAmount = (tenant) => {
    const tInvoices = tenantInvoices(tenant.id);
    const currentInv = tInvoices.find(inv => inv.month === currentMonthName);
    return currentInv ? Number(currentInv.total || currentInv.rent || 0) : Number(tenant.rent || 0);
  };

  const handleMarkPaid = async (invoice) => {
    const paidDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await supabase.from("invoices").update({ paid: true, paid_date: paidDate, updated_at: now.toISOString() }).eq("id", invoice.id);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, paid: true, paid_date: paidDate } : inv));
    setSheet(null);
    setSelectedInvoice(null);
  };

  const handleDeleteInvoice = async (invoice) => {
    await supabase.from("invoices").update({ deleted: true }).eq("id", invoice.id);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, deleted: true } : inv));
    setSheet("invoices");
    setSelectedInvoice(null);
  };

  const handleEditSave = async (invoice, updates) => {
    await supabase.from("invoices").update({ ...updates, updated_at: now.toISOString() }).eq("id", invoice.id);
    setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, ...updates } : inv));
  };

  return (
    <div className="admin-page-content" style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", maxWidth: 600 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Rent Collection</h1>
        <button style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      </div>

      {/* 4 Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {/* Upcoming */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              📅 Upcoming
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>This month</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>{formatCurrency(upcomingTotal)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{upcomingInvoices.length} invoice{upcomingInvoices.length !== 1 ? "s" : ""} ›</div>
        </div>

        {/* Processing */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              ↻ Processing
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>All time</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px" }}>$0.00</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>0 invoices ›</div>
        </div>

        {/* Overdue */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              ⏱ Overdue
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>All time</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: overdueTotal > 0 ? "#dc2626" : "#1f2937" }}>{formatCurrency(overdueTotal)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? "s" : ""} ›</div>
        </div>

        {/* Completed */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              ✓ Completed
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>This month</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: "#16a34a" }}>{formatCurrency(completedTotal)}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{completedThisMonth.length} invoice{completedThisMonth.length !== 1 ? "s" : ""} ›</div>
        </div>
      </div>

      {/* Set up rent collection button */}
      <button style={{ width: "100%", padding: "16px", background: "#0f1a14", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 20, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        + Set up rent collection
      </button>

      {/* Active / Expired / Archived tabs */}
      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
        {["active", "expired", "archived"].map(t => (
          <button key={t} onClick={() => setActiveMainTab(t)} style={{
            flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
            background: activeMainTab === t ? "#fff" : "transparent",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            color: activeMainTab === t ? "#1f2937" : "#6b7280",
            boxShadow: activeMainTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            textTransform: "capitalize",
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Property list */}
      <div>
        {tenants.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No properties yet</div>
        )}
        {tenants.map((tenant, i) => {
          const status = getPropertyStatus(tenant);
          const overdueCount = getOverdueCount(tenant);
          const amount = getCurrentMonthAmount(tenant);

          return (
            <div key={tenant.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "16px 0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                  {/* Building icon */}
                  <div style={{ fontSize: 20, marginTop: 2 }}>🏢</div>
                  <div style={{ flex: 1 }}>
                    {/* Address — clickable for collection details */}
                    <button onClick={() => { setSelectedTenant(tenant); setSheet("detail"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "'DM Sans', sans-serif" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{tenant.address}</div>
                    </button>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant.name}</div>
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{formatCurrency(amount)}</div>
                  {overdueCount > 0 ? (
                    <button onClick={() => { setSelectedTenant(tenant); setSheet("invoices"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
                      <span style={{ fontSize: 12, color: "#dc2626", border: "1.5px solid #dc2626", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        ⏱ {overdueCount}
                      </span>
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      ✓ Current
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SHEETS ── */}

      {/* Rent Collection Detail */}
      {sheet === "detail" && selectedTenant && (
        <RentCollectionDetailSheet
          tenant={selectedTenant}
          invoices={tenantInvoices(selectedTenant.id)}
          onClose={() => { setSheet(null); setSelectedTenant(null); }}
          onViewInvoices={() => setSheet("invoices")}
        />
      )}

      {/* Invoice List */}
      {sheet === "invoices" && selectedTenant && (
        <InvoiceListSheet
          tenant={selectedTenant}
          invoices={tenantInvoices(selectedTenant.id)}
          onClose={() => setSheet(null)}
          onSelectInvoice={(inv) => { setSelectedInvoice(inv); setSheet("invoice"); }}
          onAddInvoice={() => {}} // future
        />
      )}

      {/* Invoice Detail */}
      {sheet === "invoice" && selectedInvoice && selectedTenant && (
        <InvoiceDetailSheet
          invoice={selectedInvoice}
          tenant={selectedTenant}
          onClose={() => { setSheet("invoices"); setSelectedInvoice(null); }}
          onMarkPaid={handleMarkPaid}
          onEdit={(inv) => setEditingInvoice(inv)}
          onDelete={handleDeleteInvoice}
        />
      )}

      {/* Edit Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
