import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader, CheckCircle } from 'lucide-react';
import { trackSignupStarted, trackSignupCompleted, trackTierSelected } from '../utils/analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const TIERS = [
  {
    id: 'standard',
    name: 'Standard',
    price: 2000,
    framework: 'CIS',
    description: 'CIS Foundations compliant AWS Landing Zone',
    features: ['CIS AWS Foundations', 'Security Hub', 'CloudTrail', '90-day retention', 'Email support'],
  },
  {
    id: 'fintech',
    name: 'Fintech',
    price: 8000,
    framework: 'SOC2',
    description: 'SOC2 + SOX ready for financial services',
    features: ['SOC2 Type II', 'SOX Section 404', 'GuardDuty', '1-year retention', 'Priority support'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    price: 15000,
    framework: 'HIPAA',
    description: 'HIPAA-compliant AWS infrastructure',
    features: ['HIPAA controls', 'Encrypted EBS', '7-year retention', 'Monthly reports', 'Dedicated SE'],
  },
  {
    id: 'government',
    name: 'Government',
    price: 25000,
    framework: 'FedRAMP',
    description: 'FedRAMP-aligned for government workloads',
    features: ['FedRAMP Moderate', 'Incident response SLA', 'Continuous monitoring', '24/7 support'],
  },
];

const STEPS = ['Account', 'Organization', 'Configuration', 'Verify'];

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  companySize: '',
  industry: '',
  phone: '',
  tier: 'fintech',
  region: 'us-east-1',
  mfaRequired: true,
};

// ---------------------------------------------------------------------------
// Wave 3 data (mirrored from FastTrackSignup.jsx)
// ---------------------------------------------------------------------------

const WAVE3_COMPANIES = {
  column: {
    name: 'Column',
    greeting: 'Welcome, Column! 🎯',
    tagline: 'Compliance infrastructure built for modern banking APIs.',
  },
  mercury: {
    name: 'Mercury',
    greeting: 'Welcome, Mercury! 🎯',
    tagline: 'Enterprise compliance for the next generation of business banking.',
  },
  lithic: {
    name: 'Lithic',
    greeting: 'Welcome, Lithic! 🎯',
    tagline: 'SOC 2 and PCI-ready infrastructure for card issuing platforms.',
  },
};

const DEFAULT_COMPANY = {
  name: null,
  greeting: 'Get Started with SecureBase',
  tagline: 'Enterprise AWS compliance in 48 hours.',
};

const WAVE3_BENEFITS = [
  '✅ Full compliance dashboard access',
  '✅ 14-day free trial',
  '✅ No credit card required',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect Wave 3 UTM campaign from the current URL.
 * Returns the target slug (e.g. 'column') for wave3_* campaigns, else null.
 */
function detectWave3Target() {
  const params = new URLSearchParams(window.location.search);
  const campaign = params.get('utm_campaign') || '';
  if (campaign.startsWith('wave3_')) {
    return campaign.slice(6) || null;
  }
  return null;
}

function validate(step, form) {
  const errs = {};
  if (step === 0) {
    if (!form.firstName.trim()) errs.firstName = 'First name is required.';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!form.email.trim() || !EMAIL_RE.test(form.email))
      errs.email = 'Enter a valid email address.';
    if (form.password.length < 12) errs.password = 'Password must be at least 12 characters.';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
  }
  if (step === 1) {
    if (!form.companyName.trim()) errs.companyName = 'Company name is required.';
    if (!form.industry) errs.industry = 'Please select an industry.';
    if (!form.companySize) errs.companySize = 'Please select a company size.';
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Sub-components: Standard 4-step form
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((label, idx) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${idx < currentStep ? 'bg-[#667eea] text-white' : ''}
                ${idx === currentStep ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white ring-4 ring-purple-100' : ''}
                ${idx > currentStep ? 'bg-slate-100 text-slate-400' : ''}`}
            >
              {idx < currentStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={`text-[10px] uppercase tracking-widest font-bold
              ${idx === currentStep ? 'text-[#667eea]' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${idx < currentStep ? 'bg-[#667eea]' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-red-600 text-xs mt-1 font-medium">{msg}</p>;
}

function inputCls(hasError) {
  return `w-full p-3 border rounded-xl outline-none transition-all text-slate-900 text-sm
    focus:ring-2 focus:ring-[#667eea]
    ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`;
}

function Step1({ form, onChange, errors }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
        <p className="text-slate-500 text-sm mt-1">Enter your personal details to get started.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">First Name</label>
          <input id="firstName" name="firstName" type="text" value={form.firstName} onChange={onChange} placeholder="Jane" className={inputCls(errors.firstName)} />
          <FieldError msg={errors.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Last Name</label>
          <input id="lastName" name="lastName" type="text" value={form.lastName} onChange={onChange} placeholder="Smith" className={inputCls(errors.lastName)} />
          <FieldError msg={errors.lastName} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Work Email</label>
        <input id="email" name="email" type="email" value={form.email} onChange={onChange} placeholder="jane@company.com" className={inputCls(errors.email)} />
        <FieldError msg={errors.email} />
      </div>
      <div>
        <label htmlFor="password" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Password</label>
        <input id="password" name="password" type="password" value={form.password} onChange={onChange} placeholder="Min. 12 characters" className={inputCls(errors.password)} />
        <FieldError msg={errors.password} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Confirm Password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" value={form.confirmPassword} onChange={onChange} placeholder="Repeat password" className={inputCls(errors.confirmPassword)} />
        <FieldError msg={errors.confirmPassword} />
      </div>
    </div>
  );
}

function Step2({ form, onChange, errors }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tell us about your organization</h2>
        <p className="text-slate-500 text-sm mt-1">We'll tailor your environment to your industry.</p>
      </div>
      <div>
        <label htmlFor="companyName" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Company Name</label>
        <input id="companyName" name="companyName" type="text" value={form.companyName} onChange={onChange} placeholder="Acme Corp" className={inputCls(errors.companyName)} />
        <FieldError msg={errors.companyName} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="industry" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Industry</label>
          <select id="industry" name="industry" value={form.industry} onChange={onChange} className={inputCls(errors.industry)}>
            <option value="">Select industry</option>
            <option value="financial_services">Financial Services</option>
            <option value="healthcare">Healthcare</option>
            <option value="government">Government</option>
            <option value="technology">Technology</option>
            <option value="retail">Retail</option>
            <option value="other">Other</option>
          </select>
          <FieldError msg={errors.industry} />
        </div>
        <div>
          <label htmlFor="companySize" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Company Size</label>
          <select id="companySize" name="companySize" value={form.companySize} onChange={onChange} className={inputCls(errors.companySize)}>
            <option value="">Select size</option>
            <option value="1-10">1–10 employees</option>
            <option value="11-50">11–50 employees</option>
            <option value="51-200">51–200 employees</option>
            <option value="201-1000">201–1000 employees</option>
            <option value="1000+">1000+ employees</option>
          </select>
          <FieldError msg={errors.companySize} />
        </div>
      </div>
      <div>
        <label htmlFor="phone" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" value={form.phone} onChange={onChange} placeholder="+1 (555) 000-0000" className={inputCls(false)} />
      </div>
    </div>
  );
}

function Step3({ form, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Choose your compliance tier</h2>
        <p className="text-slate-500 text-sm mt-1">Select the framework that matches your regulatory requirements.</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => onChange({ target: { name: 'tier', value: tier.id } })}
            className={`text-left p-4 border-2 rounded-xl transition-all
              ${form.tier === tier.id
                ? 'border-[#667eea] bg-purple-50 ring-2 ring-purple-100'
                : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded
                ${form.tier === tier.id ? 'bg-[#667eea] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tier.framework}
              </span>
              <span className="font-bold text-slate-900 text-sm">
                ${tier.price.toLocaleString()}<span className="text-slate-400 font-normal">/mo</span>
              </span>
            </div>
            <p className="font-semibold text-slate-900 text-sm">{tier.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{tier.description}</p>
            <ul className="mt-2 space-y-0.5">
              {tier.features.map((f) => (
                <li key={f} className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-green-500">✓</span>{f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div>
          <label htmlFor="region" className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">AWS Region</label>
          <select id="region" name="region" value={form.region} onChange={onChange} className={inputCls(false)}>
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">EU (Ireland)</option>
            <option value="eu-central-1">EU (Frankfurt)</option>
            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
          </select>
        </div>
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="mfaRequired"
              checked={form.mfaRequired}
              onChange={onChange}
              className="w-4 h-4 accent-[#667eea]"
            />
            <span className="text-xs text-slate-600 font-medium">Enforce MFA for all users</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Step4Verify({ email }) {
  return (
    <div className="text-center py-4 space-y-3">
      <div className="text-5xl">✉️</div>
      <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
      <p className="text-slate-500 text-sm">
        We sent a verification link to <strong>{email}</strong>. Click the link to confirm your
        address and kick off your environment provisioning.
      </p>
      <p className="text-slate-400 text-xs">
        Didn't receive it? Check your spam folder or{' '}
        <button type="button" className="text-[#667eea] font-semibold hover:underline" onClick={() => window.location.reload()}>
          resend the email
        </button>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Wave 3 fast-track single-field form
// ---------------------------------------------------------------------------

function FastTrackForm({ wave3Target }) {
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
    if (!trimmed) { setEmailError('Email is required.'); return; }
    if (!EMAIL_RE.test(trimmed)) { setEmailError('Please enter a valid work email address.'); return; }

    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Submit lead for CRM tracking
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

      // 2. Request magic link via backend API (best-effort)
      try {
        await fetch(`${API_BASE}/api/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, magic_link: true }),
        });
      } catch (magicLinkErr) {
        console.warn('[FastTrackForm] Magic link request failed (non-fatal):',
          magicLinkErr instanceof Error ? magicLinkErr.message : 'Unknown error');
      }

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'lead_captured', {
          method: 'fast_track',
          campaign: wave3Target ? `wave3_${wave3Target}` : '',
        });
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError('Something went wrong. Please try again.');
      console.warn('[FastTrackForm] submission error:',
        err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">
          <a href="/" className="text-[#667eea] font-extrabold text-xl tracking-tight block mb-6">SecureBase</a>
          <div className="text-5xl mb-4">✉️</div>
          <p className="text-xl font-bold text-slate-900 mb-2">Check your inbox!</p>
          <p className="text-slate-500 text-sm">
            We sent a magic link to <strong>{email}</strong>. Click it to access your
            compliance dashboard instantly — no password needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <a href="/" className="text-[#667eea] font-extrabold text-xl tracking-tight block mb-6">SecureBase</a>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">{company.greeting}</h1>
        <p className="text-slate-500 text-sm mb-6">{company.tagline}</p>

        <ul className="space-y-1 mb-7">
          {WAVE3_BENEFITS.map((b) => (
            <li key={b} className="text-sm text-slate-700">{b}</li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="ft-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
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
            aria-describedby={emailError ? 'ft-email-error' : undefined}
            aria-invalid={!!emailError}
            className={`w-full px-4 py-3 border-[1.5px] rounded-lg text-sm outline-none transition-colors
              focus:border-[#667eea]
              ${emailError ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
          />
          {emailError && (
            <span id="ft-email-error" role="alert" className="block text-xs text-red-600 mt-1">
              {emailError}
            </span>
          )}

          {submitError && (
            <p role="alert" className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="w-full mt-4 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-bold rounded-lg transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending magic link…' : 'Get instant access →'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#667eea] font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Signup() {
  const navigate = useNavigate();

  // Detect Wave 3 once (URL takes precedence).
  const wave3Target = detectWave3Target();

  // Fast-track path: Wave 3 visitors see the single-field email form.
  if (wave3Target) {
    return <FastTrackForm wave3Target={wave3Target} />;
  }

  // Standard path: 4-step form.
  return <StandardSignupForm navigate={navigate} />;
}

// ---------------------------------------------------------------------------
// Standard 4-step signup form
// ---------------------------------------------------------------------------

function StandardSignupForm({ navigate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    trackSignupStarted('email');
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (name === 'tier') {
      const selectedTier = TIERS.find((t) => t.id === value);
      trackTierSelected(value, selectedTier?.price ?? 0);
    }
  };

  const handleNext = () => {
    const errs = validate(step, form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(step, form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          password: form.password,
          company_name: form.companyName,
          company_size: form.companySize,
          industry: form.industry,
          phone: form.phone,
          tier: form.tier,
          region: form.region,
          mfa_required: form.mfaRequired,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Signup failed (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));

      trackSignupCompleted(form.tier);

      if (data.jobId) {
        navigate(`/onboarding?jobId=${data.jobId}&email=${encodeURIComponent(form.email)}`);
      } else {
        setSubmitted(true);
        setStep(3);
      }
    } catch (err) {
      setSubmitError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
              <Shield className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">SecureBase</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                TxImhotep LLC
              </div>
            </div>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-4">

          {/* Scarcity banner — always visible */}
          <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl px-5 py-3 text-white text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" aria-hidden="true" />
            <span><strong>LIVE:</strong> 8 of 10 pilot spots remaining at founder pricing ($2,000/mo)</span>
          </div>

          {/* Sign-up card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <StepIndicator currentStep={step} />

            <form onSubmit={handleSubmit} noValidate>
              {step === 0 && <Step1 form={form} onChange={handleChange} errors={errors} />}
              {step === 1 && <Step2 form={form} onChange={handleChange} errors={errors} />}
              {step === 2 && <Step3 form={form} onChange={handleChange} errors={errors} />}
              {step === 3 && submitted && <Step4Verify email={form.email} />}

              {submitError && (
                <p className="mt-4 text-red-600 text-sm font-semibold bg-red-50 border border-red-100 p-3 rounded-lg">
                  {submitError}
                </p>
              )}

              {step < 3 && (
                <div className="flex gap-3 mt-6">
                  {step > 0 && (
                    <button type="button" onClick={handleBack}
                      className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">
                      Back
                    </button>
                  )}
                  {step < 2 && (
                    <button type="button" onClick={handleNext}
                      className="flex-1 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold hover:shadow-lg transition-all">
                      Continue
                    </button>
                  )}
                  {step === 2 && (
                    <button type="submit" disabled={submitting}
                      className="flex-1 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {submitting ? <><Loader className="animate-spin w-4 h-4" />Creating account…</> : 'Create Account'}
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Already have an account */}
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <a href="/login" className="text-[#667eea] font-semibold hover:underline">Sign in</a>
          </p>
        </div>
      </main>
    </div>
  );
}
