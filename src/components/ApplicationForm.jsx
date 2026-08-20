import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const QUESTIONS = [
  // PERSONAL INFO
  { id: "full_name", label: "Full name", type: "text", required: true },
  { id: "dob", label: "Date of birth", type: "date", required: true },
  { id: "email", label: "Email address", type: "email", required: true },
  { id: "phone", label: "Phone number", type: "tel", required: true },
  { id: "current_address", label: "Current address", type: "text", required: true },
  { id: "time_at_address", label: "How long at current address?", type: "text", required: true },
  { id: "current_rent", label: "Current monthly rent/mortgage payment ($)", type: "number", required: true },
  { id: "current_landlord_name", label: "Current landlord name", type: "text", required: true },
  { id: "current_landlord_phone", label: "Current landlord phone", type: "tel", required: true },
  { id: "reason_leaving", label: "Reason for leaving current place", type: "textarea", required: true },

  // SECTION 8 / HOUSING VOUCHER
  { id: "section8", label: "Do you have a Section 8 / Housing Choice Voucher?", type: "select", options: ["No", "Yes"], required: true },
  { id: "section8_bedrooms", label: "How many bedrooms is your voucher for?", type: "select", options: ["1", "2", "3", "4", "5+"], required: false },
  { id: "section8_authority", label: "Which housing authority issued your voucher?", type: "text", required: false },
  { id: "section8_active", label: "Is your voucher currently active?", type: "select", options: ["Yes", "No"], required: false },

  // MOVE-IN
  { id: "move_in_date", label: "Desired move-in date", type: "date", required: true },
  { id: "move_in_flexible", label: "Are you flexible on your move-in date?", type: "select", options: ["Yes", "No"], required: true },
  { id: "move_in_earliest", label: "What is your earliest possible move-in date?", type: "date", required: true },
  { id: "move_in_latest", label: "What is your latest acceptable move-in date?", type: "date", required: false },
  { id: "lease_length", label: "How long are you looking to stay?", type: "select", options: ["Month-to-month", "6 months", "1 year", "2+ years"], required: true },

  // EMPLOYMENT & INCOME
  { id: "employment_status", label: "Employment status", type: "select", options: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Retired", "Student"], required: true },
  { id: "employer", label: "Employer name (if employed)", type: "text", required: false },
  { id: "monthly_income", label: "Monthly gross income ($)", type: "number", required: true },
  { id: "credit_score", label: "Credit score range", type: "select", options: ["Below 500", "500–599", "600–649", "650–699", "700+"], required: true },
  { id: "bankruptcy", label: "Do you have a bankruptcy in the past 7 years?", type: "select", options: ["No", "Yes"], required: true },

  // OCCUPANTS
  { id: "occupants", label: "How many people will live in the unit?", type: "number", required: true },
  { id: "occupant_names", label: "List the names and ages of all occupants", type: "textarea", required: true },

  // LIFESTYLE
  { id: "pets", label: "Do you have pets?", type: "select", options: ["No", "Yes - dog", "Yes - cat", "Yes - other"], required: true },
  { id: "smoke", label: "Do you smoke?", type: "select", options: ["No", "Yes"], required: true },
  { id: "num_vehicles", label: "Approximately how many vehicles do you have?", type: "select", options: ["0", "1", "2", "3", "4+"], required: true },
  { id: "home_business", label: "Will you be running any home-based business from the unit?", type: "select", options: ["No", "Yes"], required: true },

  // BACKGROUND
  { id: "eviction", label: "Have you ever been evicted?", type: "select", options: ["No", "Yes"], required: true },
  { id: "eviction_explain", label: "If yes, please explain", type: "textarea", required: false },
  { id: "broken_lease", label: "Have you ever broken a lease early?", type: "select", options: ["No", "Yes"], required: true },
  { id: "broken_lease_explain", label: "If yes, please explain", type: "textarea", required: false },
  { id: "felony", label: "Have you ever been convicted of a felony?", type: "select", options: ["No", "Yes"], required: true },
  { id: "felony_explain", label: "If yes, please explain", type: "textarea", required: false },

  // ID
  { id: "gov_id_type", label: "What type of government ID do you have?", type: "select", options: ["Driver's License", "State ID", "Passport", "Other"], required: true },

  // REFERENCES
  { id: "reference1_name", label: "Reference #1 - Full name", type: "text", required: true },
  { id: "reference1_phone", label: "Reference #1 - Phone number", type: "tel", required: true },
  { id: "reference2_name", label: "Reference #2 - Full name", type: "text", required: false },
  { id: "reference2_phone", label: "Reference #2 - Phone number", type: "tel", required: false },

  // ADDITIONAL
  { id: "additional_info", label: "Anything else you'd like us to know?", type: "textarea", required: false },
];

export default function ApplicationForm({ listing: listingProp, onBack, onSubmitSuccess }) {
  const [listing, setListing] = useState(listingProp || null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState("form"); // form | submitting | done
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (listingProp) { setListing(listingProp); return; }
  }, [listingProp]);

  function update(id, val) {
    setAnswers(a => ({ ...a, [id]: val }));
    setErrors(e => ({ ...e, [id]: undefined }));
  }

  async function handleSubmit() {
    const newErrors = {};
    QUESTIONS.forEach(q => {
      if (q.required && !answers[q.id]?.trim?.() && !answers[q.id]) {
        newErrors[q.id] = "Required";
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.keys(newErrors)[0];
      document.getElementById(firstError)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setStep("submitting");
    try { supabase.functions.invoke("send-application", { body: { listing, answers } }); } catch(e) {}
    try {
      const existing = JSON.parse(localStorage.getItem("gi_apply") || "{}");
      localStorage.setItem("gi_apply_submitted_" + (existing.listingId || ""), "true");
      localStorage.removeItem("gi_apply");
    } catch(e) {}
    if (onSubmitSuccess) onSubmitSuccess();
    setStep("done");
  }

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid #e5e7eb", fontSize: 15, boxSizing: "border-box",
    outline: "none", fontFamily: "inherit", background: "#fff",
  };

  const sectionHeader = (title) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3d2a", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #e5e7eb", paddingBottom: 8, marginTop: 16 }}>
      {title}
    </div>
  );

  const sections = [
    { label: "Personal Info", ids: ["full_name","dob","email","phone","current_address","time_at_address","current_rent","current_landlord_name","current_landlord_phone","reason_leaving"] },
    { label: "Section 8 / Housing Voucher", ids: ["section8","section8_bedrooms","section8_authority","section8_active"] },
    { label: "Move-In", ids: ["move_in_date","move_in_flexible","move_in_earliest","move_in_latest","lease_length"] },
    { label: "Employment & Income", ids: ["employment_status","employer","monthly_income","credit_score","bankruptcy"] },
    { label: "Occupants", ids: ["occupants","occupant_names"] },
    { label: "Lifestyle", ids: ["pets","smoke","num_vehicles","license_plate","home_business"] },
    { label: "Background", ids: ["eviction","eviction_explain","broken_lease","broken_lease_explain","felony","felony_explain"] },
    { label: "Government ID", ids: ["gov_id_type"] },
    { label: "References", ids: ["reference1_name","reference1_phone","reference2_name","reference2_phone"] },
    { label: "Additional", ids: ["additional_info"] },
  ];

  if (step === "done") return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1b3d2a", margin: "0 0 12px" }}>Application submitted!</h2>
        <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, margin: "0 0 24px" }}>
          Thank you, {answers.full_name}! Your application for <strong>{listing?.address || "the property"}</strong> has been received. G&I Holdings will be in touch with you soon. A confirmation has been sent to your email and phone.
        </p>
        <button onClick={onBack} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          Back to home
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ background: "#1b3d2a", padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Rental Application</div>
          {listing && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{listing.address}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 20px 60px" }}>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
          Please complete all required fields. Your application will be sent directly to G&I Holdings LLC for review.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {sections.map(section => (
            <div key={section.label}>
              {sectionHeader(section.label)}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                {QUESTIONS.filter(q => section.ids.includes(q.id)).map(q => (
                  <div key={q.id} id={q.id}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                      {q.label} {q.required && <span style={{ color: "#dc2626" }}>*</span>}
                    </label>
                    {q.type === "select" ? (
                      <select style={{ ...inp, appearance: "auto" }} value={answers[q.id] || ""} onChange={e => update(q.id, e.target.value)}>
                        <option value="">Select...</option>
                        {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : q.type === "textarea" ? (
                      <textarea style={{ ...inp, minHeight: 90, resize: "vertical" }} value={answers[q.id] || ""} onChange={e => update(q.id, e.target.value)} />
                    ) : (
                      <input style={inp} type={q.type} value={answers[q.id] || ""} onChange={e => update(q.id, e.target.value)} />
                    )}
                    {errors[q.id] && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>This field is required</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={step === "submitting"}
          style={{ width: "100%", background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 32, opacity: step === "submitting" ? 0.7 : 1 }}
        >
          {step === "submitting" ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </div>
  );
}
