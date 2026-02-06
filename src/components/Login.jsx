/**
 * Login Component - BEM Architecture
 * Customer authentication using API key or username/password
 */

import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import authClient from '../services/authAdapter';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const isDemoMode = import.meta.env.VITE_USE_MOCK_API === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isDemoMode) {
        const { token, user } = await authClient.login({ username, password });
        sessionStorage.setItem('demo_token', token);
        sessionStorage.setItem('demo_user', JSON.stringify(user));
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 500);
      } else {
        await apiService.authenticate(apiKey);
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 500);
      }
    } catch (err) {
      console.error('Authentication failed:', err);
      setError(err.message || err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sb-Login">
      <div className="sb-Login__container">
        {/* Logo Section */}
        <div className="sb-Login__logo">
          <div className="sb-Login__logoIcon">
            <svg className="sb-Login__logoSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="sb-Login__title">SecureBase</h1>
          <p className="sb-Login__subtitle">Customer Portal</p>
        </div>

        {/* Login Card */}
        <div className="sb-Login__card">
          <h2 className="sb-Login__cardTitle">Sign In</h2>

          {/* Success Message */}
          {success && (
            <div className="sb-Alert sb-Alert--success">
              <svg className="sb-Alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="sb-Alert__content">
                <p className="sb-Alert__text">Authentication successful! Redirecting...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="sb-Alert sb-Alert--error">
              <svg className="sb-Alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="sb-Alert__content">
                <p className="sb-Alert__title">Authentication Failed</p>
                <p className="sb-Alert__text">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="sb-Login__form">
            {isDemoMode ? (
              <>
                {/* Demo Mode: Username/Password */}
                <div className="sb-FormGroup">
                  <label htmlFor="username" className="sb-FormGroup__label">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="sb-FormGroup__input"
                    placeholder="Enter your username"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="sb-FormGroup">
                  <label htmlFor="password" className="sb-FormGroup__label">Password</label>
                  <div className="sb-FormGroup__inputWrapper">
                    <input
                      id="password"
                      type={showKey ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="sb-FormGroup__input"
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="sb-FormGroup__toggleBtn"
                      disabled={loading}
                    >
                      {showKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Production Mode: API Key */}
                <div className="sb-FormGroup">
                  <label htmlFor="apiKey" className="sb-FormGroup__label">API Key</label>
                  <div className="sb-FormGroup__inputWrapper">
                    <input
                      id="apiKey"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="sb-FormGroup__input"
                      placeholder="Enter your API key"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="sb-FormGroup__toggleBtn"
                      disabled={loading}
                    >
                      {showKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <p className="sb-FormGroup__help">
                    Your API key can be found in the customer portal dashboard
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              className="sb-Button sb-Button--primary sb-Button--large sb-Button--fullWidth"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Mode Indicator */}
          {isDemoMode && (
            <div className="sb-Login__demoNotice">
              <p>🎭 Demo Mode Active - Use any username/password</p>
            </div>
          )}
        </div>
      </div>
    </div>