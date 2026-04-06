/**
 * LeadCaptureForm
 *
 * Reusable progressive-profiling lead capture form.
 * Fields shown depend on what's already been captured in localStorage:
 *   - First visit: email (required) + company (optional)
 *   - Return visits: email pre-filled; role dropdown shown if missing
 *
 * Props:
 *   trigger   {string}   Context: 'exit_intent' | 'api_sandbox' | 'assessment' | 'wave3_invoice'
 *   onSuccess {Function} Called with the enriched lead object after submission.
 *   onDismiss {Function} Called when the user dismisses/cancels.
 *   compact   {boolean}  Render in compact (inline) mode without description copy.
 */

import React, { useState } from 'react';
import { CheckCircle, Loader } from 'lucide-react';
import { submitLead, getStoredLead } from '../services/crmService';
import { trackLeadCapture } from '../utils/analytics';

// Copy map: trigger → {heading, body, submitLabel}
const COPY = {
  exit_intent: {
    heading: 'Get our "SOC 2 in 90 Days" guide',
    body: 'We\'ll send you our step-by-step implementation guide — used by 50+ regulated companies.',
    submitLabel: 'Send Me the Guide →',
  },
  api_sandbox: {
    heading: 'Try SecureBase API in 60 seconds',
    body: 'Get instant sandbox access with a test API key delivered to your inbox.',
    submitLabel: 'Get Sandbox API Key →',
  },
  assessment: {
    heading: 'Get your Audit Readiness Score',
    body: 'We\'ll analyse your infrastructure profile and send a personalised compliance readiness report.',
    submitLabel: 'Get My Score →',
  },
  wave3_invoice: {
    heading: 'See custom pricing for your company',
    body: 'Let\'s discuss volume discounts and enterprise features tailored to your stack.',
    submitLabel: 'See Custom Pricing →',
  },
};

const DEFAULT_COPY = {
  heading: 'Stay in the loop',
  body: 'Get updates about SecureBase features and compliance insights.',
  submitLabel: 'Continue →',
};

export default function LeadCaptureForm({ trigger = 'default', onSuccess, onDismiss, compact = false }) {
  const stored = getStoredLead();

  const [email, setEmail] = useState(stored?.email || '');
  const [company, setCompany] = useState(stored?.company || '');
  const [role, setRole] = useState(stored?.role || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState(null);

  // Basic email format validation
  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailReadOnly = !!stored?.email;

  const copy = COPY[trigger] || DEFAULT_COPY;

  // Progressive profiling: show company if not already stored
  const showCompany = !stored?.company;
  // Show role on return visits (email already captured) but role not yet known
  const showRole = !!stored?.email && !stored?.role;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Please enter a valid work email address.');
      setSubmitting(false);
      return;
    }
    setEmailError(null);

    try {
      const lead = await submitLead({
        email: email.trim(),
        company: company.trim() || undefined,
        role: role || undefined,
        trigger,
      });

      trackLeadCapture(trigger);
      setSubmitted(true);
      onSuccess?.(lead);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.warn('[LeadCaptureForm] submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-semibold text-gray-900">You're all set!</p>
        <p className="text-sm text-gray-500">Check your inbox — we'll be in touch shortly.</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-gray-400 hover:text-gray-600 transition mt-1"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {!compact && (
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 text-lg leading-snug">{copy.heading}</h3>
          <p className="text-sm text-gray-500 mt-1">{copy.body}</p>
        </div>
      )}

      <div className="space-y-3">
        <input
          type="email"
          required
          placeholder="work@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
            isEmailReadOnly
              ? 'bg-gray-100 cursor-not-allowed text-gray-500 border-gray-200'
              : emailError
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300'
          }`}
          autoComplete="email"
          readOnly={isEmailReadOnly}
          aria-label={isEmailReadOnly ? 'Email address (pre-filled)' : 'Email address'}
        />
        {emailError && <p className="text-xs text-red-600 -mt-1">{emailError}</p>}

        {showCompany && (
          <input
            type="text"
            placeholder="Company name (optional)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            autoComplete="organization"
          />
        )}

        {showRole && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            <option value="">What's your role? (optional)</option>
            <option value="ceo">CEO / Founder</option>
            <option value="cto">CTO / VP Engineering</option>
            <option value="security">Security / Compliance Officer</option>
            <option value="engineer">Software Engineer</option>
            <option value="other">Other</option>
          </select>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Sending…
            </>
          ) : (
            copy.submitLabel
          )}
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1"
          >
            No thanks
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}
