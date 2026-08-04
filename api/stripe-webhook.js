import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_PHONE = process.env.TELNYX_PHONE_NUMBER || "+13309181957";
const OWNER_EMAIL = "giholdingsllc8@gmail.com";
const OWNER_PHONE = "+13309696464";
const PORTAL_URL = "https://giholdingsllc.com";
const FROM_EMAIL = "rent@giholdingsllc.com";

async function sendSMS(to, message) {
  return fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
    body: JSON.stringify({ from: TELNYX_PHONE, to, text: message }),
  });
}

async function sendEmail(to, subject, html) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

function emailWrapper(title, color, body) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:${color};padding:24px;border-radius:12px 12px 0 0;">
        <div style="font-size:18px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);">${title}</div>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        ${body}
        <a href="${PORTAL_URL}" style="display:block;background:#1b3d2a;color:#fff;text-align:center;padding:13px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-top:20px;">
          Go to portal → giholdingsllc.com
        </a>
      </div>
    </div>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const pi = event.data.object;
  const { tenantId, tenantName, address, month, invoiceId } = pi.metadata || {};
  const amount = `$${(pi.amount / 100).toFixed(2)}`;
  const firstName = tenantName?.split(" ")[0] || "there";

  // Look up tenant for phone/email
  let tenant = null;
  if (tenantId) {
    const { data } = await supabase.from("tenants").select("email, phone, contact_email").eq("id", tenantId).single();
    tenant = data;
  }
  const tenantEmail = tenant?.email || tenant?.contact_email;
  const tenantPhone = tenant?.phone;
  const monthLabel = month || "your invoice";

  // ─────────────────────────────────────────────────────────
  // PAYMENT SUCCEEDED
  // ─────────────────────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    console.log(`✅ Payment confirmed for ${tenantName}`);

    // Mark invoice paid in DB
    if (invoiceId) {
      await supabase.from("invoices").update({
        paid: true, payment_status: "completed", paid_date: new Date().toISOString(),
      }).eq("id", invoiceId);
    }

    // Notify owner
    await sendSMS(OWNER_PHONE, `G&I Holdings: ✅ ${tenantName} payment of ${amount} for ${monthLabel} confirmed.`);

    // Notify tenant
    if (tenantPhone) {
      await sendSMS(tenantPhone, `G&I Holdings: Hi ${firstName}, your payment of ${amount} for ${monthLabel} went through ✅ Thank you! Log in to view your receipt: ${PORTAL_URL}`);
    }
    if (tenantEmail) {
      await sendEmail(tenantEmail, `✅ Payment confirmed — ${monthLabel}`, emailWrapper(
        "Payment confirmed", "#166534",
        `<p style="font-size:15px;color:#1a1a1a;">Hi ${firstName},</p>
        <p style="font-size:14px;color:#4b5563;">Your payment of <strong>${amount}</strong> for <strong>${monthLabel}</strong> at ${address} went through successfully ✅</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;font-size:13px;color:#166534;">
          <div>Amount: <strong>${amount}</strong></div>
          <div>Property: ${address}</div>
          <div>Date: ${new Date().toLocaleDateString()}</div>
        </div>`
      ));
    }
  }

  // ─────────────────────────────────────────────────────────
  // PAYMENT FAILED (card declined)
  // ─────────────────────────────────────────────────────────
  if (event.type === "payment_intent.payment_failed") {
    const failReason = pi.last_payment_error?.message || "Card declined";
    console.log(`❌ Payment failed for ${tenantName}: ${failReason}`);

    // Reset invoice back to unpaid so they can retry
    if (invoiceId) {
      await supabase.from("invoices").update({
        payment_status: null,
      }).eq("id", invoiceId);
    }

    // Notify owner
    await sendSMS(OWNER_PHONE, `G&I Holdings: ❌ ${tenantName} payment of ${amount} for ${monthLabel} FAILED. Invoice reset, they can retry.`);

    // Notify tenant
    if (tenantPhone) {
      await sendSMS(tenantPhone, `G&I Holdings: Hi ${firstName}, your payment of ${amount} for ${monthLabel} was declined ❌ Please log in to try again: ${PORTAL_URL}`);
    }
    if (tenantEmail) {
      await sendEmail(tenantEmail, `❌ Payment failed — ${monthLabel}`, emailWrapper(
        "Payment failed", "#dc2626",
        `<p style="font-size:15px;color:#1a1a1a;">Hi ${firstName},</p>
        <p style="font-size:14px;color:#4b5563;">Your payment of <strong>${amount}</strong> for <strong>${monthLabel}</strong> at ${address} was declined ❌</p>
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px;font-size:13px;color:#991b1b;">
          <strong>Reason:</strong> ${failReason}<br/>Please log in and try a different card or payment method.
        </div>`
      ));
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACH PROCESSING
  // ─────────────────────────────────────────────────────────
  if (event.type === "payment_intent.processing") {
    console.log(`⏳ ACH processing for ${tenantName}`);

    // Notify tenant
    if (tenantPhone) {
      await sendSMS(tenantPhone, `G&I Holdings: Hi ${firstName}, your bank transfer of ${amount} for ${monthLabel} is processing ⏳ It takes 3–5 business days to clear. We'll notify you when confirmed.`);
    }
    if (tenantEmail) {
      await sendEmail(tenantEmail, `⏳ Bank transfer processing — ${monthLabel}`, emailWrapper(
        "Transfer in progress", "#b45309",
        `<p style="font-size:15px;color:#1a1a1a;">Hi ${firstName},</p>
        <p style="font-size:14px;color:#4b5563;">Your bank transfer of <strong>${amount}</strong> for <strong>${monthLabel}</strong> is being processed ⏳</p>
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px;font-size:13px;color:#92400e;">
          ACH bank transfers take 3–5 business days to clear. You'll receive a confirmation once the payment is confirmed.
        </div>`
      ));
    }
  }

  // ─────────────────────────────────────────────────────────
  // ACH RETURNED / FAILED
  // ─────────────────────────────────────────────────────────
  if (event.type === "payment_intent.canceled" || event.type === "charge.failed") {
    const isACH = pi.payment_method_types?.includes("us_bank_account");
    if (isACH) {
      console.log(`⚠️ ACH returned for ${tenantName}`);

      if (invoiceId) {
        await supabase.from("invoices").update({ payment_status: null }).eq("id", invoiceId);
      }

      await sendSMS(OWNER_PHONE, `G&I Holdings: ⚠️ ${tenantName} bank transfer of ${amount} for ${monthLabel} was RETURNED. Invoice reset.`);

      if (tenantPhone) {
        await sendSMS(tenantPhone, `G&I Holdings: Hi ${firstName}, your bank transfer of ${amount} for ${monthLabel} was returned by your bank ⚠️ Please log in to retry: ${PORTAL_URL}`);
      }
      if (tenantEmail) {
        await sendEmail(tenantEmail, `⚠️ Bank transfer returned — ${monthLabel}`, emailWrapper(
          "Transfer returned", "#b45309",
          `<p style="font-size:15px;color:#1a1a1a;">Hi ${firstName},</p>
          <p style="font-size:14px;color:#4b5563;">Your bank transfer of <strong>${amount}</strong> for <strong>${monthLabel}</strong> was returned by your bank ⚠️</p>
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px;font-size:13px;color:#92400e;">
            Please check your account balance or contact your bank, then log in to retry your payment.
          </div>`
        ));
      }
    }
  }

  res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: false } };
