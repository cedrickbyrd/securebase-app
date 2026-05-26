import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import '../components/Login.css';

function MarketplaceRedirect({ setAuth }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('x-amzn-marketplace-token');

    if (!token) {
      setLoading(false);
      setError('Invalid marketplace link');
      return;
    }

    let mounted = true;

    apiService
      .post('/marketplace/resolve', { token })
      .then((response) => {
        if (!mounted) return;
        setAuth(true);
        localStorage.setItem('userRole', 'user');
        localStorage.setItem('userEmail', `marketplace+${response.customer_id || 'buyer'}@securebase.local`);
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
                <span className="error-icon">⚠️</span> {error}
              </div>
              <p style={{ marginTop: '1rem', color: '#4a5568' }}>
                Need help? Contact <a href="mailto:support@securebase.tximhotep.com">support@securebase.tximhotep.com</a>
              </p>
              <p style={{ marginTop: '1rem' }}>
                <Link to="/pricing">Return to pricing</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketplaceRedirect;
