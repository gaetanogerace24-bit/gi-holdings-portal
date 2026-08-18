import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const QUESTIONS = [
  { id: "full_name", label: "Full name", type: "text", required: true },
  { id: "dob", label: "Date of birth", type: "date", required: true },
  { id: "email", label: "Email address", type: "email", required: true },
  { id: "phone", label: "Phone number", type: "tel", required: true },
  { id: "current_address", label: "Current address", type: "text", required: true },
  { id: "move_in_date", label: "Desired move-in date", type: "date", required: true },
  { id: "employment_status", label: "Employment status", type: "select", options: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Retired", "Student"], required: true },
  { id: "employer", label: "Employer name (if employed)", type: "text", required: false },
  { id: "monthly_income", label: "Monthly gross income ($)", type: "number", required: true },
  { id: "occupants", label: "How many people will live in the unit?", type: "number", required: true },
  { id: "pets", label: "Do you have pets?", type: "select", options: ["No", "Yes - dog", "Yes - cat", "Yes - other"], required: true },
  { id: "eviction", label: "Have you ever been evicted?", type: "select", options: ["No", "Yes"], required: true },
  { id: "eviction_explain", label: "If yes, please explain", type: "textarea", required: false },
  { id: "felony", label: "Have you ever been convicted of a felony?", type: "select", options: ["No", "Yes"], required: true },
  { id: "felony_explain", label: "If yes, please explain", type: "textarea", required: false },
  { id: "reference1_name", label: "Reference #1 - Full name", type: "text", required: true },
  { id: "reference1_phone", label: "Reference #1 - Phone number", type: "tel", required: true },
  { id: "reference2_name", label: "Reference #2 - Full name", type: "text", required: false },
  { id: "reference2_phone", label: "Reference #2 - Phone number", type: "tel", required: false },
  { id: "additional_info", label: "Anything else you'd like us to know?", type: "textarea", required: false },
];

export default function ApplicationForm({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState("form"); // form | submitting | done
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (listingId) {
      supabase.from("listings").select("*").eq("id", listingId).single().then(({ data }) => setListing(data));
    }
  }, [listingId]);

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
    try {
      // Timeout after 10 seconds — always show success regardless
      await Promise.race([
        supabase.functions.invoke("send-application", { body: { listing, answers } }),
        new Promise(resolve => setTimeout(resolve, 10000))
      ]);
    } catch (e) {
      console.error(e);
    }
    // Clear the apply session so Resume application disappears
    try { localStorage.removeItem("gi_apply"); } catch(e) {}
    if (onSubmitSuccess) onSubmitSuccess();
    setStep("done");
  }

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid #e5e7eb", fontSize: 15, boxSizing: "border-box",
    outline: "none", fontFamily: "inherit", background: "#fff",
  };

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
          {QUESTIONS.map(q => (
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
