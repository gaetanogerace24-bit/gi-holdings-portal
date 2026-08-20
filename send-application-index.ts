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
  // Personal Info
  full_name: "Full Name",
  dob: "Date of Birth",
  email: "Email",
  phone: "Phone",
  current_address: "Current Address",
  time_at_address: "Time at Current Address",
  current_rent: "Current Monthly Rent/Mortgage",
  current_landlord_name: "Current Landlord Name",
  current_landlord_phone: "Current Landlord Phone",
  reason_leaving: "Reason for Leaving",
  // Section 8
  section8: "Section 8 / Housing Voucher?",
  section8_bedrooms: "Voucher Bedroom Size",
  section8_authority: "Housing Authority",
  section8_active: "Voucher Currently Active?",
  // Move-In
  move_in_date: "Desired Move-In Date",
  move_in_flexible: "Flexible on Move-In Date?",
  move_in_earliest: "Earliest Move-In Date",
  move_in_latest: "Latest Move-In Date",
  lease_length: "Desired Lease Length",
  // Employment & Income
  employment_status: "Employment Status",
  employer: "Employer",
  monthly_income: "Monthly Gross Income",
  credit_score: "Credit Score Range",
  bankruptcy: "Bankruptcy in Past 7 Years?",
  // Occupants
  occupants: "Number of Occupants",
  occupant_names: "Names & Ages of All Occupants",
  // Lifestyle
  pets: "Pets",
  smoke: "Smoker?",
  num_vehicles: "Number of Vehicles",
  home_business: "Home-Based Business?",
  // Background
  eviction: "Ever Evicted?",
  eviction_explain: "Eviction Explanation",
  broken_lease: "Ever Broken a Lease Early?",
  broken_lease_explain: "Broken Lease Explanation",
  felony: "Felony Conviction?",
  felony_explain: "Felony Explanation",
  // ID
  gov_id_type: "Government ID Type",
  // References
  reference1_name: "Reference #1 Name",
  reference1_phone: "Reference #1 Phone",
  reference2_name: "Reference #2 Name",
  reference2_phone: "Reference #2 Phone",
  // Additional
  additional_info: "Additional Info",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { listing, answers } = await req.json();
  const name = answers.full_name || "Applicant";
  const firstName = name.split(" ")[0];
  const address = listing?.address || "Unknown property";
  const applicantEmail = answers.email || null;
  const rawPhone = (answers.phone || "").replace(/\D/g, "");
  const applicantPhone = rawPhone.length === 10 ? `+1${rawPhone}` : rawPhone.length === 11 && rawPhone.startsWith("1") ? `+${rawPhone}` : null;

  // Save to Supabase
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

  // Owner email
  const ownerHtml = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#1b3d2a;padding:28px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">New Rental Application</div>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:16px;color:#1a1a1a;font-weight:600;margin:0 0 4px">${name} submitted an application</p>
        <p style="font-size:14px;color:#6b7280;margin:0 0 20px">Property: ${address}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      </div>
    </div>`;

  // Applicant confirmation email
  const applicantHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1b3d2a;padding:28px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:20px;font-weight:700;color:#fff;">G&I Holdings LLC</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">Application Received</div>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="font-size:16px;color:#1a1a1a;font-weight:600;margin:0 0 12px">Hi ${firstName},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 16px">
          ✅ Your rental application for <strong>${address}</strong> has been received. We'll review your application and be in touch with you soon.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;font-size:13px;color:#166534;margin-bottom:20px;">
          <div><strong>Property:</strong> ${address}</div>
          <div style="margin-top:6px"><strong>Applicant:</strong> ${name}</div>
          <div style="margin-top:6px"><strong>Status:</strong> Under review</div>
        </div>
        <p style="font-size:13px;color:#6b7280;">Questions? Call us at <a href="tel:+13309696464" style="color:#1b3d2a;">(330) 969-6464</a> or visit <a href="https://giholdingsllc.com" style="color:#1b3d2a;">giholdingsllc.com</a></p>
      </div>
    </div>`;

  // Send owner email + SMS
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: OWNER_EMAIL, subject: `📋 New applicant — ${name} — ${address}`, html: ownerHtml }),
  });
  await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
    body: JSON.stringify({ from: TELNYX_PHONE, to: OWNER_PHONE, text: `G&I Holdings: 📋 New applicant — ${name} submitted their application for ${address}. Check your email for details.` }),
  });

  // Send applicant confirmation email
  if (applicantEmail) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: applicantEmail, subject: `✅ Application received — ${address}`, html: applicantHtml }),
    });
  }

  // Send applicant confirmation SMS
  if (applicantPhone) {
    await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TELNYX_API_KEY}` },
      body: JSON.stringify({ from: TELNYX_PHONE, to: applicantPhone, text: `G&I Holdings: ✅ Hi ${firstName}, your application for ${address} has been received. We'll be in touch soon.` }),
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
