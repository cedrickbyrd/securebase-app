/**
 * LeadCaptureForm
 * A progressive-profiling form that asks for more information on each successive
 * visit. On the first visit it collects email (+ optional company); on the second
 * it adds role; on the third it offers a phone field.
 */

import React, { useState } from 'react';
import { submitLead, getLeadFromLocalStorage } from '../services/crmService';
import { extractCompanyFromEmail } from '../hooks/usePersonalization';
import { trackCTAClick, trackWave3HighValueAction } from '../utils/analytics';

const ROLES = [
  { value: 'ceo',       label: 'CEO / Founder' },
  { value: 'cto',       label: 'CTO / VP Engineering' },
  { value: 'security',  label: 'Security / Compliance Officer' },
  { value: 'engineer',  label: 'Software Engineer' },
  { value: 'other',     label: 'Other' },
];

/**
 * @param {Object}   props
 * @param {string}   props.trigger      Context key used for the submit button label
 *                                       e.g. 'api_sandbox' | 'pricing' | 'assessment' | 'exit_intent'
 * @param {string}   [props.className]  Additional class names for the wrapper
 * @param {Function} [props.onSuccess]  Called with the enriched lead after submission
 */
export default function LeadCaptureForm({ trigger = 'default', className = '', onSuccess }) {
  const existingLead = getLeadFromLocalStorage();
  const visitCount   = (existingLead?.visitCount || 0);

  const [email,        setEmail]        = useState(existingLead?.email   || '');
  const [company,      setCompany]      = useState(existingLead?.company || '');
  const [role,         setRole]         = useState(existingLead?.role    || '');
  const [phone,        setPhone]        = useState(existingLead?.phone   || '');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [error,        setError]        = useState('');

  const showCompany  = !existingLead?.company;
  const showRole     = visitCount >= 1 && !existingLead?.role;
  const showPhone    = visitCount >= 2 && !existingLead?.phone;

  const ctaLabel = {
    api_sandbox:  'Get Sandbox API Key →',
    pricing:      'See Custom Pricing →',
    assessment:   'Get My Compliance Score →',
    exit_intent:  'Send Me the Guide →',
    demo:         'Book My Demo →',
  }[trigger] || 'Continue →';

  const handleEmailBlur = () => {
    if (email && !company) {
      const derived = extractCompanyFromEmail(email);
      if (derived) setCompany(derived);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid work email address.');
      return;
    }

    setSubmitting(true);
    try {
      const lead = await submitLead({
        email,
        ...(company && { company }),
        ...(role    && { role }),
        ...(phone   && { phone }),
        trigger,
      });

      trackCTAClick(trigger, 'lead_capture_form');
      if (lead.campaign?.startsWith('wave3_')) {
        trackWave3HighValueAction(`lead_captured_${trigger}`);
      }

      setSubmitted(true);
      if (onSuccess) onSuccess(lead);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`lcf-success ${className}`} style={styles.success}>
        <span style={styles.successIcon}>✅</span>
        <div>
          <p style={styles.successHeading}>You&apos;re all set!</p>
          <p style={styles.successSub}>Check your inbox — we&apos;ll be in touch shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`lcf-form ${className}`} style={styles.form} noValidate>
      {/* Email — always required */}
      <input
        type="email"
        placeholder="work@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={handleEmailBlur}
        required
        disabled={submitting}
        style={styles.input}
      />

      {/* Company — first visit or missing */}
      {showCompany && (
        <input
          type="text"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={submitting}
          style={styles.input}
        />
      )}

      {/* Role — second visit or missing */}
      {showRole && (
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={submitting}
          style={{ ...styles.input, ...styles.select }}
        >
          <option value="">What&apos;s your role? (optional)</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}

      {/* Phone — third visit or missing */}
      {showPhone && (
        <input
          type="tel"
          placeholder="Phone (optional — fast-tracks your trial)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
          style={styles.input}
        />
      )}

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={submitting} style={styles.button}>
        {submitting ? 'Submitting…' : ctaLabel}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (Tailwind classes are available but inline keeps this
// component self-contained and usable in both modal and inline contexts)
// ---------------------------------------------------------------------------

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  },
  select: {
    appearance: 'none',
    cursor: 'pointer',
  },
  button: {
    padding: '0.75rem 1.25rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.8rem',
    margin: 0,
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: '#f0fdf4',
    borderRadius: '0.5rem',
    border: '1px solid #bbf7d0',
  },
  successIcon: { fontSize: '1.5rem' },
  successHeading: { fontWeight: 700, margin: 0, color: '#065f46' },
  successSub: { margin: 0, fontSize: '0.85rem', color: '#047857' },
};
