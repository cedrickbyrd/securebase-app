import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import BRANDING from '../config/branding';
import './Login.css';

function Login({ setAuth }) {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Demo mode: check credentials
      if (username === 'demo' && password === 'demo') {
        sessionStorage.setItem('demo_token', 'demo-session-token');
        sessionStorage.setItem('demo_user', JSON.stringify({ username: 'demo', name: 'Demo User' }));
        setAuth(true);
        navigate('/dashboard');
        return;
      }

      // API authentication
      const response = await apiService.authenticate(username);
      
      if (response.token || response.session_token) {
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

  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_USE_MOCK_API === 'true';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {/* Logo and Header */}
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

          {/* Demo Mode Banner */}
          {demoMode && (
            <div className="demo-banner">
              <span className="demo-icon">🎯</span>
              <strong>Demo Mode Active</strong>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLogin} className="login-form">
            <h2>Sign In</h2>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                  required
                />
                <button type="button" className="password-toggle" aria-label="Toggle password visibility">
                  👁️
                </button>
              </div>
            </div>

            {demoMode && (
              <div className="demo-credentials">
                Demo credentials: username <code>demo</code> / password <code>demo</code>
              </div>
            )}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Mode Info */}
          {demoMode && (
            <div className="demo-info">
              <p>
                This is a demonstration environment. Use the credentials{' '}
                <strong>demo/demo</strong> to explore the portal. Demo mode does not
                connect to real backend services or expose any sensitive data.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="login-footer">
            © 2025 SecureBase. All rights reserved. • <a href="#">Privacy</a> • <a href="#">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
