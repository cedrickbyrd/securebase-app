import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (!token) navigate('/forgot-password');
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await apiService.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Invalid or expired reset link. Please request a new one.');
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
            <p className="subtitle">Set a new password</p>
          </div>

          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ color: '#10b981' }}>Password updated!</h2>
              <p style={{ color: '#6b7280' }}>You can now sign in with your new password.</p>
              <Link to="/login"
                style={{ display: 'inline-block', marginTop: '20px', background: '#0066CC', color: 'white', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', textDecoration: 'none' }}>
                Sign In →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <h2>Choose a new password</h2>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span> {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    disabled={loading}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShow(!show)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    {show ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirm">Confirm Password</label>
                <input
                  id="confirm"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
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
