import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY")!;
const TELNYX_PHONE = Deno.env.get("TELNYX_PHONE_NUMBER") || "+13309181957";
const OWNER_PHONE = "+13309696464";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { listingId, amount, name, email, phone, listingAddress } = await req.json();

    const amountWithFee = Math.round((amount + 30) / (1 - 0.029));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountWithFee,
      currency: "usd",
      metadata: { listingId, name, email, phone, type: "application_fee" },
      description: "Rental application fee",
    });

    // Notify owner that applicant paid
    const address = listingAddress || "Unknown property";

    // Owner SMS
    await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
      body: JSON.stringify({
        from: TELNYX_PHONE,
        to: OWNER_PHONE,
        text: `G&I Holdings: ✅ New applicant — ${name} paid the application fee for ${address}.`,
      }),
    });

    // Owner email
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const ownerHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1b3d2a;padding:24px;border-radius:12px 12px 0 0;">
          <div style="font-size:18px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;">Application Fee Received</div>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:15px;color:#1a1a1a;font-weight:600;margin:0 0 16px">✅ New applicant paid the application fee</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;font-size:13px;color:#166534;">
            <div><strong>Name:</strong> ${name}</div>
            <div style="margin-top:6px"><strong>Email:</strong> ${email}</div>
            <div style="margin-top:6px"><strong>Phone:</strong> ${phone}</div>
            <div style="margin-top:6px"><strong>Property:</strong> ${address}</div>
          </div>
          <p style="font-size:13px;color:#6b7280;margin-top:16px;">They will now complete the rental application form. You'll receive another email once they submit.</p>
        </div>
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "rent@giholdingsllc.com",
        to: "giholdingsllc8@gmail.com",
        subject: `✅ New applicant — ${name} paid fee for ${address}`,
        html: ownerHtml,
      }),
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret, amountWithFee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
