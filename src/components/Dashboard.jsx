import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    monthlyCharge: 0,
    monthlyUsage: {},
    recentInvoices: [],
    apiKeysCount: 0,
    complianceStatus: '',
    pendingTickets: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [metrics, invoices, apiKeys, compliance, tickets] = await Promise.all([
        apiService.getMetrics(),
        apiService.getInvoices({ limit: 5 }),
        apiService.getApiKeys(),
        apiService.getComplianceStatus(),
        apiService.getSupportTickets({ status: 'open' }),
      ]);

      setDashboardData({
        monthlyCharge: invoices.data[0]?.total_amount || 0,
        monthlyUsage: metrics.data,
        recentInvoices: invoices.data,
        apiKeysCount: apiKeys.data.length,
        complianceStatus: compliance.data.status,
        pendingTickets: tickets.data.length,
      });

      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sb-Dashboard sb-Dashboard--loading">
        <div className="sb-Dashboard__spinner"></div>
        <p className="u-text-muted">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="sb-Dashboard">
      <div className="sb-Dashboard__header">
        <h1>Dashboard</h1>
        <p className="u-text-muted">Welcome back to SecureBase</p>
      </div>

      {error && (
        <div className="sb-Alert sb-Alert--error">
          <span className="sb-Alert__icon">⚠️</span>
          <div className="sb-Alert__content">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="sb-Dashboard__grid">
        {/* Monthly Charge Card */}
        <div className="sb-Card sb-Card--highlight">
          <div className="sb-Card__header">
            <span className="sb-Card__icon">💳</span>
            <h3>Monthly Charge</h3>
          </div>
          <div className="sb-Card__value">${(dashboardData.monthlyCharge / 100).toFixed(2)}</div>
          <p className="u-text-muted">Current billing cycle</p>
        </div>

        {/* API Keys Card */}
        <div className="sb-Card">
          <div className="sb-Card__header">
            <span className="sb-Card__icon">🔑</span>
            <h3>API Keys</h3>
          </div>
          <div className="sb-Card__value">{dashboardData.apiKeysCount}</div>
          <p className="u-text-muted">Active keys</p>
        </div>

        {/* Compliance Card */}
        <div className="sb-Card">
          <div className="sb-Card__header">
            <span className="sb-Card__icon">🛡️</span>
            <h3>Compliance</h3>
          </div>
          <div className={`sb-Badge sb-Badge--${dashboardData.complianceStatus}`}>{dashboardData.complianceStatus}</div>
          <p className="u-text-muted">Security posture</p>
        </div>

        {/* Support Tickets Card */}
        <div className="sb-Card">
          <div className="sb-Card__header">
            <span className="sb-Card__icon">🎫</span>
            <h3>Support</h3>
          </div>
          <div className="sb-Card__value">{dashboardData.pendingTickets}</div>
          <p className="u-text-muted">Open tickets</p>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="sb-Dashboard__section">
        <h2>Recent Invoices</h2>
        <div className="sb-Table">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                  <td>${(invoice.total_amount / 100).toFixed(2)}</td>
                  <td>
                    <span className={`sb-Badge sb-Badge--${invoice.status}`}>{invoice.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}