import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// TEST MODE — set to false when ready to go live
// ============================================================
const TEST_MODE = false;
const TEST_EMAIL = "giholdingsllc8@gmail.com";
const TEST_PHONE = "+14437526644";
// ============================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY")!;
const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER") || "+13309181957";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "rent@giholdingsllc.com";
const PORTAL_URL = "https://giholdingsllc.com";

// Always use EST via Intl API — never getTimezoneOffset()
function todayEST(): Date {
  const now = new Date();
  const estDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [y, m, d] = estDateStr.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

function calcLateFee(dueDateStr: string, rules: {
  late_fee_start_day?: number | null;
  initial_late_fee?: number | null;
  daily_late_fee?: number | null;
}): number {
  if (!dueDateStr) return 0;

  const startDay = Number(rules.late_fee_start_day) || 5;
  const initialFee = Number(rules.initial_late_fee) ?? 35;
  const dailyFee = Number(rules.daily_late_fee) ?? 10;

  const [year, month, day] = dueDateStr.split("T")[0].split("-");
  const due = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const feeStart = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), startDay));
  const today = todayEST();

  if (today < feeStart) return 0;

  const days = Math.round((today.getTime() - feeStart.getTime()) / 86400000);
  return initialFee + days * dailyFee;
}

async function sendSMS(to: string, message: string) {
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
    },
    body: JSON.stringify({ from: TELNYX_PHONE_NUMBER, to, text: message }),
  });
  return await res.json();
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = todayEST();
    const results: any[] = [];

    // ─────────────────────────────────────────────────────────
    // 1. REGULAR INVOICES
    //    Skip: paid, deleted, processing, AND is_custom = true (prorated)
    // ─────────────────────────────────────────────────────────
    const { data: unpaidInvoices } = await supabase
      .from("invoices")
      .select("*, tenants(*)")
      .eq("paid", false)
      .neq("deleted", true)
      .or("payment_status.is.null,and(payment_status.neq.processing,payment_status.neq.completed)")
      // CRITICAL: skip prorated invoices — neq alone drops NULLs in Postgres
      .or("is_custom.is.null,is_custom.eq.false");

    for (const inv of (unpaidInvoices || [])) {
      const tenant = inv.tenants;
      if (!tenant) continue;

      // Skip tenants with NULL late fee settings (e.g. Jannelle Underwood)
      if (
        tenant.late_fee_start_day == null &&
        tenant.initial_late_fee == null &&
        tenant.daily_late_fee == null
      ) continue;

      const dueDate = inv.due_date || `${inv.year}-${String(inv.month_num).padStart(2, "0")}-01`;
      const [year, month] = dueDate.split("T")[0].split("-");
      const startDay = Number(tenant.late_fee_start_day) || 5;
      const feeStart = new Date(Date.UTC(Number(year), Number(month) - 1, startDay));

      // Not yet in late fee window
      if (today < feeStart) continue;

      const rules = {
        late_fee_start_day: tenant.late_fee_start_day,
        initial_late_fee: tenant.initial_late_fee,
        daily_late_fee: tenant.daily_late_fee,
      };

      const lateFee = calcLateFee(dueDate, rules);
      const rent = Number(inv.rent) || 0;
      const total = rent + lateFee;

      // Update DB if late fee changed
      if (lateFee !== Number(inv.late_fee)) {
        await supabase.from("invoices").update({
          late_fee: lateFee,
          total,
          updated_at: new Date().toISOString(),
        }).eq("id", inv.id);
      }

      if (!tenant.email) continue;

      // Double-check it hasn't been paid since we fetched
      const { data: freshInv } = await supabase
        .from("invoices").select("paid").eq("id", inv.id).single();
      if (freshInv?.paid) continue;

      const firstName = tenant.name.split(" ")[0];
      const days = Math.round((today.getTime() - feeStart.getTime()) / 86400000);
      const isDay1 = days === 0;
      const toEmail = TEST_MODE ? TEST_EMAIL : tenant.email;
      const toPhone = TEST_MODE ? TEST_PHONE : tenant.phone;

      const subject = isDay1
        ? `⚠️ Late fee applied — ${inv.month} rent`
        : `⚠️ Rent overdue — ${inv.month} ($${total.toFixed(2)} total)`;

      const initialFee = Number(tenant.initial_late_fee) ?? 35;
      const dailyFee = Number(tenant.daily_late_fee) ?? 10;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:#c0392b;padding:28px 24px;border-radius:12px 12px 0 0;">
            <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Rent Overdue</div>
          </div>
          <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.6;">
              Your rent for <strong>${inv.month}</strong> at ${tenant.address} is overdue.
            </p>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px 20px;margin:20px 0;">
              <div style="font-weight:700;color:#991b1b;margin-bottom:8px;">Amount breakdown</div>
              <div style="font-size:13px;color:#4b5563;">
                <div>Rent: <strong>$${rent.toFixed(2)}</strong></div>
                <div style="color:#dc2626;">Late fees (${days + 1} days): <strong>$${lateFee.toFixed(2)}</strong></div>
                <hr style="border:none;border-top:1px solid #fca5a5;margin:8px 0;"/>
              </div>
              <div style="font-size:18px;font-weight:800;color:#dc2626;">Total due: $${total.toFixed(2)}</div>
            </div>
            <p style="font-size:13px;color:#6b7280;">Late fees of $${dailyFee}/day continue to accrue. Log in to pay now.</p>
            <a href="${PORTAL_URL}" style="display:block;background:#c0392b;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-top:16px;">
              Pay now → giholdingsllc.com
            </a>
          </div>
        </div>
      `;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: toEmail,
          subject: TEST_MODE ? `[TEST - ${tenant.name}] ${subject}` : subject,
          html,
        }),
      });

      let smsData = null;
      if (toPhone) {
        const smsMsg = `G&I Holdings: Hi ${firstName}, your ${inv.month} rent is overdue. Total now due: $${total.toFixed(2)} (includes $${lateFee.toFixed(2)} in late fees). Log in: ${PORTAL_URL}`;
        smsData = await sendSMS(toPhone, smsMsg);
      }

      results.push({ type: "invoice", tenant: tenant.name, month: inv.month, lateFee, total });
    }

    // ─────────────────────────────────────────────────────────
    // 2. CUSTOM INVOICES (non-recurring charges to tenants)
    // ─────────────────────────────────────────────────────────
    const { data: customInvoices } = await supabase
      .from("custom_invoices")
      .select("*, tenants(*)")
      .eq("paid", false)
      .eq("late_fee_enabled", true)
      .or("payment_status.is.null,and(payment_status.neq.processing,payment_status.neq.completed)");

    for (const inv of (customInvoices || [])) {
      if (!inv.due_date) continue;

      const rules = {
        late_fee_start_day: inv.late_fee_start_day,
        initial_late_fee: inv.initial_late_fee,
        daily_late_fee: inv.daily_late_fee,
      };

      const lateFee = calcLateFee(inv.due_date, rules);
      const amount = Number(inv.amount) || 0;
      const total = amount + lateFee;

      if (lateFee !== Number(inv.late_fee)) {
        await supabase.from("custom_invoices").update({
          late_fee: lateFee,
          total,
        }).eq("id", inv.id);
      }

      results.push({ type: "custom_invoice", id: inv.id, lateFee, total });
    }

    // ─────────────────────────────────────────────────────────
    // 3. CONTRACTOR PAYMENTS with late fees
    // ─────────────────────────────────────────────────────────
    const { data: contractors } = await supabase
      .from("contractor_payments")
      .select("*")
      .eq("late_fee_enabled", true)
      .or("status.is.null,status.eq.pending");

    for (const c of (contractors || [])) {
      if (!c.due_date && !c.date) continue;

      const dueDateStr = c.due_date || c.date;
      const rules = {
        late_fee_start_day: c.late_fee_start_day,
        initial_late_fee: c.initial_late_fee,
        daily_late_fee: c.daily_late_fee,
      };

      const lateFee = calcLateFee(dueDateStr, rules);
      const amount = Number(c.amount) || 0;
      const total = amount + lateFee;

      if (lateFee !== Number(c.late_fee)) {
        await supabase.from("contractor_payments").update({
          late_fee: lateFee,
          total,
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
      }

      results.push({ type: "contractor", id: c.id, lateFee, total });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200 }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
