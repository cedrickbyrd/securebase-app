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

function getFirstName(emailOrNull) {
  const email = emailOrNull || localStorage.getItem('userEmail') || '';
  const local = email.split('@')[0] || '';
  const first = local.split('.')[0] || '';
  const cap   = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  if (/^[a-zA-Z]+$/.test(cap) && cap.length >= 2 && cap.length <= 20) return cap;
  return null;
}

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
  const [successEmail, setSuccessEmail] = useState('');

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
        setSuccessEmail(data.user?.email || '');
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2500);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired invite link.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(password);
  const firstName = success ? getFirstName(successEmail) : null;

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

          {!success && (
            <div style={{
              background: 'linear-gradient(135deg, #0f4c81 0%, #1a73e8 100%)',
              padding: '2rem 2rem 1.75rem',
              borderRadius: '12px 12px 0 0',
              margin: '-3rem -2.5rem 2rem',
              textAlign: 'center',
              color: 'white',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏥</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', lineHeight: 1.2 }}>Welcome to SecureBase</div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.12em', opacity: 0.85, textTransform: 'uppercase', marginTop: '0.35rem' }}>
                HIPAA · HEALTHCARE COMPLIANCE
              </div>
              <p style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.5rem', marginBottom: 0 }}>
                Your compliance platform is ready.<br />Set your password to access your dashboard.
              </p>
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
                @keyframes progressSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
              ` }} />
              <div style={{ fontSize: '64px', marginBottom: '12px', display: 'inline-block', animation: 'pulse 1.2s ease infinite' }}>✅</div>
              <h2 style={{ color: '#1a202c', marginBottom: '0.25rem' }}>
                {firstName ? `Hello, ${firstName}!` : "You're in!"}
              </h2>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Your HIPAA compliance dashboard is loading…</p>
              <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: '#e5e7eb', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ height: '100%', background: '#1a73e8', borderRadius: '2px', animation: 'progressSlide 2s ease-in-out infinite' }} />
              </div>
              <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '1rem', textAlign: 'left' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '0.6rem', marginTop: 0 }}>What's waiting for you:</p>
                {[['🛡️', 'HIPAA Posture Score'], ['⚠️', 'Open Findings & Remediation'], ['📄', 'Downloadable Evidence Package']].map(([icon, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
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
                {loading ? 'Activating…' : 'Activate My Account →'}
              </button>
              <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
                🔒 Your password is encrypted and never stored in plaintext.
              </p>
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
