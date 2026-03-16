import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';
import './OnboardingProgress.css';

const POLL_INTERVAL_MS = 8000;

const STEP_LABELS = {
  email_verified:       'Email Verified',
  account_created:      'AWS Account Created',
  account_active:       'Account Activated',
  ou_assigned:          'Org Unit Assigned',
  terraform_running:    'Infrastructure Provisioning',
  guardrails_applied:   'Security Guardrails Applied',
  welcome_sent:         'Welcome Email Sent',
};

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     className: 'status-pending',    icon: '○' },
  in_progress:{ label: 'In Progress', className: 'status-in-progress',icon: '◌' },
  complete:   { label: 'Complete',    className: 'status-complete',   icon: '●' },
  failed:     { label: 'Failed',      className: 'status-failed',     icon: '✕' },
};

function StepRow({ step }) {
  const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
  return (
    <div className={`op-step-row ${cfg.className}`}>
      <span className="op-step-icon" aria-hidden="true">{cfg.icon}</span>
      <div className="op-step-body">
        <span className="op-step-name">{STEP_LABELS[step.step_key] || step.step_key}</span>
        {step.started_at && (
          <span className="op-step-time">
            {step.status === 'complete' && step.completed_at
              ? `Completed ${formatRelative(step.completed_at)}`
              : `Started ${formatRelative(step.started_at)}`}
          </span>
        )}
        {step.error_message && (
          <span className="op-step-error">{step.error_message}</span>
        )}
      </div>
      <span className="op-step-status-label">{cfg.label}</span>
    </div>
  );
}

function ProgressBar({ steps }) {
  if (!steps || steps.length === 0) return null;
  const completed = steps.filter((s) => s.status === 'complete').length;
  const pct = Math.round((completed / steps.length) * 100);
  return (
    <div className="op-progress-bar-wrap">
      <div className="op-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="op-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="op-progress-label">{completed}/{steps.length} steps complete</span>
    </div>
  );
}

function formatRelative(isoString) {
  try {
    const d = new Date(isoString);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  } catch {
    return '';
  }
}

/**
 * OnboardingProgress – shows live provisioning status for a customer.
 *
 * Props:
 *   customerId  (string)  – the customer UUID whose job to track
 *   compact     (boolean) – render a condensed widget for dashboard embedding
 */
export default function OnboardingProgress({ customerId, compact = false }) {
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [lastPoll, setLastPoll] = useState(null);
  const isTerminalRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const id = customerId || localStorage.getItem('customerId');
      if (!id) {
        setError('No customer ID found. Please log in.');
        setLoading(false);
        return;
      }
      const data = await apiService.get(`/onboarding/status?customer_id=${encodeURIComponent(id)}`);
      setJob(data);
      setLastPoll(new Date());
      setError('');
      if (data.status === 'complete' || data.status === 'failed') {
        isTerminalRef.current = true;
      }
    } catch (err) {
      setError(err.message || 'Unable to fetch onboarding status.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (!isTerminalRef.current) {
        fetchStatus();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Stop polling once a terminal state is reached.
  // No-op: the clearInterval in the cleanup above handles this via isTerminalRef.
  useEffect(() => {
    if (job && (job.status === 'complete' || job.status === 'failed')) {
      isTerminalRef.current = true;
    }
  }, [job]);

  if (loading) {
    return (
      <div className={`op-container ${compact ? 'op-compact' : ''}`}>
        <div className="op-loading">
          <span className="op-spinner" aria-label="Loading" />
          <span>Loading onboarding status…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`op-container ${compact ? 'op-compact' : ''}`}>
        <div className="op-error">{error}</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={`op-container ${compact ? 'op-compact' : ''}`}>
        <div className="op-empty">No active onboarding job found.</div>
      </div>
    );
  }

  const overallCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;

  if (compact) {
    const completed = (job.steps || []).filter((s) => s.status === 'complete').length;
    const total = (job.steps || []).length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return (
      <div className="op-container op-compact">
        <div className="op-compact-header">
          <span className="op-compact-title">Environment Setup</span>
          <span className={`op-badge ${overallCfg.className}`}>{overallCfg.label}</span>
        </div>
        <div className="op-progress-bar-wrap">
          <div className="op-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="op-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="op-progress-label">{completed}/{total} steps</span>
        </div>
      </div>
    );
  }

  return (
    <div className="op-container">
      <div className="op-header">
        <div>
          <h2 className="op-title">Environment Provisioning</h2>
          <p className="op-subtitle">Your SecureBase AWS environment is being set up.</p>
        </div>
        <span className={`op-badge op-badge-lg ${overallCfg.className}`}>{overallCfg.label}</span>
      </div>

      <ProgressBar steps={job.steps} />

      <div className="op-steps-list">
        {(job.steps || []).map((step) => (
          <StepRow key={step.step_key} step={step} />
        ))}
      </div>

      {job.status === 'complete' && (
        <div className="op-success-banner">
          🎉 Your environment is ready! <a href="/dashboard">Go to Dashboard →</a>
        </div>
      )}

      {job.status === 'failed' && (
        <div className="op-failure-banner">
          ⚠️ Provisioning encountered an issue. Our team has been notified.
          {job.error_message && <span className="op-failure-detail"> {job.error_message}</span>}
        </div>
      )}

      {lastPoll && job.status !== 'complete' && job.status !== 'failed' && (
        <p className="op-last-poll">
          Last updated {formatRelative(lastPoll.toISOString())} · auto-refreshes every 8s
        </p>
      )}
    </div>
  );
}
