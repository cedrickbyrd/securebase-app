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
