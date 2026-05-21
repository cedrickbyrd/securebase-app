import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { loginDemo } from '../services/jwtService';
import BRANDING from '../config/branding';
import { trackPageView, trackDemoLogin, incrementPagesViewed } from '../utils/analytics';
import { PORTAL_NARRATIVE } from '../content/portalNarrative';
import './Login.css';

const DEMO_EMAIL             = 'demo@securebase.tximhotep.com';
const DEMO_PASSWORD          = 'SecureBaseDemo2026!';
const DEMO_CUSTOMER_ID       = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_NAME          = 'Acme Corporation';
const DEMO_SOCIAL_PROOF_COUNT = 147;

function Login({ setAuth }) {
  const [step, setStep]           = useState('credentials');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [totpCode, setTotpCode]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [copiedField, setCopied]  = useState(null);
  const navigate = useNavigate();

  const isDemo           = window.location.hostname.startsWith('demo.');
  const [showDemoLanding, setShowDemoLanding] = useState(isDemo);

  const authenticateDemoUser = async () => {
    try {
      await loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      if (err?.isServerError) {
        setError('Demo access unavailable. Contact sales@securebase.tximhotep.com');
        setShowDemoLanding(false);
        return;
      }
      console.warn('[Login] Demo JWT cookie request failed (non-blocking):', err?.message);
    }
    setAuth(true);
    trackDemoLogin();
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('demo_user', JSON.stringify({ email: DEMO_EMAIL, customerId: DEMO_CUSTOMER_ID, orgName: DEMO_ORG_NAME }));
    navigate('/dashboard');
  };

  useEffect(() => { trackPageView('Login', '/login'); incrementPagesViewed(); }, []);
  useEffect(() => { if (isDemo) setEmail(DEMO_EMAIL); }, [isDemo]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') === 'true') authenticateDemoUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCredentials = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isDemo && email === DEMO_EMAIL && password === DEMO_PASSWORD) { authenticateDemoUser(); return; }
      const res = await apiService.authenticate(email, password);
      if (res.mfa_required) { setStep('mfa'); }
      else if (res.token)   { trackDemoLogin(); setAuth(true); navigate('/dashboard'); }
      else                  { setError('Invalid credentials'); }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  const handleMFA = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await apiService.authenticate(email, password, totpCode);
      if (res.token) { trackDemoLogin(); setAuth(true); navigate('/dashboard'); }
      else           { setError('Invalid TOTP code. Please try again.'); }
    } catch (err) {
      setError(err.message || 'MFA verification failed');
    } finally { setLoading(false); }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    if (field === 'email') setEmail(text);
    if (field === 'password') setPassword(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Demo landing ────────────────────────────────────────────────────────
  if (showDemoLanding) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '2.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: '8px' }}>
                <rect width="40" height="40" rx="8" fill="#0066CC"/>
                <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="white"/>
              </svg>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1a202c', margin: 0 }}>SecureBase</h1>
            </div>
            <h2 style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: '800', color: '#1a202c', marginBottom: '0.5rem' }}>🛡️ {PORTAL_NARRATIVE.platformTitle}</h2>
            <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem' }}>{PORTAL_NARRATIVE.demoPromise}</p>
            <button type="button" onClick={authenticateDemoUser} className="demo-cta-button"
              style={{ width: '100%', padding: '1.1rem', background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', fontWeight: '700', cursor: 'pointer', marginBottom: '1.25rem' }}>
              🚀 Enter Demo (One Click)
            </button>
            <div style={{ background: '#f8f9ff', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
              {[['✓','Full compliance dashboard preview'],['✓','75% SOC 2 compliance score with 20+ controls'],['✓','Real-time security findings & remediation'],['✓','No signup required — explore freely']].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                  <span style={{ color: '#10b981', fontWeight: '700' }}>{icon}</span>
                  <span style={{ fontSize: '0.9rem', color: '#374151' }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #d1fae5', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '13px', color: '#065f46', fontWeight: '600' }}>👥 {DEMO_SOCIAL_PROOF_COUNT} DevOps teams are already using SecureBase</span>
            </div>
            {/* Demo credentials */}
            <div style={{ background: 'linear-gradient(135deg,#FEF3C7,#DBEAFE)', border: '2px solid #FBBF24', borderRadius: '14px', padding: '1.25rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔑 Demo Credentials</p>
              {[['email', DEMO_EMAIL], ['password', DEMO_PASSWORD]].map(([field, val]) => (
                <div key={field} style={{ marginBottom: field === 'email' ? '10px' : 0 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>{field === 'email' ? '📧 Email' : '🔐 Password'}</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <code style={{ flex: 1, background: 'white', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12.5px', fontFamily: 'monospace', color: '#1f2937', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</code>
                    <button type="button" onClick={() => copyToClipboard(val, field)}
                      style={{ padding: '9px 16px', background: copiedField === field ? '#10b981' : 'linear-gradient(135deg,#3B82F6,#2563EB)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copiedField === field ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setShowDemoLanding(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Sign in manually
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved.{' '}
            <a href="https://securebase.tximhotep.com/pricing" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Start Free Trial →</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Standard login ──────────────────────────────────────────────────────
  return (
    <div className="login-page">
      {isDemo && step === 'credentials' && (
        <div style={{ maxWidth: '440px', margin: '0 auto 20px auto', padding: '0 20px' }}>
          <div style={{ background: 'linear-gradient(135deg,#FEF3C7,#DBEAFE)', border: '3px solid #FBBF24', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 'bold', color: '#1F2937' }}>🎯 Demo Environment</h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#6B7280' }}>Use these credentials to explore SecureBase</p>
            {[['email', DEMO_EMAIL], ['password', DEMO_PASSWORD]].map(([field, val]) => (
              <div key={field} style={{ marginBottom: field === 'email' ? '14px' : 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field === 'email' ? '📧 Email' : '🔐 Password'}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <code style={{ flex: 1, background: '#F3F4F6', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', fontFamily: 'monospace', color: '#1F2937', userSelect: 'all' }}>{val}</code>
                  <button type="button" onClick={() => copyToClipboard(val, field)}
                    style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Copy</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="#0066CC"/>
                <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="white"/>
              </svg>
            </div>
            <h1>{BRANDING.productName}</h1>
            <p className="subtitle">{isDemo ? `🎯 ${PORTAL_NARRATIVE.platformTitle}` : PORTAL_NARRATIVE.platformTagline}</p>
          </div>

          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="login-form">
              <h2>Sign In</h2>
              {isDemo && (
                <button type="button" onClick={authenticateDemoUser} className="demo-cta-button"
                  style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '20px', fontWeight: '700', cursor: 'pointer', marginBottom: '1.25rem' }}>
                  🚀 Enter Demo (One Click)
                </button>
              )}
              {error && <div className="error-message"><span className="error-icon">⚠️</span> {error}</div>}
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" disabled={loading} required />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" disabled={loading} required />
              </div>
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              {/* Forgot password link */}
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <Link to="/forgot-password" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>
                  Forgot your password?
                </Link>
              </div>
            </form>
          )}

          {step === 'mfa' && (
            <form onSubmit={handleMFA} className="login-form">
              <h2>Two-Factor Authentication</h2>
              <p className="mfa-instructions">Enter the 6-digit code from your authenticator app.</p>
              {error && <div className="error-message"><span className="error-icon">⚠️</span> {error}</div>}
              <div className="form-group">
                <label htmlFor="totpCode">Authenticator Code</label>
                <input id="totpCode" type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" maxLength={6} disabled={loading} autoFocus required />
              </div>
              <button type="submit" className="login-button" disabled={loading || totpCode.length !== 6}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button type="button" className="back-button" onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}>← Back</button>
            </form>
          )}

          {step === 'credentials' && (
            <div className="login-footer" style={{ marginBottom: '0.25rem' }}>
              New customer?{' '}
              <a href="/pricing" style={{ fontWeight: '700', color: '#667eea' }}>View Pricing →</a>
            </div>
          )}
          <div className="login-footer">
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved. •{' '}
            <a href={BRANDING.privacyPolicyUrl}>Privacy</a> •{' '}
            <a href={BRANDING.termsOfServiceUrl}>Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
