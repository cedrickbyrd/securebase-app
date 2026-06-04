import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService, persistSessionToken, clearStoredSessionToken } from '../services/apiService';
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
  const localPart = email.split('@')[0] || '';
  const firstName = localPart.split('.')[0] || '';
  const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  if (/^[a-zA-Z]+$/.test(capitalizedName) && capitalizedName.length >= 2 && capitalizedName.length <= 20) return capitalizedName;
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
  const [resendSent, setResendSent]     = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
    // Clear any stale session so the activation request goes in unauthenticated.
    // A lingering sessionToken causes apiService to attach Authorization: Bearer
    // which triggers a 401 → redirect loop before the response is handled.
    clearStoredSessionToken();
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
        // Use persistSessionToken with rememberMe=true to match the login default —
        // new users should not be immediately logged out on tab close after activation.
        persistSessionToken(data.token, true);
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

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await apiService.post('/auth/invite/resend', { token });
    } catch (_) {
      // Swallow errors — uniform UX regardless of outcome (prevent enumeration)
    } finally {
      setResendLoading(false);
      setResendSent(true);
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
              <div style={{ fontSize: '64px', marginBottom: '12px', display: 'inline-block', animation: 'iconPulse 1.2s ease infinite' }}>✅</div>
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
                resendSent ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📬</div>
                    <h3 style={{ color: '#1a202c' }}>New invite sent</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      Check your inbox for a fresh activation link. It's valid for 30 days.
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                      Didn't receive it? Contact{' '}
                      <a href={`mailto:${BRANDING.supportEmail}`} style={{ color: '#9ca3af' }}>
                        {BRANDING.supportEmail}
                      </a>
                    </p>
                  </div>
                ) : /(?:invalid|expired).*(?:invite|link|token)/i.test(error) ? (
                  <div className="error-message">
                    <span className="error-icon">⚠️</span> Your invite link has expired.
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="login-button"
                        style={{ fontSize: '14px', padding: '10px 20px' }}
                      >
                        {resendLoading ? 'Sending…' : 'Resend my invite →'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="error-message">
                    <span className="error-icon">⚠️</span> {error}
                  </div>
                )
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
