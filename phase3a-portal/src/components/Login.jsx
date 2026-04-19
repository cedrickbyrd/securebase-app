import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { loginDemo } from '../services/jwtService';
import BRANDING from '../config/branding';
import { trackPageView, trackDemoLogin, incrementPagesViewed } from '../utils/analytics';
import './Login.css';

const DEMO_EMAIL = 'demo@securebase.tximhotep.com';
const DEMO_PASSWORD = 'SecureBaseDemo2026!';
const DEMO_CUSTOMER_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_NAME = 'Acme Corporation';
const DEMO_SOCIAL_PROOF_COUNT = 147;

function Login({ setAuth }) {
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const navigate = useNavigate();

  const isDemo = window.location.hostname.startsWith('demo.');
  // Show landing page first for demo visitors; they can switch to manual login
  const [showDemoLanding, setShowDemoLanding] = useState(isDemo);

  const authenticateDemoUser = async () => {
    try {
      // Request the HttpOnly JWT cookie from the server.  The token is never
      // exposed to JavaScript — the browser stores it automatically.
      await loginDemo(DEMO_EMAIL, DEMO_PASSWORD);
    } catch (err) {
      // loginDemo throws "Demo login failed (HTTP N): ..." for HTTP-level errors
      // (4xx/5xx from the server).  These require operator action and must be
      // surfaced to the visitor — silently bypassing them leaves the user on a
      // broken dashboard with no JWT cookie.
      //
      // Pure network/fetch failures (e.g. local dev without Netlify functions)
      // have a different error shape; those are non-blocking so dev iteration
      // still works without a running function server.
      const isServerError = err?.isServerError === true;
      if (isServerError) {
        setError(
          'Demo access unavailable. Try our live environment or contact sales@securebase.tximhotep.com',
        );
        setShowDemoLanding(false); // switch to form view so the error message is visible
        return;
      }
      // Network error — soft fail, keep local-dev experience working
      console.warn('[Login] Demo JWT cookie request failed (non-blocking):', err?.message);
    }
    setAuth(true);
    trackDemoLogin();
    // Store only non-sensitive demo context (no tokens/credentials)
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('demo_user', JSON.stringify({
      email: DEMO_EMAIL,
      customerId: DEMO_CUSTOMER_ID,
      orgName: DEMO_ORG_NAME,
    }));
    navigate('/dashboard');
  };

  useEffect(() => {
    trackPageView('Login', '/login');
    incrementPagesViewed();
  }, []);

  useEffect(() => {
    if (isDemo) {
      setEmail(DEMO_EMAIL);
    }
  }, [isDemo]);

  // Auto-bypass auth when ?demo=true URL param is present
  useEffect(() => {
    const demoParam = new URLSearchParams(window.location.search).get('demo') === 'true';
    if (demoParam) {
      authenticateDemoUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Special handling for demo environment
      if (isDemo && 
          email === DEMO_EMAIL && 
          password === DEMO_PASSWORD) {
        authenticateDemoUser();
        return;
      }

      // Regular authentication for non-demo
      const response = await apiService.authenticate(email, password);
      if (response.mfa_required) {
        setStep('mfa');
      } else if (response.token) {
        trackDemoLogin();
        setAuth(true);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMFA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiService.authenticate(email, password, totpCode);
      if (response.token) {
        trackDemoLogin();
        setAuth(true);
        navigate('/dashboard');
      } else {
        setError('Invalid TOTP code. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'MFA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    if (field === 'email') setEmail(text);
    if (field === 'password') setPassword(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEnterDemo = () => {
    authenticateDemoUser();
  };

  // Demo landing page shown to first-time demo visitors
  if (showDemoLanding) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '520px',
          animation: 'slideUp 0.4s ease-out',
        }}>
          {/* Header / Value Proposition */}
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2.5rem',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            marginBottom: '1rem',
          }}>
            {/* Logo + Badge */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="8" fill="#0066CC"/>
                  <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="white"/>
                </svg>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1a202c' }}>
                  SecureBase
                </span>
              </div>
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '20px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                ✓ No Signup Required &nbsp;•&nbsp; Instant Access
              </div>
            </div>

            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h1 style={{
                fontSize: '1.9rem',
                fontWeight: '800',
                color: '#1a202c',
                margin: '0 0 0.6rem 0',
                lineHeight: '1.2',
              }}>
                🛡️ See Your AWS Compliance Score<br />in 60 Seconds
              </h1>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>
                Interactive demo with real SOC 2 &amp; HIPAA data — no account needed
              </p>
            </div>

            {/* Primary CTA — placed above credentials for maximum visibility */}
            <div style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
              <span style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                border: '1px solid #f59e0b',
                color: '#92400e',
                fontSize: '12px',
                fontWeight: '700',
                padding: '4px 14px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                ⚡ Free demo — no account or setup required
              </span>
            </div>
            <button
              type="button"
              onClick={handleEnterDemo}
              className="demo-cta-button"
              style={{
                width: '100%',
                padding: '1.1rem 1.5rem',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '20px',
                fontWeight: '700',
                cursor: 'pointer',
                letterSpacing: '0.3px',
                marginBottom: '1.25rem',
                animation: 'pulse 2s infinite',
              }}
              onMouseOver={(e) => { e.currentTarget.style.animationPlayState = 'paused'; e.currentTarget.style.opacity = '0.92'; }}
              onMouseOut={(e) => { e.currentTarget.style.animationPlayState = 'running'; e.currentTarget.style.opacity = '1'; }}
            >
              🚀 Enter Demo (One Click)
            </button>

            {/* Feature bullets */}
            <div style={{
              background: '#f8f9ff',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1rem',
            }}>
              {[
                ['✓', 'Full compliance dashboard preview', '#10b981'],
                ['✓', '75% SOC 2 compliance score with 20+ controls', '#10b981'],
                ['✓', 'Real-time security findings & remediation steps', '#10b981'],
                ['✓', 'No signup required — explore freely', '#10b981'],
              ].map(([icon, text, color]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                  <span style={{ color, fontWeight: '700', fontSize: '1rem' }}>{icon}</span>
                  <span style={{ fontSize: '0.9rem', color: '#374151' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Social Proof */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '1.5rem',
              padding: '10px 14px',
              background: '#f0fdf4',
              borderRadius: '10px',
              border: '1px solid #d1fae5',
            }}>
              <span style={{ fontSize: '16px' }}>👥</span>
              <span style={{ fontSize: '13px', color: '#065f46', fontWeight: '600' }}>
                {DEMO_SOCIAL_PROOF_COUNT} DevOps teams are already using SecureBase
              </span>
            </div>

            {/* Demo Credentials */}
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C7 0%, #DBEAFE 100%)',
              border: '2px solid #FBBF24',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🔑 Demo Credentials
              </p>

              {/* Email row */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                  📧 Email
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <code style={{
                    flex: 1,
                    background: 'white',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '12.5px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    color: '#1f2937',
                    userSelect: 'all',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {DEMO_EMAIL}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(DEMO_EMAIL, 'email')}
                    style={{
                      padding: '9px 16px',
                      background: copiedField === 'email' ? '#10b981' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s',
                    }}
                  >
                    {copiedField === 'email' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Password row */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                  🔐 Password
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <code style={{
                    flex: 1,
                    background: 'white',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '12.5px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    color: '#1f2937',
                    userSelect: 'all',
                  }}>
                    {DEMO_PASSWORD}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(DEMO_PASSWORD, 'password')}
                    style={{
                      padding: '9px 16px',
                      background: copiedField === 'password' ? '#10b981' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s',
                    }}
                  >
                    {copiedField === 'password' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowDemoLanding(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Sign in manually
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved.{' '}
            <a href="https://securebase.tximhotep.com/signup" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>
              Start Free Trial →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Demo Banner */}
      {isDemo && step === 'credentials' && (
        <div style={{
          maxWidth: '440px',
          margin: '0 auto 20px auto',
          padding: '0 20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #DBEAFE 100%)',
            border: '3px solid #FBBF24',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)',
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
              }}>
                🎯
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  color: '#1F2937'
                }}>
                  Demo Environment
                </h3>
                <p style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '14px', 
                  color: '#6B7280'
                }}>
                  Use these credentials to explore SecureBase
                </p>
                
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '2px solid #E5E7EB',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '11px', 
                      fontWeight: '700',
                      color: '#374151',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      📧 Email Address
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <code style={{
                        flex: 1,
                        background: '#F3F4F6',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D1D5DB',
                        fontSize: '13px',
                        fontFamily: 'Monaco, Consolas, monospace',
                        color: '#1F2937',
                        userSelect: 'all',
                        fontWeight: '500'
                      }}>
                        {DEMO_EMAIL}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(DEMO_EMAIL, 'email')}
                        style={{
                          padding: '10px 18px',
                          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '11px', 
                      fontWeight: '700',
                      color: '#374151',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      🔐 Password
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <code style={{
                        flex: 1,
                        background: '#F3F4F6',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #D1D5DB',
                        fontSize: '13px',
                        fontFamily: 'Monaco, Consolas, monospace',
                        color: '#1F2937',
                        userSelect: 'all',
                        fontWeight: '500'
                      }}>
                        {DEMO_PASSWORD}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(DEMO_PASSWORD, 'password')}
                        style={{
                          padding: '10px 18px',
                          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <p style={{ 
                  margin: '14px 0 0 0', 
                  fontSize: '12px', 
                  color: '#6B7280',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  💡 Click "Copy" to auto-fill the login form below
                </p>
              </div>
            </div>
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
            <p className="subtitle">{isDemo ? '🎯 Demo Environment' : 'Customer Portal'}</p>
          </div>

          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="login-form">
              <h2>Sign In</h2>
              {isDemo && (
                <button
                  type="button"
                  onClick={handleEnterDemo}
                  className="demo-cta-button"
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '20px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    letterSpacing: '0.3px',
                    marginBottom: '1.25rem',
                    animation: 'pulse 2s infinite',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.animationPlayState = 'paused'; e.currentTarget.style.opacity = '0.92'; }}
                  onMouseOut={(e) => { e.currentTarget.style.animationPlayState = 'running'; e.currentTarget.style.opacity = '1'; }}
                >
                  🚀 Enter Demo (One Click)
                </button>
              )}
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={loading}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                />
              </div>
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {step === 'mfa' && (
            <form onSubmit={handleMFA} className="login-form">
              <h2>Two-Factor Authentication</h2>
              <p className="mfa-instructions">
                Enter the 6-digit code from your authenticator app.
              </p>
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="totpCode">Authenticator Code</label>
                <input
                  id="totpCode"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="login-button" disabled={loading || totpCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                className="back-button"
                onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
              >
                ← Back
              </button>
            </form>
          )}

          {step === 'credentials' && (
            <div className="login-footer" style={{ marginBottom: '0.25rem' }}>
              New customer?{' '}
              <a href="/pricing" style={{ fontWeight: '700', color: '#667eea' }}>
                View Pricing →
              </a>
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
