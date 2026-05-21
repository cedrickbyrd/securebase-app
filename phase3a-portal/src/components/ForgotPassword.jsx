import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiService.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
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
            <p className="subtitle">Password recovery</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📬</div>
              <h2 style={{ color: '#1a202c' }}>Check your email</h2>
              <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
                If <strong>{email}</strong> is associated with a SecureBase account,
                you'll receive a reset link shortly.
              </p>
              <Link to="/login"
                style={{ display: 'inline-block', marginTop: '20px', color: '#0066CC', fontWeight: '600', textDecoration: 'none' }}>
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <h2>Forgot your password?</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                Enter your work email and we'll send you a secure reset link.
              </p>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span> {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Work Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link to="/login" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}

          <div className="login-footer">
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
