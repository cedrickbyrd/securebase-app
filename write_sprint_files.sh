#!/usr/bin/env bash
# =============================================================================
# write_sprint_files.sh
# Run from the ROOT of securebase-app. Writes all sprint files in place.
# =============================================================================
set -euo pipefail

echo "▶ Creating directories..."
mkdir -p phase3a-portal/src/components/signup
mkdir -p phase3a-portal/src/components/onboarding
mkdir -p lambda
mkdir -p database/migrations
mkdir -p terraform/modules/customer-baseline

# =============================================================================
# 1. SignupForm.jsx
# =============================================================================
cat > phase3a-portal/src/components/signup/SignupForm.jsx << 'ENDOFFILE'
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
      const res = await fetch(`${API_BASE}/api/signup`, {
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
      await fetch(`${API_BASE}/api/signup/resend-verification`, {
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
                  <div className={`toggle ${form.mfaEnabled ? "on" : ""}`} onClick={() => setForm(f => ({ ...f, mfaEnabled: !f.mfaEnabled }))}>
                    <div className="toggle-thumb" />
                  </div>
                </label>
              </div>
              <div className="field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.agreeToTerms} onChange={set("agreeToTerms")} />
                  <span>I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a></span>
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
ENDOFFILE

# =============================================================================
# 2. SignupForm.css
# =============================================================================
cat > phase3a-portal/src/components/signup/SignupForm.css << 'ENDOFFILE'
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
:root {
  --sb-bg:#0a0c10;--sb-surface:#0f1318;--sb-border:#1e2530;--sb-border-hi:#2a3545;
  --sb-accent:#00e5b4;--sb-accent-dim:#00e5b430;--sb-text:#e2e8f0;--sb-muted:#64748b;
  --sb-error:#f87171;--radius:6px;
}
.signup-shell{display:flex;min-height:100vh;background:var(--sb-bg);font-family:'DM Sans',sans-serif;color:var(--sb-text);}
.signup-brand{width:380px;flex-shrink:0;background:var(--sb-surface);border-right:1px solid var(--sb-border);padding:48px 40px;display:flex;flex-direction:column;gap:40px;position:relative;overflow:hidden;}
.signup-brand::before{content:'';position:absolute;top:-80px;right:-80px;width:300px;height:300px;background:radial-gradient(circle,#00e5b415 0%,transparent 70%);pointer-events:none;}
.brand-mark{display:flex;align-items:center;gap:10px;font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:0.04em;}
.brand-icon{color:var(--sb-accent);font-size:1.5rem;}
.brand-copy h1{font-family:'Syne',sans-serif;font-weight:700;font-size:1.75rem;line-height:1.2;margin:0 0 12px;color:#fff;}
.brand-copy p{color:var(--sb-muted);font-size:0.9rem;line-height:1.6;margin:0;}
.brand-features{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;}
.brand-features li{display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--sb-muted);}
.check{color:var(--sb-accent);font-size:0.75rem;background:var(--sb-accent-dim);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.brand-pilot{display:flex;flex-direction:column;gap:6px;padding:16px;border:1px solid var(--sb-border-hi);border-radius:var(--radius);background:#00e5b408;}
.pilot-badge{font-family:'IBM Plex Mono',monospace;font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--sb-accent);}
.pilot-text{font-size:0.82rem;color:var(--sb-muted);}
.signup-form-panel{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;gap:24px;}
.step-indicator{display:flex;align-items:center;}
.step-dot{display:flex;align-items:center;gap:8px;font-size:0.8rem;color:var(--sb-muted);position:relative;}
.step-dot:not(:last-child)::after{content:'';display:block;width:48px;height:1px;background:var(--sb-border);margin:0 12px;}
.step-dot.done::after,.step-dot.active::after{background:var(--sb-accent);}
.step-num{width:28px;height:28px;border-radius:50%;border:1px solid var(--sb-border);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:0.75rem;background:var(--sb-surface);transition:all 0.2s;}
.step-dot.active .step-num{border-color:var(--sb-accent);color:var(--sb-accent);background:var(--sb-accent-dim);}
.step-dot.done .step-num{border-color:var(--sb-accent);background:var(--sb-accent);color:#000;font-weight:700;}
.step-label{font-size:0.75rem;}.step-dot.active .step-label{color:var(--sb-text);}
.form-card{width:100%;max-width:480px;background:var(--sb-surface);border:1px solid var(--sb-border);border-radius:10px;padding:36px;display:flex;flex-direction:column;gap:20px;}
.form-step h2{font-family:'Syne',sans-serif;font-weight:700;font-size:1.4rem;margin:0 0 4px;color:#fff;}
.form-subtitle{color:var(--sb-muted);font-size:0.875rem;margin:0 0 16px;line-height:1.5;}
.field{display:flex;flex-direction:column;gap:6px;}
.field label{font-size:0.8rem;font-weight:500;color:var(--sb-muted);letter-spacing:0.03em;}
.field .hint{font-weight:400;opacity:0.7;}
.field input,.field select{background:var(--sb-bg);border:1px solid var(--sb-border);border-radius:var(--radius);color:var(--sb-text);padding:10px 14px;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;transition:border-color 0.15s;width:100%;box-sizing:border-box;}
.field input:focus,.field select:focus{border-color:var(--sb-accent);box-shadow:0 0 0 3px var(--sb-accent-dim);}
.field select option{background:var(--sb-surface);}
.field-row{display:flex;gap:14px;}.field-row .field{flex:1;}
.radio-group{display:flex;flex-direction:column;gap:8px;}
.radio-card{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--sb-border);border-radius:var(--radius);cursor:pointer;transition:all 0.15s;}
.radio-card:hover{border-color:var(--sb-border-hi);}
.radio-card.selected{border-color:var(--sb-accent);background:var(--sb-accent-dim);}
.radio-card input[type="radio"]{margin-top:2px;accent-color:var(--sb-accent);}
.radio-label{font-size:0.875rem;font-weight:500;color:var(--sb-text);}
.radio-desc{font-size:0.775rem;color:var(--sb-muted);margin-left:auto;text-align:right;max-width:220px;}
.toggle-label{display:flex!important;flex-direction:row!important;align-items:center;justify-content:space-between;font-size:0.875rem;color:var(--sb-text)!important;cursor:pointer;}
.toggle{width:44px;height:24px;background:var(--sb-border);border-radius:12px;position:relative;transition:background 0.2s;flex-shrink:0;}
.toggle.on{background:var(--sb-accent);}
.toggle-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s;}
.toggle.on .toggle-thumb{transform:translateX(20px);}
.checkbox-label{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:10px;font-size:0.83rem;color:var(--sb-muted)!important;cursor:pointer;}
.checkbox-label input{accent-color:var(--sb-accent);margin-top:2px;flex-shrink:0;}
.checkbox-label a{color:var(--sb-accent);text-decoration:none;}
.verify-step{text-align:center;align-items:center;}
.verify-icon{font-size:3rem;margin-bottom:8px;}
.verify-info{width:100%;background:var(--sb-bg);border:1px solid var(--sb-border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:10px;text-align:left;margin:8px 0;}
.verify-row{display:flex;justify-content:space-between;font-size:0.83rem;color:var(--sb-muted);}
.verify-row strong{color:var(--sb-text);}
.resend-text{font-size:0.82rem;color:var(--sb-muted);}
.btn-primary{background:var(--sb-accent);color:#000;border:none;border-radius:var(--radius);padding:11px 24px;font-family:'DM Sans',sans-serif;font-size:0.9rem;font-weight:600;cursor:pointer;transition:opacity 0.15s,transform 0.1s;}
.btn-primary:hover:not(:disabled){opacity:0.9;transform:translateY(-1px);}
.btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
.btn-secondary{background:transparent;color:var(--sb-muted);border:1px solid var(--sb-border);border-radius:var(--radius);padding:11px 20px;font-family:'DM Sans',sans-serif;font-size:0.9rem;cursor:pointer;transition:border-color 0.15s;}
.btn-secondary:hover{border-color:var(--sb-border-hi);color:var(--sb-text);}
.link-btn{background:none;border:none;padding:0;color:var(--sb-accent);cursor:pointer;font-size:inherit;text-decoration:underline;}
.form-nav{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-top:4px;}
.form-nav .btn-secondary{margin-right:auto;}
.form-error{background:#f871711a;border:1px solid #f8717140;border-radius:var(--radius);padding:10px 14px;font-size:0.83rem;color:var(--sb-error);}
.signin-link{font-size:0.83rem;color:var(--sb-muted);}
.signin-link a{color:var(--sb-accent);text-decoration:none;}
@media(max-width:768px){.signup-brand{display:none;}.form-card{padding:24px 20px;}.field-row{flex-direction:column;gap:16px;}.radio-desc{display:none;}}
ENDOFFILE

# =============================================================================
# 3. OnboardingProgress.jsx
# =============================================================================
cat > phase3a-portal/src/components/onboarding/OnboardingProgress.jsx << 'ENDOFFILE'
import { useState, useEffect, useCallback } from "react";
import "./OnboardingProgress.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const ONBOARDING_STEPS = [
  { key: "email_verified",    label: "Email verified",                   icon: "✉" },
  { key: "account_created",   label: "AWS account created",              icon: "☁" },
  { key: "org_linked",        label: "Linked to AWS Organization",       icon: "⬡" },
  { key: "terraform_applied", label: "Baseline infrastructure deployed", icon: "⚙" },
  { key: "guardrails_active", label: "Security guardrails activated",    icon: "🛡" },
  { key: "iam_roles_created", label: "IAM roles configured",             icon: "🔑" },
  { key: "welcome_sent",      label: "Welcome email & API keys sent",    icon: "🚀" },
];

export default function OnboardingProgress({ jobId, email, compact = false }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/status?jobId=${encodeURIComponent(jobId)}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
      if (data.overallStatus === "completed" || data.overallStatus === "failed") setPolling(false);
    } catch (e) { setError(e.message); }
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
    if (!polling) return;
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus, polling]);

  if (!jobId) return null;

  const completedCount = status ? ONBOARDING_STEPS.filter(s => status.steps?.[s.key] === "completed").length : 0;
  const progressPct = Math.round((completedCount / ONBOARDING_STEPS.length) * 100);
  const overallStatus = status?.overallStatus ?? "in_progress";

  if (compact) {
    return (
      <div className="onboarding-compact">
        <div className="compact-header">
          <span className="compact-title">Infrastructure Setup</span>
          <span className={`status-badge ${overallStatus}`}>{overallStatus === "completed" ? "✓ Complete" : overallStatus === "failed" ? "✗ Failed" : "⟳ In progress"}</span>
        </div>
        <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${progressPct}%` }} /></div>
        <span className="compact-pct">{completedCount} / {ONBOARDING_STEPS.length} steps</span>
      </div>
    );
  }

  return (
    <div className="onboarding-panel">
      <div className="onboarding-header">
        <div><h3>Infrastructure Provisioning</h3>{email && <p className="onboarding-email">{email}</p>}</div>
        <div className="overall-badge-wrap">
          <span className={`status-badge large ${overallStatus}`}>{overallStatus === "completed" ? "✓ Complete" : overallStatus === "failed" ? "✗ Failed" : "⟳ Provisioning…"}</span>
          {overallStatus === "completed" && status?.awsAccountId && <span className="account-id">Account: <code>{status.awsAccountId}</code></span>}
        </div>
      </div>
      <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${progressPct}%` }} /></div>
      <div className="progress-labels"><span>{completedCount} of {ONBOARDING_STEPS.length} steps complete</span><span>{progressPct}%</span></div>
      <div className="steps-list">
        {ONBOARDING_STEPS.map((step, idx) => {
          const stepStatus = status?.steps?.[step.key] ?? "pending";
          return (
            <div key={step.key} className={`step-row ${stepStatus}`}>
              <div className="step-icon-wrap">
                <span className="step-icon-bg" style={{ borderColor: stepStatus === "completed" ? "var(--sb-accent)" : stepStatus === "in_progress" ? "#fbbf24" : stepStatus === "failed" ? "#f87171" : "var(--sb-border)" }}>
                  {stepStatus === "completed" ? "✓" : step.icon}
                </span>
                {idx < ONBOARDING_STEPS.length - 1 && <div className="step-connector" style={{ background: stepStatus === "completed" ? "var(--sb-accent)" : "var(--sb-border)" }} />}
              </div>
              <div className="step-info">
                <span className="step-label">{step.label}</span>
                {stepStatus === "in_progress" && <span className="step-spinner">processing…</span>}
                {stepStatus === "failed" && status?.errors?.[step.key] && <span className="step-error">{status.errors[step.key]}</span>}
                {stepStatus === "completed" && status?.timestamps?.[step.key] && <span className="step-ts">{new Date(status.timestamps[step.key]).toLocaleTimeString()}</span>}
              </div>
              <span className={`step-status-dot ${stepStatus}`} />
            </div>
          );
        })}
      </div>
      {error && <div className="onboarding-error">⚠ Could not fetch status. <button className="link-btn" onClick={fetchStatus}>Retry</button></div>}
      {overallStatus === "completed" && (
        <div className="completion-card">
          <div className="completion-header"><span className="completion-icon">🚀</span><div><strong>Your environment is ready</strong><p>API keys and documentation have been sent to {email}.</p></div></div>
          <div className="completion-links"><a href="/dashboard" className="btn-primary">Open Dashboard →</a><a href="/docs/getting-started" className="btn-secondary">View Docs</a></div>
        </div>
      )}
      {overallStatus === "failed" && (
        <div className="failure-card">
          <strong>Provisioning failed</strong>
          <p>Our team has been alerted. Job ID: <code>{jobId}</code></p>
          <a href="mailto:support@securebase.tximhotep.com" className="btn-secondary">Contact Support</a>
        </div>
      )}
    </div>
  );
}
ENDOFFILE

# =============================================================================
# 4. OnboardingProgress.css
# =============================================================================
cat > phase3a-portal/src/components/onboarding/OnboardingProgress.css << 'ENDOFFILE'
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
:root{--sb-bg:#0a0c10;--sb-surface:#0f1318;--sb-border:#1e2530;--sb-border-hi:#2a3545;--sb-accent:#00e5b4;--sb-accent-dim:#00e5b430;--sb-text:#e2e8f0;--sb-muted:#64748b;}
.onboarding-panel{background:var(--sb-surface);border:1px solid var(--sb-border);border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:20px;font-family:'DM Sans',sans-serif;color:var(--sb-text);max-width:560px;}
.onboarding-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
.onboarding-header h3{margin:0;font-size:1.1rem;font-weight:600;color:#fff;}
.onboarding-email{margin:4px 0 0;font-size:0.8rem;color:var(--sb-muted);}
.overall-badge-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.status-badge{font-size:0.75rem;font-family:'IBM Plex Mono',monospace;padding:4px 10px;border-radius:20px;white-space:nowrap;}
.status-badge.completed{background:#00e5b420;color:var(--sb-accent);border:1px solid var(--sb-accent);}
.status-badge.in_progress{background:#fbbf2415;color:#fbbf24;border:1px solid #fbbf2440;}
.status-badge.failed{background:#f8717115;color:#f87171;border:1px solid #f8717140;}
.status-badge.large{font-size:0.82rem;padding:6px 14px;}
.account-id{font-size:0.72rem;color:var(--sb-muted);font-family:'IBM Plex Mono',monospace;}
.account-id code{color:var(--sb-text);}
.progress-bar-wrap{background:var(--sb-border);border-radius:4px;height:6px;overflow:hidden;}
.progress-bar{height:100%;background:linear-gradient(90deg,var(--sb-accent),#00c4f0);border-radius:4px;transition:width 0.6s ease;}
.progress-labels{display:flex;justify-content:space-between;font-size:0.75rem;color:var(--sb-muted);margin-top:-12px;}
.steps-list{display:flex;flex-direction:column;}
.step-row{display:flex;align-items:flex-start;gap:14px;padding:10px 0;}
.step-icon-wrap{display:flex;flex-direction:column;align-items:center;flex-shrink:0;}
.step-icon-bg{width:32px;height:32px;border-radius:50%;border:1px solid var(--sb-border);display:flex;align-items:center;justify-content:center;font-size:0.85rem;background:var(--sb-bg);transition:all 0.2s;}
.step-row.completed .step-icon-bg{background:var(--sb-accent-dim);border-color:var(--sb-accent);color:var(--sb-accent);font-weight:700;}
.step-row.in_progress .step-icon-bg{border-color:#fbbf24;background:#fbbf2415;animation:pulse-border 1.5s ease-in-out infinite;}
.step-row.failed .step-icon-bg{border-color:#f87171;background:#f8717115;}
@keyframes pulse-border{0%,100%{box-shadow:0 0 0 0 #fbbf2440;}50%{box-shadow:0 0 0 4px #fbbf2415;}}
.step-connector{width:1px;height:16px;background:var(--sb-border);margin:3px 0;flex-shrink:0;}
.step-info{flex:1;display:flex;flex-direction:column;gap:2px;padding-top:6px;}
.step-label{font-size:0.875rem;color:var(--sb-text);}
.step-row.pending .step-label{color:var(--sb-muted);}
.step-spinner{font-size:0.75rem;color:#fbbf24;font-family:'IBM Plex Mono',monospace;}
.step-error{font-size:0.75rem;color:#f87171;}
.step-ts{font-size:0.72rem;color:var(--sb-muted);font-family:'IBM Plex Mono',monospace;}
.step-status-dot{width:8px;height:8px;border-radius:50%;margin-top:12px;flex-shrink:0;}
.step-status-dot.completed{background:var(--sb-accent);}
.step-status-dot.in_progress{background:#fbbf24;}
.step-status-dot.pending{background:var(--sb-border);}
.step-status-dot.failed{background:#f87171;}
.completion-card{background:var(--sb-accent-dim);border:1px solid var(--sb-accent);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:14px;}
.completion-header{display:flex;gap:14px;align-items:flex-start;}
.completion-icon{font-size:1.5rem;}
.completion-header strong{display:block;font-size:0.95rem;color:#fff;margin-bottom:4px;}
.completion-header p{margin:0;font-size:0.82rem;color:var(--sb-muted);}
.completion-links{display:flex;gap:10px;}
.failure-card{background:#f8717110;border:1px solid #f8717140;border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:8px;}
.failure-card strong{color:#f87171;font-size:0.95rem;}
.failure-card p{margin:0;font-size:0.82rem;color:var(--sb-muted);}
.failure-card code{color:var(--sb-text);font-family:'IBM Plex Mono',monospace;}
.onboarding-error{font-size:0.82rem;color:#fbbf24;padding:10px 14px;background:#fbbf2410;border:1px solid #fbbf2430;border-radius:6px;}
.onboarding-compact{background:var(--sb-surface);border:1px solid var(--sb-border);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:'DM Sans',sans-serif;}
.compact-header{display:flex;justify-content:space-between;align-items:center;}
.compact-title{font-size:0.875rem;font-weight:500;color:var(--sb-text);}
.compact-pct{font-size:0.75rem;color:var(--sb-muted);text-align:right;}
.btn-primary{background:var(--sb-accent);color:#000;border:none;border-radius:6px;padding:9px 20px;font-family:'DM Sans',sans-serif;font-size:0.875rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;transition:opacity 0.15s;}
.btn-primary:hover{opacity:0.88;}
.btn-secondary{background:transparent;color:var(--sb-muted);border:1px solid var(--sb-border);border-radius:6px;padding:9px 18px;font-family:'DM Sans',sans-serif;font-size:0.875rem;cursor:pointer;text-decoration:none;display:inline-block;}
.link-btn{background:none;border:none;padding:0;color:var(--sb-accent);cursor:pointer;font-size:inherit;text-decoration:underline;}
ENDOFFILE

# =============================================================================
# 5. Lambda functions (written inline via Python heredocs)
# =============================================================================
echo "▶ Writing Lambda functions..."

python3 - << 'PYEOF'
import os

signup = r'''
import json, logging, os, re, uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); ses=boto3.client("ses",region_name=os.environ.get("AWS_REGION","us-east-1"))
cognito=boto3.client("cognito-idp"); lambda_=boto3.client("lambda"); rds=boto3.client("rds-data")

def get_param(name,decrypt=True): return ssm.get_parameter(Name=name,WithDecryption=decrypt)["Parameter"]["Value"]
def cors_response(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com")},"body":json.dumps(body)}
def validate_payload(body):
    errors=[]
    for f in ["firstName","lastName","email","password","orgName","orgSize","industry","awsRegion"]:
        if not body.get(f,"").strip(): errors.append(f"{f} is required.")
    if body.get("email") and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$",body["email"]): errors.append("Invalid email.")
    if len(body.get("password",""))<12: errors.append("Password must be at least 12 characters.")
    if body.get("awsRegion") not in ["us-east-1","us-west-2","eu-west-1","ap-southeast-1","ap-northeast-1"]: errors.append("Invalid AWS region.")
    return errors

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors_response(200,{})
    try: body=json.loads(event.get("body") or "{}")
    except: return cors_response(400,{"message":"Invalid JSON."})
    errors=validate_payload(body)
    if errors: return cors_response(400,{"message":errors[0],"errors":errors})
    email=body["email"].strip().lower(); job_id=str(uuid.uuid4()); customer_id=str(uuid.uuid4()); now=datetime.now(timezone.utc).isoformat()
    try:
        db_resource_arn=get_param("/securebase/db/resource_arn"); db_secret_arn=get_param("/securebase/db/secret_arn")
        db_name=get_param("/securebase/db/name"); ses_sender=get_param("/securebase/ses/from_address")
        user_pool_id=get_param("/securebase/cognito/user_pool_id"); provisioner_fn=get_param("/securebase/provisioner/function")
    except ClientError as e: logger.error("SSM error: %s",e); return cors_response(500,{"message":"Configuration error."})
    try:
        dup=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT id FROM customers WHERE email=:email LIMIT 1",parameters=[{"name":"email","value":{"stringValue":email}}])
        if dup["records"]: return cors_response(409,{"message":"An account with this email already exists."})
    except ClientError as e: return cors_response(500,{"message":"Database error."})
    try:
        cognito.admin_create_user(UserPoolId=user_pool_id,Username=email,UserAttributes=[{"Name":"email","Value":email},{"Name":"given_name","Value":body["firstName"]},{"Name":"family_name","Value":body["lastName"]},{"Name":"custom:org_name","Value":body["orgName"]},{"Name":"custom:job_id","Value":job_id}],TemporaryPassword=body["password"],MessageAction="SUPPRESS")
    except cognito.exceptions.UsernameExistsException: return cors_response(409,{"message":"An account with this email already exists."})
    except ClientError as e: return cors_response(500,{"message":"Failed to create account."})
    try:
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="INSERT INTO customers(id,email,first_name,last_name,org_name,org_size,industry,aws_region,mfa_enabled,guardrails_level,onboarding_status,created_at) VALUES(:id,:email,:fn,:ln,:org,:sz,:ind,:reg,:mfa,:gl,'pending',:ca)",parameters=[{"name":"id","value":{"stringValue":customer_id}},{"name":"email","value":{"stringValue":email}},{"name":"fn","value":{"stringValue":body["firstName"]}},{"name":"ln","value":{"stringValue":body["lastName"]}},{"name":"org","value":{"stringValue":body["orgName"]}},{"name":"sz","value":{"stringValue":body["orgSize"]}},{"name":"ind","value":{"stringValue":body["industry"]}},{"name":"reg","value":{"stringValue":body["awsRegion"]}},{"name":"mfa","value":{"booleanValue":bool(body.get("mfaEnabled",True))}},{"name":"gl","value":{"stringValue":body.get("guardrailsLevel","standard")}},{"name":"ca","value":{"stringValue":now}}])
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="INSERT INTO onboarding_jobs(id,customer_id,overall_status,created_at,updated_at) VALUES(:id,:cid,'pending',:ca,:ca)",parameters=[{"name":"id","value":{"stringValue":job_id}},{"name":"cid","value":{"stringValue":customer_id}},{"name":"ca","value":{"stringValue":now}}])
    except ClientError as e:
        try: cognito.admin_delete_user(UserPoolId=user_pool_id,Username=email)
        except: pass
        return cors_response(500,{"message":"Failed to save account data."})
    verify_url=f"https://securebase.tximhotep.com/verify-email?token={job_id}&email={email}"
    try: ses.send_email(Source=ses_sender,Destination={"ToAddresses":[email]},Message={"Subject":{"Data":"Verify your SecureBase account"},"Body":{"Text":{"Data":f"Hi {body['firstName']},\n\nVerify your email: {verify_url}\n\n— SecureBase"}}})
    except ClientError as e: logger.error("SES error: %s",e)
    try: lambda_.invoke(FunctionName=provisioner_fn,InvocationType="Event",Payload=json.dumps({"jobId":job_id,"customerId":customer_id,"email":email,"orgName":body["orgName"],"awsRegion":body["awsRegion"],"mfaEnabled":bool(body.get("mfaEnabled",True)),"guardrailsLevel":body.get("guardrailsLevel","standard")}))
    except ClientError as e: logger.error("Provisioner invoke error: %s",e)
    logger.info("Signup: customer=%s job=%s",customer_id,job_id)
    return cors_response(201,{"message":"Account created. Please verify your email.","jobId":job_id})
'''

with open("lambda/signup_handler.py","w") as f: f.write(signup.strip())
print("  wrote lambda/signup_handler.py")

status_fn = r'''
import json, logging, os, re
import boto3
from botocore.exceptions import ClientError

logger=logging.getLogger(); logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); rds=boto3.client("rds-data")
STEP_KEYS=["email_verified","account_created","org_linked","terraform_applied","guardrails_active","iam_roles_created","welcome_sent"]

def get_param(name): return ssm.get_parameter(Name=name,WithDecryption=True)["Parameter"]["Value"]
def cors_response(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com")},"body":json.dumps(body)}

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors_response(200,{})
    params=event.get("queryStringParameters") or {}
    job_id=params.get("jobId","").strip()
    if not job_id: return cors_response(400,{"message":"jobId is required."})
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",job_id): return cors_response(400,{"message":"Invalid jobId."})
    try:
        db_resource_arn=get_param("/securebase/db/resource_arn"); db_secret_arn=get_param("/securebase/db/secret_arn"); db_name=get_param("/securebase/db/name")
    except ClientError: return cors_response(500,{"message":"Configuration error."})
    try:
        rows=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT overall_status,aws_account_id,created_at FROM onboarding_jobs WHERE id=:id",parameters=[{"name":"id","value":{"stringValue":job_id}}])["records"]
    except ClientError: return cors_response(500,{"message":"Database error."})
    if not rows: return cors_response(404,{"message":"Job not found."})
    row=rows[0]; overall_status=row[0]["stringValue"]; aws_account_id=None if row[1].get("isNull") else row[1].get("stringValue"); created_at=row[2]["stringValue"]
    try:
        step_rows=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT step_key,status,error_message,updated_at FROM onboarding_steps WHERE job_id=:id",parameters=[{"name":"id","value":{"stringValue":job_id}}])["records"]
    except: step_rows=[]
    steps={k:"pending" for k in STEP_KEYS}; timestamps={}; errors={}
    for r in step_rows:
        k=r[0]["stringValue"]; s=r[1]["stringValue"]; err=None if r[2].get("isNull") else r[2].get("stringValue"); ts=r[3]["stringValue"]
        steps[k]=s; timestamps[k]=ts
        if err: errors[k]=err
    return cors_response(200,{"jobId":job_id,"overallStatus":overall_status,"awsAccountId":aws_account_id,"createdAt":created_at,"steps":steps,"timestamps":timestamps,"errors":errors})
'''

with open("lambda/onboarding_status.py","w") as f: f.write(status_fn.strip())
print("  wrote lambda/onboarding_status.py")
print("  (account_provisioner.py is large — see SPRINT_README.md for full source or download from sprint outputs)")
PYEOF

# =============================================================================
# 6. Database migration
# =============================================================================
cat > database/migrations/003_customer_signup_onboarding.sql << 'ENDOFFILE'
-- SecureBase: Customer Self-Service & Onboarding Schema
-- Migration: 003_customer_signup_onboarding.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(320)    NOT NULL,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    org_name            VARCHAR(200)    NOT NULL,
    org_size            VARCHAR(20)     NOT NULL,
    industry            VARCHAR(50)     NOT NULL,
    aws_account_id      VARCHAR(12),
    aws_region          VARCHAR(25)     NOT NULL DEFAULT 'us-east-1',
    mfa_enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    guardrails_level    VARCHAR(20)     NOT NULL DEFAULT 'standard' CHECK (guardrails_level IN ('standard','enhanced','sovereign')),
    onboarding_status   VARCHAR(30)     NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending','in_progress','completed','failed')),
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email ON customers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_aws_account ON customers (aws_account_id);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers (onboarding_status);

CREATE TABLE IF NOT EXISTS onboarding_jobs (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID            NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    overall_status      VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending','in_progress','completed','failed')),
    aws_account_id      VARCHAR(12),
    codebuild_build_id  VARCHAR(200),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_jobs_customer ON onboarding_jobs (customer_id);

CREATE TABLE IF NOT EXISTS onboarding_steps (
    id              SERIAL          PRIMARY KEY,
    job_id          UUID            NOT NULL REFERENCES onboarding_jobs(id) ON DELETE CASCADE,
    step_key        VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
    error_message   TEXT,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_step ON onboarding_steps (job_id, step_key);

CREATE TABLE IF NOT EXISTS onboarding_events (
    id              BIGSERIAL       PRIMARY KEY,
    job_id          UUID            NOT NULL REFERENCES onboarding_jobs(id),
    customer_id     UUID            NOT NULL REFERENCES customers(id),
    event_type      VARCHAR(50)     NOT NULL,
    step_key        VARCHAR(50),
    payload         JSONB           DEFAULT '{}',
    severity        VARCHAR(10)     NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_job_id ON onboarding_events (job_id);
CREATE INDEX IF NOT EXISTS idx_events_customer_id ON onboarding_events (customer_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_customers_updated_at') THEN CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_onboarding_jobs_updated_at') THEN CREATE TRIGGER trg_onboarding_jobs_updated_at BEFORE UPDATE ON onboarding_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
END $$;

COMMENT ON TABLE customers IS 'PII table — email, first_name, last_name are sensitive. Do not log in CloudWatch.';
COMMENT ON TABLE onboarding_events IS 'Append-only audit log. Never UPDATE or DELETE.';
ENDOFFILE

# =============================================================================
# 7. Terraform module
# =============================================================================
cat > terraform/modules/customer-baseline/main.tf << 'ENDOFFILE'
# SecureBase customer-baseline Terraform module
# Called by CodeBuild per-customer with variable overrides.
terraform {
  required_version = ">= 1.6"
  required_providers { aws = { source="hashicorp/aws" version="~> 5.0" } }
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
  assume_role { role_arn = "arn:aws:iam::${var.customer_account_id}:role/${var.baseline_role_name}" }
  default_tags { tags = local.common_tags }
}

variable "customer_account_id" { type=string validation { condition=can(regex("^[0-9]{12}$",var.customer_account_id)) error_message="Must be 12 digits." } }
variable "customer_name"       { type=string }
variable "aws_region"          { type=string default="us-east-1" }
variable "mfa_enabled"         { type=bool   default=true }
variable "guardrails_level"    { type=string default="standard" validation { condition=contains(["standard","enhanced","sovereign"],var.guardrails_level) error_message="Must be standard, enhanced, or sovereign." } }
variable "job_id"              { type=string }
variable "vpc_cidr"            { type=string default="10.0.0.0/16" }
variable "baseline_role_name"  { type=string default="SecureBaseBaselineRole" }
variable "securebase_control_plane_role_arn" { type=string }

locals {
  name_prefix = "securebase-${lower(replace(var.customer_name," ","-"))}"
  common_tags = { ManagedBy="SecureBase-Terraform" CustomerAccountId=var.customer_account_id CustomerName=var.customer_name GuardrailsLevel=var.guardrails_level JobId=var.job_id Environment="production" }
  azs = ["${var.aws_region}a","${var.aws_region}b"]
}

resource "aws_vpc" "main" { cidr_block=var.vpc_cidr enable_dns_support=true enable_dns_hostnames=true tags={Name="${local.name_prefix}-vpc"} }
resource "aws_internet_gateway" "main" { vpc_id=aws_vpc.main.id tags={Name="${local.name_prefix}-igw"} }
resource "aws_subnet" "public"   { count=2 vpc_id=aws_vpc.main.id cidr_block=cidrsubnet(var.vpc_cidr,4,count.index)   availability_zone=local.azs[count.index] tags={Name="${local.name_prefix}-public-${count.index+1}" Tier="public"} }
resource "aws_subnet" "private"  { count=2 vpc_id=aws_vpc.main.id cidr_block=cidrsubnet(var.vpc_cidr,4,count.index+4) availability_zone=local.azs[count.index] tags={Name="${local.name_prefix}-private-${count.index+1}" Tier="private"} }
resource "aws_eip" "nat"         { domain="vpc" tags={Name="${local.name_prefix}-nat-eip"} }
resource "aws_nat_gateway" "main" { allocation_id=aws_eip.nat.id subnet_id=aws_subnet.public[0].id tags={Name="${local.name_prefix}-natgw"} depends_on=[aws_internet_gateway.main] }
resource "aws_route_table" "public"  { vpc_id=aws_vpc.main.id route { cidr_block="0.0.0.0/0" gateway_id=aws_internet_gateway.main.id } tags={Name="${local.name_prefix}-rt-public"} }
resource "aws_route_table" "private" { vpc_id=aws_vpc.main.id route { cidr_block="0.0.0.0/0" nat_gateway_id=aws_nat_gateway.main.id } tags={Name="${local.name_prefix}-rt-private"} }
resource "aws_route_table_association" "public"  { count=2 subnet_id=aws_subnet.public[count.index].id  route_table_id=aws_route_table.public.id }
resource "aws_route_table_association" "private" { count=2 subnet_id=aws_subnet.private[count.index].id route_table_id=aws_route_table.private.id }

resource "aws_s3_account_public_access_block" "main" { block_public_acls=true block_public_policy=true ignore_public_acls=true restrict_public_buckets=true }
resource "aws_ebs_encryption_by_default" "main" { enabled=true }
resource "aws_kms_key" "default" { description="${local.name_prefix} default encryption key" deletion_window_in_days=30 enable_key_rotation=true }
resource "aws_kms_alias" "default" { name="alias/${local.name_prefix}-default" target_key_id=aws_kms_key.default.key_id }
resource "aws_iam_account_password_policy" "main" { minimum_password_length=14 require_lowercase_characters=true require_uppercase_characters=true require_numbers=true require_symbols=true allow_users_to_change_password=true max_password_age=90 password_reuse_prevention=12 }

resource "aws_cloudtrail" "main" { name="${local.name_prefix}-trail" s3_bucket_name="securebase-cloudtrail-${var.customer_account_id}" include_global_service_events=true is_multi_region_trail=true enable_log_file_validation=true kms_key_id=aws_kms_key.default.arn }

resource "aws_iam_role" "securebase_access" {
  name="SecureBaseControlPlaneAccess"
  assume_role_policy=jsonencode({Version="2012-10-17" Statement=[{Effect="Allow" Principal={AWS=var.securebase_control_plane_role_arn} Action="sts:AssumeRole" Condition={StringEquals={"sts:ExternalId"=var.job_id}}}]})
}
resource "aws_iam_role_policy_attachment" "securebase_readonly" { role=aws_iam_role.securebase_access.name policy_arn="arn:aws:iam::aws:policy/SecurityAudit" }

resource "aws_guardduty_detector" "main" { count=var.guardrails_level!="standard"?1:0 enable=true }
resource "aws_securityhub_account" "main" { count=var.guardrails_level!="standard"?1:0 enable_default_standards=true }
resource "aws_macie2_account" "main" { count=var.guardrails_level=="sovereign"?1:0 status="ENABLED" }

output "vpc_id"                      { value=aws_vpc.main.id }
output "private_subnet_ids"          { value=aws_subnet.private[*].id }
output "kms_key_arn"                 { value=aws_kms_key.default.arn }
output "securebase_access_role_arn"  { value=aws_iam_role.securebase_access.arn }
output "customer_account_id"         { value=var.customer_account_id }
output "job_id"                      { value=var.job_id }
ENDOFFILE

echo ""
echo "✅ All sprint files written. Now commit and push:"
echo ""
echo "  git add phase3a-portal/src/components/signup/ \\"
echo "          phase3a-portal/src/components/onboarding/ \\"
echo "          lambda/signup_handler.py lambda/onboarding_status.py \\"
echo "          database/migrations/003_customer_signup_onboarding.sql \\"
echo "          terraform/modules/customer-baseline/main.tf"
echo ""
echo "  git commit -m 'feat: implement customer self-service signup & onboarding'"
echo "  git push -u origin copilot/implement-self-service-signup-onboarding"
