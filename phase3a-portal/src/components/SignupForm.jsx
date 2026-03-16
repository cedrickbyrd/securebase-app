import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import './SignupForm.css';

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
  // Step 1 – Account
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  // Step 2 – Organization
  companyName: '',
  companySize: '',
  industry: '',
  phone: '',
  // Step 3 – Configuration
  tier: 'fintech',
  region: 'us-east-1',
  mfaRequired: true,
  // Step 4 – shown after submit
};

function StepIndicator({ currentStep }) {
  return (
    <div className="signup-steps">
      {STEPS.map((label, idx) => (
        <React.Fragment key={label}>
          <div className={`signup-step ${idx < currentStep ? 'completed' : ''} ${idx === currentStep ? 'active' : ''}`}>
            <div className="step-circle">
              {idx < currentStep ? <span className="step-check">✓</span> : <span>{idx + 1}</span>}
            </div>
            <span className="step-label">{label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`step-connector ${idx < currentStep ? 'completed' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Step1({ form, onChange, errors }) {
  return (
    <div className="signup-step-content">
      <h2 className="step-title">Create your account</h2>
      <p className="step-subtitle">Enter your personal details to get started.</p>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={form.firstName}
            onChange={onChange}
            placeholder="Jane"
            className={errors.firstName ? 'input-error' : ''}
          />
          {errors.firstName && <span className="field-error">{errors.firstName}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={form.lastName}
            onChange={onChange}
            placeholder="Smith"
            className={errors.lastName ? 'input-error' : ''}
          />
          {errors.lastName && <span className="field-error">{errors.lastName}</span>}
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="email">Work Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          placeholder="jane@company.com"
          className={errors.email ? 'input-error' : ''}
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={onChange}
          placeholder="Min. 12 characters"
          className={errors.password ? 'input-error' : ''}
        />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </div>
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={onChange}
          placeholder="Repeat password"
          className={errors.confirmPassword ? 'input-error' : ''}
        />
        {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
      </div>
    </div>
  );
}

function Step2({ form, onChange, errors }) {
  return (
    <div className="signup-step-content">
      <h2 className="step-title">Tell us about your organization</h2>
      <p className="step-subtitle">We'll tailor your environment to your industry.</p>
      <div className="form-group">
        <label htmlFor="companyName">Company Name</label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          value={form.companyName}
          onChange={onChange}
          placeholder="Acme Corp"
          className={errors.companyName ? 'input-error' : ''}
        />
        {errors.companyName && <span className="field-error">{errors.companyName}</span>}
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="industry">Industry</label>
          <select
            id="industry"
            name="industry"
            value={form.industry}
            onChange={onChange}
            className={errors.industry ? 'input-error' : ''}
          >
            <option value="">Select industry</option>
            <option value="financial_services">Financial Services</option>
            <option value="healthcare">Healthcare</option>
            <option value="government">Government</option>
            <option value="technology">Technology</option>
            <option value="retail">Retail</option>
            <option value="other">Other</option>
          </select>
          {errors.industry && <span className="field-error">{errors.industry}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="companySize">Company Size</label>
          <select
            id="companySize"
            name="companySize"
            value={form.companySize}
            onChange={onChange}
            className={errors.companySize ? 'input-error' : ''}
          >
            <option value="">Select size</option>
            <option value="1-10">1–10 employees</option>
            <option value="11-50">11–50 employees</option>
            <option value="51-200">51–200 employees</option>
            <option value="201-1000">201–1000 employees</option>
            <option value="1000+">1000+ employees</option>
          </select>
          {errors.companySize && <span className="field-error">{errors.companySize}</span>}
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="phone">Phone (optional)</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={onChange}
          placeholder="+1 (555) 000-0000"
        />
      </div>
    </div>
  );
}

function Step3({ form, onChange, errors }) {
  return (
    <div className="signup-step-content">
      <h2 className="step-title">Choose your compliance tier</h2>
      <p className="step-subtitle">Select the framework that matches your regulatory requirements.</p>
      <div className="tier-grid">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className={`tier-card ${form.tier === tier.id ? 'selected' : ''}`}
            onClick={() => onChange({ target: { name: 'tier', value: tier.id } })}
          >
            <div className="tier-header">
              <span className="tier-badge">{tier.framework}</span>
              <span className="tier-name">{tier.name}</span>
            </div>
            <p className="tier-desc">{tier.description}</p>
            <p className="tier-price">
              ${tier.price.toLocaleString()}<span>/mo</span>
            </p>
            <ul className="tier-features">
              {tier.features.map((f) => (
                <li key={f}><span className="feature-check">✓</span>{f}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div className="config-row">
        <div className="form-group">
          <label htmlFor="region">AWS Region</label>
          <select id="region" name="region" value={form.region} onChange={onChange}>
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">EU (Ireland)</option>
            <option value="eu-central-1">EU (Frankfurt)</option>
            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
          </select>
        </div>
        <div className="form-group toggle-group">
          <label>
            <input
              type="checkbox"
              name="mfaRequired"
              checked={form.mfaRequired}
              onChange={onChange}
            />
            <span>Enforce MFA for all users</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Step4Verify({ email }) {
  const navigate = useNavigate();
  return (
    <div className="signup-step-content verify-step">
      <div className="verify-icon">✉️</div>
      <h2 className="step-title">Check your email</h2>
      <p className="step-subtitle">
        We sent a verification link to <strong>{email}</strong>. Click the link to confirm your
        address and kick off your environment provisioning.
      </p>
      <p className="verify-note">
        Didn't receive it? Check your spam folder or{' '}
        <button type="button" className="link-btn" onClick={() => window.location.reload()}>
          resend the email
        </button>
        .
      </p>
      <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>
        Back to Login
      </button>
    </div>
  );
}

function validate(step, form) {
  const errs = {};
  if (step === 0) {
    if (!form.firstName.trim()) errs.firstName = 'First name is required.';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
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

export default function SignupForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleNext = () => {
    const errs = validate(step, form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
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
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await apiService.signup({
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
      });
      setSubmitted(true);
      setStep(3);
    } catch (err) {
      setSubmitError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <a href="/" className="signup-logo">SecureBase</a>
          <p className="signup-tagline">Enterprise AWS compliance, zero friction.</p>
        </div>

        <div className="signup-card">
          <StepIndicator currentStep={step} />

          <form onSubmit={handleSubmit} noValidate>
            {step === 0 && <Step1 form={form} onChange={handleChange} errors={errors} />}
            {step === 1 && <Step2 form={form} onChange={handleChange} errors={errors} />}
            {step === 2 && <Step3 form={form} onChange={handleChange} errors={errors} />}
            {step === 3 && submitted && <Step4Verify email={form.email} />}

            {submitError && <p className="submit-error">{submitError}</p>}

            {step < 3 && (
              <div className="form-actions">
                {step > 0 && (
                  <button type="button" className="btn-secondary" onClick={handleBack}>
                    Back
                  </button>
                )}
                {step < 2 && (
                  <button type="button" className="btn-primary" onClick={handleNext}>
                    Continue
                  </button>
                )}
                {step === 2 && (
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Creating account…' : 'Create Account'}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>

        <p className="signup-login-link">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
