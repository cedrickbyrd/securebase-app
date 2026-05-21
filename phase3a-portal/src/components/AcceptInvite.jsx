import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

export default function AcceptInvite({ setAuth }) {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token');

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [show, setShow]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const data = await apiService.post('/auth/accept-invite', { token, password });
      if (data.token) {
        sessionStorage.setItem('sessionToken', data.token);
        localStorage.setItem('userEmail', data.user?.email || '');
        localStorage.setItem('userRole',  data.user?.role  || 'user');
        setAuth(true);
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 800);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired invite link.');
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
            <p className="subtitle">Activate your account</p>
          </div>

          {success ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h2 style={{ color: '#10b981' }}>Account activated!</h2>
              <p style={{ color: '#6b7280' }}>Taking you to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <h2>Set your password</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                Choose a strong password to secure your SecureBase account.
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
                {loading ? 'Activating…' : 'Activate Account & Sign In'}
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
