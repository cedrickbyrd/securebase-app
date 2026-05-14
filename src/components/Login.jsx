import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDemoMode } from '../services/demoApiService';
import { DEMO_CUSTOMER } from '../utils/demoData';
import '../styles/Login.css';

const DEMO_EMAIL = DEMO_CUSTOMER.email;
const DEMO_PASSWORD = DEMO_CUSTOMER.password;
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const isDemo = isDemoMode();

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {
      setCopiedField(`${field}-error`);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Demo mode bypass
      if (isDemo && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        localStorage.setItem('demo_mode', 'true');
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 500);
        return;
      }

      // Lambda auth endpoint
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(mfaRequired && totpCode ? { totp_code: totpCode } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Invalid credentials. Please try again.');

      if (data.mfa_required) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // Store session
      sessionStorage.setItem('sessionToken', data.token);
      localStorage.setItem('userEmail', data.user?.email || email);
      localStorage.setItem('userRole', data.user?.role || 'user');

      setSuccess(true);
      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sb-Login">
      <div className="sb-Login__container">
        {isDemo && (
          <div className="sb-Login__demoBanner">
            <div className="sb-Login__demoBannerTitle">🚀 Demo Credentials</div>
            <div className="sb-Login__demoBannerRow">
              <span className="sb-Login__demoBannerLabel">Email</span>
              <code className="sb-Login__demoBannerValue">{DEMO_EMAIL}</code>
              <button type="button" className="sb-Login__demoCopyBtn" onClick={() => copyToClipboard(DEMO_EMAIL, 'email')}>
                {copiedField === 'email' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="sb-Login__demoBannerRow">
              <span className="sb-Login__demoBannerLabel">Password</span>
              <code className="sb-Login__demoBannerValue">{DEMO_PASSWORD}</code>
              <button type="button" className="sb-Login__demoCopyBtn" onClick={() => copyToClipboard(DEMO_PASSWORD, 'password')}>
                {copiedField === 'password' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="sb-Login__logo">
          <div className="sb-Login__logoIcon">
            <svg className="sb-Login__logoSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="sb-Login__title">SecureBase</h1>
          <p className="sb-Login__subtitle">Control-First Compliance Portal</p>
        </div>

        <div className="sb-Login__card">
          <h2 className="sb-Login__cardTitle">Sign In</h2>

          {success && (
            <div className="sb-Alert sb-Alert--success">
              <p className="sb-Alert__text">Identity verified. Loading SecureBase...</p>
            </div>
          )}

          {error && (
            <div className="sb-Alert sb-Alert--error">
              <p className="sb-Alert__title">Access Denied</p>
              <p className="sb-Alert__text">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="sb-Login__form">
            <div className="sb-FormGroup">
              <label htmlFor="email" className="sb-FormGroup__label">Work Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="sb-FormGroup__input" placeholder="you@company.com"
                required disabled={loading || mfaRequired} />
            </div>

            <div className="sb-FormGroup">
              <label htmlFor="password" className="sb-FormGroup__label">Password</label>
              <div className="sb-FormGroup__inputWrapper">
                <input id="password" type={showKey ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} className="sb-FormGroup__input"
                  placeholder="••••••••" required disabled={loading || mfaRequired} />
                <button type="button" onClick={() => setShowKey(!showKey)}
                  className="sb-FormGroup__toggleBtn" disabled={loading}>
                  {showKey ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {mfaRequired && (
              <div className="sb-FormGroup">
                <label htmlFor="totp" className="sb-FormGroup__label">Authenticator Code</label>
                <input id="totp" type="text" value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="sb-FormGroup__input" placeholder="6-digit code"
                  maxLength={6} required disabled={loading} autoFocus />
              </div>
            )}

            <button type="submit" className="sb-Button sb-Button--primary sb-Button--large sb-Button--fullWidth" disabled={loading}>
              {loading ? 'Authenticating...' : mfaRequired ? 'Verify Code' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
