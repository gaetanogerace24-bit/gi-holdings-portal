import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// TEST MODE — set to false when ready to go live
// ============================================================
const TEST_MODE = true;
const TEST_EMAIL = "giholdingsllc8@gmail.com";
// ============================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "rent@giholdingsllc.com";
const PORTAL_URL = "https://giholdingsllc.com";

function calcLateFeeFromDueDate(dueDateStr: string): number {
  const now = new Date();
  const due = new Date(dueDateStr);
  const feeStart = new Date(due.getFullYear(), due.getMonth(), 5);
  if (now < feeStart) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLate = Math.floor((now - feeStart.getTime()) / msPerDay) + 1;
  return 35 + Math.max(0, daysLate - 1) * 10;
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const results = [];

    // Step 1: Update late fees on all unpaid invoices
    const { data: unpaidInvoices } = await supabase
      .from("invoices")
      .select("*, tenants(*)")
      .eq("paid", false);

    for (const inv of (unpaidInvoices || [])) {
      const dueDate = inv.due_date || `${inv.year}-${String(inv.month_num).padStart(2,'0')}-01`;
      const lateFee = calcLateFeeFromDueDate(dueDate);
      const rent = Number(inv.rent) || 0;
      const total = rent + lateFee;

      if (lateFee !== Number(inv.late_fee)) {
        await supabase.from("invoices").update({
          late_fee: lateFee,
          total,
          updated_at: now.toISOString(),
        }).eq("id", inv.id);
      }

      // Step 2: Send email if late (day 5+)
      const due = new Date(dueDate);
      const feeStart = new Date(due.getFullYear(), due.getMonth(), 5);
      if (now < feeStart) continue; // still in grace period
      if (!inv.tenants?.email) continue;

      const tenant = inv.tenants;
      const firstName = tenant.name.split(" ")[0];
      const daysLate = Math.floor((now.getTime() - feeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isDay1 = daysLate === 1;
      const toEmail = TEST_MODE ? TEST_EMAIL : tenant.email;

      const subject = isDay1
        ? `⚠️ Late fee applied — ${inv.month} rent`
        : `⚠️ Balance update: $${total.toLocaleString()} due — ${inv.month}`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:linear-gradient(160deg,#1b3d2a,#2d5c42);padding:28px 24px;border-radius:12px 12px 0 0;">
            <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">Tenant Portal</div>
          </div>
          <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.6;">
              Your <strong>${inv.month}</strong> rent at <strong>${tenant.address}</strong> is unpaid.
              ${isDay1 ? "A <strong>$35 late fee</strong> has been applied today." : `Your balance has increased with today's daily fee.`}
            </p>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;margin:20px 0;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Current Balance — Day ${daysLate} Late</div>
              <div style="font-size:32px;font-weight:800;color:#991b1b;">$${total.toLocaleString()}</div>
              <div style="margin-top:10px;font-size:13px;color:#6b7280;border-top:1px solid #fca5a5;padding-top:10px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span>Monthly rent</span><span style="font-weight:600;">$${rent.toLocaleString()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span>Base late fee (day 1)</span><span style="font-weight:600;color:#dc2626;">+$35</span>
                </div>
                ${daysLate > 1 ? `<div style="display:flex;justify-content:space-between;">
                  <span>Daily fees ($10 × ${daysLate - 1} days)</span><span style="font-weight:600;color:#dc2626;">+$${(daysLate - 1) * 10}</span>
                </div>` : ""}
              </div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;">
              ⏰ <strong>$10/day</strong> is added every day until paid in full.
            </div>
            <a href="${PORTAL_URL}" style="display:block;background:#4caf7d;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px;">
              Log in to pay now → giholdingsllc.com
            </a>
          </div>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: toEmail,
          subject: TEST_MODE ? `[TEST - ${tenant.name}] ${subject}` : subject,
          html,
        }),
      });

      const resData = await res.json();
      results.push({ tenant: tenant.name, invoice: inv.month, lateFee, total, emailStatus: res.status, emailData: resData });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
