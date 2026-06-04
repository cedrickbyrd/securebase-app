import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/AcceptInvite.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/**
 * AcceptInvite
 *
 * Public route: /accept-invite?token=<invite_token>
 *
 * Flow:
 *   1. Mount  → GET /auth/accept-invite?token=  (validate token, get masked email)
 *   2. Submit → POST /auth/accept-invite         (set password, receive JWT)
 *   3. Store JWT in sessionStorage (matches Login.jsx convention)
 *   4. Redirect to / (dashboard)
 *
 * No separate login step required.
 */
export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  // Validation state
  const [validating, setValidating]   = useState(true);
  const [tokenValid, setTokenValid]   = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [tokenError, setTokenError]   = useState('');

  // Form state
  const [password, setPassword]         = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [activated, setActivated]       = useState(false);

  // ── Step 1: validate token on mount ────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenError('No invite token found. Please use the link from your invitation email.');
      setValidating(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/auth/accept-invite?token=${encodeURIComponent(token)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        const data = await res.json();

        if (!res.ok) {
          setTokenError(data.error || 'This invite link is invalid or has expired.');
        } else {
          setTokenValid(true);
          setMaskedEmail(data.email || '');
        }
      } catch {
        setTokenError('Unable to reach SecureBase. Please check your connection and try again.');
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  // ── Step 2: activate account ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPw) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'Activation failed. Please try again.');
        return;
      }

      // Store session — matches Login.jsx convention
      sessionStorage.setItem('sessionToken', data.token);
      localStorage.setItem('userEmail', data.user?.email || '');
      localStorage.setItem('userRole', data.user?.role || 'user');

      setActivated(true);
      setTimeout(() => navigate('/'), 800);
    } catch {
      setSubmitError('Unable to reach SecureBase. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sb-AcceptInvite">
      <div className="sb-AcceptInvite__container">

        {/* Logo — matches Login.jsx */}
        <div className="sb-Login__logo">
          <div className="sb-Login__logoIcon">
            <svg className="sb-Login__logoSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="sb-Login__title">SecureBase</h1>
          <p className="sb-Login__subtitle">Activate Your Account</p>
        </div>

        <div className="sb-Login__card">

          {/* ── Loading ── */}
          {validating && (
            <div className="sb-AcceptInvite__loading">
              <div className="sb-AcceptInvite__spinner" />
              <p>Verifying your invite link…</p>
            </div>
          )}

          {/* ── Invalid token ── */}
          {!validating && !tokenValid && (
            <>
              <div className="sb-Alert sb-Alert--error">
                <p className="sb-Alert__title">Invalid Invite Link</p>
                <p className="sb-Alert__text">{tokenError}</p>
              </div>
              <p className="sb-AcceptInvite__help">
                Need a new invite?{' '}
                <a href="mailto:support@securebase.io" className="sb-AcceptInvite__link">
                  Contact support
                </a>
              </p>
            </>
          )}

          {/* ── Activated success ── */}
          {activated && (
            <div className="sb-Alert sb-Alert--success">
              <p className="sb-Alert__title">Account Activated</p>
              <p className="sb-Alert__text">Taking you to your dashboard…</p>
            </div>
          )}

          {/* ── Password form ── */}
          {!validating && tokenValid && !activated && (
            <>
              <h2 className="sb-Login__cardTitle">Set Your Password</h2>

              {maskedEmail && (
                <p className="sb-AcceptInvite__emailHint">
                  Setting up access for <strong>{maskedEmail}</strong>
                </p>
              )}

              {submitError && (
                <div className="sb-Alert sb-Alert--error">
                  <p className="sb-Alert__title">Activation Error</p>
                  <p className="sb-Alert__text">{submitError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="sb-Login__form">
                <div className="sb-FormGroup">
                  <label htmlFor="password" className="sb-FormGroup__label">
                    Password
                  </label>
                  <div className="sb-FormGroup__inputWrapper">
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="sb-FormGroup__input"
                      placeholder="Min. 8 characters"
                      required
                      disabled={submitting}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="sb-FormGroup__toggleBtn"
                      onClick={() => setShowPw(!showPw)}
                      disabled={submitting}
                    >
                      {showPw ? '👁️' : '👁️\u200D🗨️'}
                    </button>
                  </div>
                </div>

                <div className="sb-FormGroup">
                  <label htmlFor="confirmPw" className="sb-FormGroup__label">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPw"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="sb-FormGroup__input"
                    placeholder="Re-enter password"
                    required
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className="sb-Button sb-Button--primary sb-Button--large sb-Button--fullWidth"
                  disabled={submitting}
                >
                  {submitting ? 'Activating…' : 'Activate My Account →'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
