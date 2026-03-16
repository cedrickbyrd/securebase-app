import { useState } from "react";
import "./SignupForm.css";

const STEPS = ["Account", "Organization", "Configuration", "Verify"];

const REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function SignupForm({ onSuccess }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
    orgName: "", orgSize: "", industry: "",
    awsRegion: "us-east-1", mfaEnabled: true, guardrailsLevel: "standard",
    agreeToTerms: false,
  });

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validate = () => {
    if (step === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "First and last name are required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
      if (form.password.length < 12) return "Password must be at least 12 characters.";
      if (form.password !== form.confirmPassword) return "Passwords do not match.";
    }
    if (step === 1) {
      if (!form.orgName.trim()) return "Organization name is required.";
      if (!form.orgSize) return "Select your organization size.";
      if (!form.industry) return "Select your industry.";
    }
    if (step === 2) {
      if (!form.agreeToTerms) return "You must agree to the Terms of Service.";
    }
    return null;
  };

  const next = () => { const err = validate(); if (err) { setError(err); return; } setStep((s) => s + 1); };
  const back = () => { setError(""); setStep((s) => s - 1); };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName, lastName: form.lastName, email: form.email,
          password: form.password, orgName: form.orgName, orgSize: form.orgSize,
          industry: form.industry, awsRegion: form.awsRegion,
          mfaEnabled: form.mfaEnabled, guardrailsLevel: form.guardrailsLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed.");
      setJobId(data.jobId);
      setStep(3);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const resendVerification = async () => {
    setLoading(true);
    try {
      await fetch(`/api/signup/resend-verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
    } finally { setLoading(false); }
  };

  return (
    <div className="signup-shell">
      <div className="signup-brand">
        <div className="brand-mark"><span className="brand-icon">⬡</span><span className="brand-name">SecureBase</span></div>
        <div className="brand-copy">
          <h1>Sovereign infrastructure,<br />in minutes.</h1>
          <p>Your dedicated AWS landing zone — hardened, compliant, and yours from day one.</p>
        </div>
        <ul className="brand-features">
          {["Dedicated AWS Organization account","Automated IAM & network guardrails","HIPAA / SOC 2 / FedRAMP baselines","Real-time compliance monitoring"].map((f) => (
            <li key={f}><span className="check">✓</span>{f}</li>
          ))}
        </ul>
        <div className="brand-pilot">
          <span className="pilot-badge">Pilot Program</span>
          <span className="pilot-text">8 spots remaining — 30-day free trial</span>
        </div>
      </div>

      <div className="signup-form-panel">
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div key={s} className={`step-dot ${i < step ? "done" : i === step ? "active" : ""}`}>
              <span className="step-num">{i < step ? "✓" : i + 1}</span>
              <span className="step-label">{s}</span>
            </div>
          ))}
        </div>

        <div className="form-card">
          {step === 0 && (
            <div className="form-step">
              <h2>Create your account</h2>
              <p className="form-subtitle">You'll use these credentials to access the SecureBase portal.</p>
              <div className="field-row">
                <div className="field"><label>First name</label><input value={form.firstName} onChange={set("firstName")} placeholder="Cedrick" autoFocus /></div>
                <div className="field"><label>Last name</label><input value={form.lastName} onChange={set("lastName")} placeholder="Byrd" /></div>
              </div>
              <div className="field"><label>Work email</label><input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" /></div>
              <div className="field"><label>Password <span className="hint">(min. 12 characters)</span></label><input type="password" value={form.password} onChange={set("password")} placeholder="••••••••••••" /></div>
              <div className="field"><label>Confirm password</label><input type="password" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="••••••••••••" /></div>
            </div>
          )}

          {step === 1 && (
            <div className="form-step">
              <h2>Tell us about your org</h2>
              <p className="form-subtitle">This helps us configure the right compliance baseline.</p>
              <div className="field"><label>Organization name</label><input value={form.orgName} onChange={set("orgName")} placeholder="Acme Corp" autoFocus /></div>
              <div className="field-row">
                <div className="field"><label>Company size</label>
                  <select value={form.orgSize} onChange={set("orgSize")}>
                    <option value="">Select…</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="11-50">11–50 employees</option>
                    <option value="51-200">51–200 employees</option>
                    <option value="201-1000">201–1,000 employees</option>
                    <option value="1000+">1,000+ employees</option>
                  </select>
                </div>
                <div className="field"><label>Industry</label>
                  <select value={form.industry} onChange={set("industry")}>
                    <option value="">Select…</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="fintech">Fintech / Financial Services</option>
                    <option value="government">Government / Public Sector</option>
                    <option value="defense">Defense / Aerospace</option>
                    <option value="saas">SaaS / Technology</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <h2>Infrastructure configuration</h2>
              <p className="form-subtitle">These settings define your AWS landing zone deployment.</p>
              <div className="field"><label>Primary AWS region</label>
                <select value={form.awsRegion} onChange={set("awsRegion")}>
                  {REGIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                </select>
              </div>
              <div className="field"><label>Guardrails level</label>
                <div className="radio-group">
                  {[
                    { value: "standard", label: "Standard", desc: "CIS Level 1, basic VPC isolation" },
                    { value: "enhanced", label: "Enhanced", desc: "SOC 2 / HIPAA controls + SIEM integration" },
                    { value: "sovereign", label: "Sovereign", desc: "FedRAMP High + advanced threat detection" },
                  ].map((opt) => (
                    <label key={opt.value} className={`radio-card ${form.guardrailsLevel === opt.value ? "selected" : ""}`}>
                      <input type="radio" name="guardrails" value={opt.value} checked={form.guardrailsLevel === opt.value} onChange={set("guardrailsLevel")} />
                      <span className="radio-label">{opt.label}</span>
                      <span className="radio-desc">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="toggle-label">
                  <span>Enforce MFA on all IAM users</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.mfaEnabled}
                    className={`toggle ${form.mfaEnabled ? "on" : ""}`}
                    onClick={() => setForm(f => ({ ...f, mfaEnabled: !f.mfaEnabled }))}
                  >
                    <div className="toggle-thumb" />
                  </button>
                </label>
              </div>
              <div className="field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.agreeToTerms} onChange={set("agreeToTerms")} />
                  <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step verify-step">
              <div className="verify-icon">✉</div>
              <h2>Check your inbox</h2>
              <p className="form-subtitle">We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account and start provisioning.</p>
              <div className="verify-info">
                <div className="verify-row"><span>Organization</span><strong>{form.orgName}</strong></div>
                <div className="verify-row"><span>Region</span><strong>{form.awsRegion}</strong></div>
                <div className="verify-row"><span>Guardrails</span><strong style={{ textTransform: "capitalize" }}>{form.guardrailsLevel}</strong></div>
              </div>
              <p className="resend-text">Didn't receive it? <button className="link-btn" onClick={resendVerification} disabled={loading}>{loading ? "Sending…" : "Resend verification email"}</button></p>
              {onSuccess && <button className="btn-primary" onClick={() => onSuccess({ email: form.email, jobId })}>Go to Dashboard →</button>}
            </div>
          )}

          {error && <div className="form-error" role="alert">⚠ {error}</div>}

          {step < 3 && (
            <div className="form-nav">
              {step > 0 && <button className="btn-secondary" onClick={back} disabled={loading}>← Back</button>}
              {step < 2 && <button className="btn-primary" onClick={next}>Continue →</button>}
              {step === 2 && <button className="btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? "Creating account…" : "Launch my infrastructure →"}</button>}
            </div>
          )}
        </div>
        <p className="signin-link">Already have an account? <a href="/login">Sign in</a></p>
      </div>
    </div>
  );
}
