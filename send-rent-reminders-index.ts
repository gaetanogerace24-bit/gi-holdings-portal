import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEST_MODE = false;
const TEST_EMAIL = "giholdingsllc8@gmail.com";
const TEST_PHONE = "+14437526644";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY")!;
const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER") || "+13309181957";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "rent@giholdingsllc.com";
const PORTAL_URL = "https://giholdingsllc.com";

function todayEST(): Date {
  const now = new Date();
  const estDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [y, m, d] = estDateStr.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
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

    // 1. Load reminder days setting
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "portal_settings")
      .maybeSingle();

    const reminderDaysBefore = Number(settingsRow?.value?.reminderDaysBefore) || 3;

    // 2. Figure out what date is X days from now
    const reminderTarget = new Date(today);
    reminderTarget.setUTCDate(reminderTarget.getUTCDate() + reminderDaysBefore);
    const targetMonth = reminderTarget.getUTCMonth() + 1;
    const targetYear = reminderTarget.getUTCFullYear();

    // Rent is always due on the 1st — so we trigger when today + X days = the 1st
    if (reminderTarget.getUTCDate() !== 1) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `Today + ${reminderDaysBefore} days is not the 1st`, date: reminderTarget.toISOString().split("T")[0] }),
        { status: 200 }
      );
    }

    // 3. Get all active tenants with unpaid invoices for that month
    const monthName = reminderTarget.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, tenants(*)")
      .eq("paid", false)
      .or("is_custom.is.null,is_custom.eq.false")
      .is("payment_status", null);

    const targetMonthInvoices = (invoices || []).filter(inv => {
      const dueDate = inv.due_date || `${inv.year}-${String(inv.month_num).padStart(2, "0")}-01`;
      const [y, m] = dueDate.split("T")[0].split("-");
      return Number(y) === targetYear && Number(m) === targetMonth;
    });

    for (const inv of targetMonthInvoices) {
      const tenant = inv.tenants;
      if (!tenant) continue;

      const firstName = tenant.name.split(" ")[0];
      const rent = Number(inv.rent) || 0;
      const toEmail = TEST_MODE ? TEST_EMAIL : tenant.email;
      const toPhone = TEST_MODE ? TEST_PHONE : tenant.phone;
      const dueDate = reminderTarget.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

      if (toEmail) {
        const subject = `🔔 Rent reminder — ${monthName} rent due in ${reminderDaysBefore} days`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
            <div style="background:#1b3d2a;padding:28px 24px;border-radius:12px 12px 0 0;">
              <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Rent Reminder</div>
            </div>
            <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <p style="font-size:16px;color:#1a1a1a;">Hi ${firstName},</p>
              <p style="font-size:14px;color:#4b5563;line-height:1.6;">
                This is a friendly reminder that your rent for <strong>${monthName}</strong> at ${tenant.address} is due in <strong>${reminderDaysBefore} days</strong> on <strong>${dueDate}</strong>.
              </p>
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin:20px 0;">
                <div style="font-weight:700;color:#166534;margin-bottom:8px;">Payment summary</div>
                <div style="font-size:18px;font-weight:800;color:#166534;">$${rent.toFixed(2)} due ${dueDate}</div>
              </div>
              <p style="font-size:13px;color:#6b7280;">Please make sure to pay on time to avoid late fees. Log in to pay now.</p>
              <a href="${PORTAL_URL}" style="display:block;background:#1b3d2a;color:#fff;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-top:16px;">Pay now → giholdingsllc.com</a>
            </div>
          </div>
        `;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: toEmail,
            subject: TEST_MODE ? `[TEST - ${tenant.name}] ${subject}` : subject,
            html,
          }),
        });
      }

      if (toPhone) {
        const smsMsg = `G&I Holdings: Hi ${firstName}, your ${monthName} rent of $${rent.toFixed(2)} is due in ${reminderDaysBefore} days on ${dueDate}. Log in to pay: ${PORTAL_URL} 🏠`;
        await sendSMS(toPhone, smsMsg);
      }

      results.push({ tenant: tenant.name, rent, dueDate });
    }

    return new Response(
      JSON.stringify({ success: true, reminderDaysBefore, targetDate: reminderTarget.toISOString().split("T")[0], sent: results.length, results }),
      { status: 200 }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
