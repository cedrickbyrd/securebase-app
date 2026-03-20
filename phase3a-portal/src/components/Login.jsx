import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

function Login({ setAuth }) {
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isDemo = window.location.hostname.startsWith('demo.');

  React.useEffect(() => {
    if (isDemo) {
      setEmail('demo@securebase.tximhotep.com');
    }
  }, [isDemo]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Special handling for demo environment
      if (isDemo && 
          email === 'demo@securebase.tximhotep.com' && 
          password === 'SecureBaseDemo2026!') {
        // For demo, set auth and navigate directly
        setAuth(true);
        // Store demo token
        localStorage.setItem('demo_mode', 'true');
        localStorage.setItem('demo_user', JSON.stringify({
          email: 'demo@securebase.tximhotep.com',
          customerId: 'a0000000-0000-0000-0000-000000000001',
          orgName: 'Acme Corporation'
        }));
        navigate('/dashboard');
        return;
      }

      // Regular authentication for non-demo
      const response = await apiService.authenticate(email, password);
      if (response.mfa_required) {
        setStep('mfa');
      } else if (response.token) {
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
  };

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
                        demo@securebase.tximhotep.com
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('demo@securebase.tximhotep.com', 'email')}
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
                        SecureBaseDemo2026!
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('SecureBaseDemo2026!', 'password')}
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

          <div className="login-footer">
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved. •{' '}
            <a href={BRANDING.privacyPolicyUrl}>Privacy</a> •{' '}
            <a href={BRANDING.termsOfServiceUrl}>Terms</a>
            {isDemo && (
              <>
                {' '}•{' '}
                <a href="https://securebase.tximhotep.com/signup" style={{ fontWeight: 'bold', color: '#2563EB' }}>
                  Start Your Free Trial →
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
