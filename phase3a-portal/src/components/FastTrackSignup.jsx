/**
 * FastTrackSignup
 *
 * Single-field, email-only signup form for Wave 3 outreach campaigns.
 * Dramatically reduces friction vs. the 4-step form (13 fields → 1 field).
 *
 * Props:
 *   wave3Target  {string|null}  The Wave 3 company slug (e.g. 'column',
 *                               'mercury', 'lithic') or null for generic flow.
 *   onSuccess    {Function}     Called with { email } after successful submission.
 */

import React, { useState } from 'react';
import { submitLead } from '../services/crmService';
import { trackWave3HighValueAction, trackWave3Conversion, trackLeadCapture } from '../utils/analytics';

// ---------------------------------------------------------------------------
// Wave 3 company data
// ---------------------------------------------------------------------------

const WAVE3_COMPANIES = {
  column: {
    name: 'Column',
    industry: 'fintech',
    greeting: 'Welcome, Column! 🎯',
    tagline: 'Compliance infrastructure built for modern banking APIs.',
  },
  mercury: {
    name: 'Mercury',
    industry: 'fintech',
    greeting: 'Welcome, Mercury! 🎯',
    tagline: 'Enterprise compliance for the next generation of business banking.',
  },
  lithic: {
    name: 'Lithic',
    industry: 'fintech',
    greeting: 'Welcome, Lithic! 🎯',
    tagline: 'SOC 2 and PCI-ready infrastructure for card issuing platforms.',
  },
};

const DEFAULT_COMPANY = {
  name: null,
  industry: null,
  greeting: 'Get Started with SecureBase',
  tagline: 'Enterprise AWS compliance in 48 hours.',
};

const BENEFITS = [
  '✅ Full compliance dashboard access',
  '✅ 14-day free trial',
  '✅ No credit card required',
];

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ---------------------------------------------------------------------------
// Styles (inline so the component is fully self-contained)
// ---------------------------------------------------------------------------

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
  },
  logo: {
    fontWeight: 800,
    fontSize: '20px',
    color: '#667eea',
    textDecoration: 'none',
    letterSpacing: '-0.5px',
    display: 'block',
    marginBottom: '24px',
  },
  greeting: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px',
    lineHeight: 1.25,
  },
  tagline: {
    fontSize: '15px',
    color: '#6b7280',
    margin: '0 0 24px',
  },
  benefitsList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 28px',
  },
  benefitItem: {
    fontSize: '14px',
    color: '#374151',
    padding: '4px 0',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '6px',
  },
  inputBase: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  inputError: {
    borderColor: '#ef4444',
    background: '#fef2f2',
  },
  fieldError: {
    display: 'block',
    fontSize: '13px',
    color: '#dc2626',
    marginTop: '4px',
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    marginTop: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  submitError: {
    marginTop: '12px',
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#dc2626',
  },
  successIcon: {
    fontSize: '48px',
    textAlign: 'center',
    display: 'block',
    marginBottom: '16px',
  },
  successTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  successBody: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    margin: 0,
  },
  loginLink: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#6b7280',
  },
  loginAnchor: {
    color: '#667eea',
    fontWeight: 600,
    textDecoration: 'none',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FastTrackSignup({ wave3Target = null, onSuccess }) {
  const company = WAVE3_COMPANIES[wave3Target] || DEFAULT_COMPANY;

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Please enter a valid work email address.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Submit lead to Netlify function for CRM tracking
      await fetch('/.netlify/functions/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          company: company.name || '',
          trigger: 'fast_track_signup',
          campaign: wave3Target ? `wave3_${wave3Target}` : '',
          score: 85,
          grade: 'HOT',
        }),
      });

      // 2. Request magic link via backend API
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, magic_link: true }),
        });
      } catch (magicLinkErr) {
        // Magic link delivery is best-effort; don't block the UX, but log so
        // on-call engineers can identify delivery issues in production logs.
        console.warn('[FastTrackSignup] Magic link request failed (non-fatal):',
          magicLinkErr instanceof Error ? magicLinkErr.message : 'Unknown error');
      }

      // 3. Analytics
      trackLeadCapture('fast_track_signup');
      if (wave3Target) {
        trackWave3HighValueAction('fast_track_signup');
        trackWave3Conversion();
      }

      setSubmitted(true);
      onSuccess?.({ email: trimmed });
    } catch (err) {
      setSubmitError('Something went wrong. Please try again.');
      // Log only the message (not the full error object) to avoid leaking
      // any response body that may contain server-side details.
      console.warn('[FastTrackSignup] submission error:',
        err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <a href="/" style={styles.logo}>SecureBase</a>
          <span style={styles.successIcon}>✉️</span>
          <p style={styles.successTitle}>Check your inbox!</p>
          <p style={styles.successBody}>
            We sent a magic link to <strong>{email}</strong>. Click it to access your
            compliance dashboard instantly — no password needed.
          </p>
        </div>
      </div>
    );
  }

  const inputStyle = emailError
    ? { ...styles.inputBase, ...styles.inputError }
    : styles.inputBase;

  const btnStyle = submitting || !email.trim()
    ? { ...styles.submitBtn, ...styles.submitBtnDisabled }
    : styles.submitBtn;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <a href="/" style={styles.logo}>SecureBase</a>

        <h1 style={styles.greeting}>{company.greeting}</h1>
        <p style={styles.tagline}>{company.tagline}</p>

        <ul style={styles.benefitsList}>
          {BENEFITS.map((b) => (
            <li key={b} style={styles.benefitItem}>{b}</li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="ft-email" style={styles.label}>
            Work email
          </label>
          <input
            id="ft-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={handleEmailChange}
            style={inputStyle}
            aria-describedby={emailError ? 'ft-email-error' : undefined}
            aria-invalid={!!emailError}
          />
          {emailError && (
            <span id="ft-email-error" role="alert" style={styles.fieldError}>
              {emailError}
            </span>
          )}

          {submitError && (
            <p role="alert" style={styles.submitError}>{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim()}
            style={btnStyle}
          >
            {submitting ? 'Sending magic link…' : 'Get instant access →'}
          </button>
        </form>

        <p style={styles.loginLink}>
          Already have an account?{' '}
          <a href="/login" style={styles.loginAnchor}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
