/**
 * Login Component
 * Customer authentication using API key
 */

import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import authClient from '../services/authAdapter';
import { useNavigate } from 'react-router-dom';

export const Login = ({ setAuth }) => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Check if we're in demo mode
  const isDemoMode = import.meta.env.VITE_USE_MOCK_API === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isDemoMode) {
        // Use authClient for demo mode (username/password)
        const { token, user } = await authClient.login({ username, password });
        sessionStorage.setItem('demo_token', token);
        sessionStorage.setItem('demo_user', JSON.stringify(user));
        setAuth(true);        
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      } else {
        // Use apiService for production mode (API key)
        await apiService.authenticate(apiKey);
setAuth(true);        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      }
    } catch (err) {
      console.error('Authentication failed:', err);
      setError(
        err.message || err.response?.data?.message || 'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-white rounded-lg shadow-lg mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SecureBase</h1>
          <p className="text-blue-100">Customer Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Sign In
          </h2>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800 font-medium">
                  Authentication successful! Redirecting...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isDemoMode ? (
              <>
                {/* Demo Mode: Username/Password */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="demo"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showKey ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="demo"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showKey ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Demo credentials: username <code className="bg-gray-100 px-1 rounded">demo</code> / password <code className="bg-gray-100 px-1 rounded">demo</code>
                  </p>
                </div>
              </>
            ) : (
              /* API Key Input */
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sb_..."
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKey ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Your API key starts with <code className="bg-gray-100 px-1 rounded">sb_</code>
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (isDemoMode ? (!username || !password) : !apiKey)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            {isDemoMode ? (
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-2">🎭 Demo Mode Active</p>
                <p className="text-xs">
                  This is a demonstration environment. Use the credentials <code className="bg-blue-100 px-1 rounded">demo/demo</code> to explore the portal. 
                  Demo mode does not connect to real backend services or expose any sensitive data.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Don't have an API key?
                </p>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium mb-2">To get started:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Contact your SecureBase administrator</li>
                    <li>Request an API key for your organization</li>
                    <li>Enter it above to access your portal</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-100 text-sm">
          <p>
            © 2025 SecureBase. All rights reserved. •{' '}
            <a href="#" className="hover:text-white">
              Privacy
            </a>{' '}
            •{' '}
            <a href="#" className="hover:text-white">
              Terms
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
