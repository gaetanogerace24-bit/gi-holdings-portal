import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY")!;
const TELNYX_PHONE = Deno.env.get("TELNYX_PHONE_NUMBER") || "+13309181957";
const OWNER_EMAIL = "giholdingsllc8@gmail.com";
const OWNER_PHONE = "+13309696464";
const FROM_EMAIL = "rent@giholdingsllc.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LABELS: Record<string, string> = {
  full_name: "Full Name", dob: "Date of Birth", email: "Email", phone: "Phone",
  current_address: "Current Address", move_in_date: "Desired Move-In Date",
  employment_status: "Employment Status", employer: "Employer",
  monthly_income: "Monthly Income", occupants: "Number of Occupants",
  pets: "Pets", eviction: "Ever Evicted?", eviction_explain: "Eviction Explanation",
  felony: "Felony Conviction?", felony_explain: "Felony Explanation",
  reference1_name: "Reference #1 Name", reference1_phone: "Reference #1 Phone",
  reference2_name: "Reference #2 Name", reference2_phone: "Reference #2 Phone",
  additional_info: "Additional Info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { listing, answers } = await req.json();
  const name = answers.full_name || "Applicant";
  const address = listing?.address || "Unknown property";

  // Save to Supabase applications table
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  await supa.from("applications").insert({
    name,
    property_address: address,
    listing_id: listing?.id || null,
    answers,
    reviewed: false,
    archived: false,
  });

  const rows = Object.entries(LABELS).map(([key, label]) => {
    const val = answers[key] || "—";
    return `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;width:40%">${label}</td><td style="padding:8px 12px;color:#1a1a1a;border:1px solid #e5e7eb">${val}</td></tr>`;
  }).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#1b3d2a;padding:28px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">New Rental Application</div>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:16px;color:#1a1a1a;font-weight:600;margin:0 0 4px">${name} submitted an application</p>
        <p style="font-size:14px;color:#6b7280;margin:0 0 20px">Property: ${address}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
        <p style="font-size:12px;color:#9ca3af;margin-top:20px">Application fee was paid via Stripe.</p>
      </div>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: OWNER_EMAIL, subject: `📋 New application: ${name} — ${address}`, html }),
  });

  await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
    body: JSON.stringify({ from: TELNYX_PHONE, to: OWNER_PHONE, text: `G&I Holdings: 📋 ${name} completed a rental application for ${address}. Check your email for the full details.` }),
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
