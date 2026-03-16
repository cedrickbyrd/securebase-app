import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

function Login({ setAuth }) {
  const [step, setStep] = useState('credentials'); // 'credentials' | 'mfa'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
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

  return (
    <div className="login-page">
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
            <p className="subtitle">Customer Portal</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
