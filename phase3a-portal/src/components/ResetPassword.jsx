import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

function getPasswordStrength(pwd) {
  if (pwd.length === 0) return null;
  if (pwd.length < 8) return { level: 'Weak', color: '#ef4444', bars: 1 };
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNum   = /[0-9]/.test(pwd);
  if (hasUpper && hasNum) return { level: 'Strong', color: '#10b981', bars: 3 };
  return { level: 'Fair', color: '#f59e0b', bars: 2 };
}

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

  const strength = getPasswordStrength(password);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          <div className="login-header">
            <div className="logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="#0066CC"/>
                <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="white"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0066CC' }}>{BRANDING.productName}</h1>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0f4c81', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>
              HIPAA · HEALTHCARE COMPLIANCE
            </div>
            <p className="subtitle">Set a new password</p>
          </div>

          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ color: '#1a202c' }}>Password updated successfully</h2>
              <p style={{ color: '#6b7280' }}>You can now sign in with your new password.</p>
              <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>Your session is secured with HIPAA-compliant encryption.</p>
              <button className="login-button" style={{ marginTop: '20px', width: '100%' }} onClick={() => navigate('/login')}>
                Sign In →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <h2>Choose a new password</h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1.25rem' }}>
                Your new password must be at least 8 characters. We recommend using a passphrase.
              </p>

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
                {strength && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                      {[1, 2, 3].map(n => (
                        <div key={n} style={{ height: '4px', borderRadius: '2px', flex: 1, background: n <= strength.bars ? strength.color : '#e5e7eb' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: strength.color }}>{strength.level}</span>
                  </div>
                )}
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
                {confirm.length > 0 && (
                  <div style={{ fontSize: '12px', marginTop: '6px', color: password === confirm && confirm.length >= 8 ? '#10b981' : '#ef4444' }}>
                    {password === confirm && confirm.length >= 8 ? '✓ Passwords match' : '⚠ Passwords do not match'}
                  </div>
                )}
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}

          <div className="login-footer">
            <div style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '0.4px', marginBottom: '8px', textAlign: 'center' }}>
              🔒 HIPAA&nbsp; · &nbsp;SOC 2&nbsp; · &nbsp;FedRAMP&nbsp; · &nbsp;AES-256
            </div>
            © {BRANDING.year} {BRANDING.copyrightHolder}. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
