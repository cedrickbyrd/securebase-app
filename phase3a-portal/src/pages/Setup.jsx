import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Loader, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

/**
 * Post-payment account creation page.
 * Stripe redirects here with ?session_id=cs_... after a successful purchase.
 * Steps:
 *   1. Validate the session via /api/validate-session
 *   2. Show "Set Password" + "Org Name" form once valid
 *   3. On submit, call /api/signup to provision the customer
 */
export default function Setup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id') || '';

  // Session validation state
  const [validating, setValidating] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tier, setTier] = useState('');

  // Form state
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const hasValidated = useRef(false);

  // ── 1. Validate Stripe session ────────────────────────────────────────────
  useEffect(() => {
    if (hasValidated.current) return;
    hasValidated.current = true;

    if (!sessionId || !sessionId.startsWith('cs_')) {
      setSessionError('Invalid or missing session ID. If you completed a purchase, please check your email.');
      setValidating(false);
      return;
    }

    fetch(`/api/validate-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setSessionValid(true);
          setCustomerEmail(data.customer_email || '');
          setTier(data.tier || '');
          trackEvent('setup_session_validated', { tier: data.tier, sku: 'pilot_compliance' });
        } else {
          setSessionError(data.error || 'Payment verification failed. Please contact support.');
        }
      })
      .catch(() => {
        setSessionError('Unable to verify your payment. Please try again or contact support.');
      })
      .finally(() => setValidating(false));
  }, [sessionId]);

  // ── 2. Form validation helper ─────────────────────────────────────────────
  function validateForm() {
    if (!orgName.trim() || orgName.trim().length < 2) return 'Organisation name must be at least 2 characters.';
    if (orgName.trim().length > 100) return 'Organisation name must be under 100 characters.';
    if (password.length < 12) return 'Password must be at least 12 characters.';
    if (password !== passwordConfirm) return 'Passwords do not match.';
    return null;
  }

  // ── 3. Handle form submission ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password,
          org_name: orgName.trim(),
          tier: tier || 'pilot_compliance',
          session_id: sessionId,
          source: 'pilot_setup',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status} — please contact support.`);
      }

      trackEvent('pilot_account_created', { tier: tier || 'pilot_compliance', sku: 'pilot_compliance' });
      setDone(true);
    } catch (err) {
      console.error('Setup submission error:', err);
      setSubmitError(err.message || 'Something went wrong. Please contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render: success ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-gradient-to-br from-[#667eea] to-[#764ba2]">
        <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-2xl p-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-3">You&apos;re all set!</h1>
          <p className="text-blue-100 mb-6">
            Your SecureBase Compliance Jumpstart account is being provisioned. Check your inbox at{' '}
            <strong className="text-white">{customerEmail}</strong> for the download link and login instructions.
          </p>
          <p className="text-blue-200 text-sm mb-6">
            <strong className="text-white">Reminder:</strong> This pilot provides infrastructure code and a compliance
            mapping. Audit representation is available as an enterprise upgrade.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-white text-[#667eea] font-bold py-3 rounded-xl hover:bg-blue-50 transition"
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  // ── Render: loading / error / form ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-2 rounded-lg shadow-md">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold">SecureBase</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Compliance Jumpstart Setup</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Validating */}
          {validating && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
              <Loader className="animate-spin w-8 h-8 text-[#667eea] mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Verifying your payment…</p>
              <p className="text-slate-400 text-sm mt-1">This only takes a moment.</p>
            </div>
          )}

          {/* Session error */}
          {!validating && !sessionValid && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Payment not confirmed</h2>
              <p className="text-slate-500 text-sm mb-6">{sessionError}</p>
              <a
                href="mailto:support@securebase.tximhotep.com"
                className="inline-block px-6 py-2.5 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
              >
                Contact Support
              </a>
            </div>
          )}

          {/* Account setup form */}
          {!validating && sessionValid && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-sm text-slate-600">
                  Payment confirmed for <strong>{customerEmail}</strong>
                </p>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-1">Set up your account</h1>
              <p className="text-slate-500 text-sm mb-6">
                Choose an organisation name and password to complete your Compliance Jumpstart setup.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Org Name */}
                <div>
                  <label
                    htmlFor="setup-org"
                    className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                  >
                    Organisation Name
                  </label>
                  <input
                    id="setup-org"
                    type="text"
                    placeholder="Acme Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="setup-password"
                    className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                  >
                    Password <span className="text-slate-300">(min 12 characters)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                      className="w-full p-3 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="setup-password-confirm"
                    className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 ml-1"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="setup-password-confirm"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#667eea] outline-none transition-all text-slate-900"
                  />
                </div>

                {submitError && (
                  <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-100 p-3 rounded-lg">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin w-5 h-5" />
                      Provisioning your environment…
                    </>
                  ) : (
                    'Complete Setup →'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
