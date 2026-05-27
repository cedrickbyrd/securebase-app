import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, persistSessionToken } from '../services/apiService';
import '../components/Login.css';

function MarketplaceRedirect({ setAuth }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('x-amzn-marketplace-token');
    const plan = params.get('plan');

    if (!token) {
      setLoading(false);
      setError('Invalid marketplace link');
      return;
    }

    let mounted = true;

    apiService
      .post('/marketplace/resolve', {
        token,
        ...(plan ? { plan } : {}),
      })
      .then((response) => {
        if (!mounted) return;
        // Store session token via shared helper — always localStorage for marketplace
        // buyers (external redirect, no "remember me" UI available)
        if (response.token) {
          persistSessionToken(response.token, true); // true = localStorage
        }
        localStorage.setItem('userRole', response.user?.role || 'user');
        localStorage.setItem('userEmail', response.user?.email || `marketplace+${response.customer_id || 'buyer'}@securebase.local`);
        setAuth(true);
        navigate(response.redirect_url || '/dashboard', { replace: true });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'Unable to activate AWS Marketplace subscription.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate, setAuth]);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>SecureBase</h1>
            <p className="subtitle">AWS Marketplace Fulfillment</p>
          </div>

          {loading && (
            <div className="login-form">
              <h2>Activating your SecureBase subscription...</h2>
            </div>
          )}

          {!loading && error && (
            <div className="login-form">
              <div className="error-message">
                <span className="error-icon">⚠️</span>{' '}
                {error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired')
                  ? 'Your Marketplace link has expired. Please return to AWS Marketplace and click the link again.'
                  : error}
              </div>
              {(error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired')) && (
                <p style={{ marginTop: '1rem' }}>
                  <a href="https://aws.amazon.com/marketplace">Return to AWS Marketplace</a>
                </p>
              )}
              <p style={{ marginTop: '1rem', color: '#4a5568' }}>
                Need help? Contact <a href="mailto:support@securebase.tximhotep.com">support@securebase.tximhotep.com</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketplaceRedirect;
