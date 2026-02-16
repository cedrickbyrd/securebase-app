/**
 * Dashboard Component - BEM Architecture
 * Main landing page for authenticated customers
 * Shows summary of invoices, API keys, compliance status
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Key,
  Shield,
  Ticket,
  TrendingUp,
  Download,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// Constants for download flow timing
const REPORT_GENERATION_DELAY = 15000; // 15 seconds
const SUCCESS_MESSAGE_DELAY = 2000; // 2 seconds
const MARKETING_SITE_URL = 'https://tximhotep.com';

// Download modal component
const DownloadModal = ({ isDownloading, downloadComplete }) => {
  if (!isDownloading && !downloadComplete) return null;

  return (
    <div className="sb-Modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="sb-Modal__backdrop" />
      <div className="sb-Modal__content">
        {isDownloading && (
          <div className="sb-Modal__loading">
            <div className="sb-Spinner sb-Spinner--large" aria-label="Loading"></div>
            <h2 id="modal-title" className="sb-Modal__title">Generating Security Report...</h2>
            <p className="sb-Modal__text">Please wait while we compile your compliance data</p>
          </div>
        )}
        {downloadComplete && (
          <div className="sb-Modal__success">
            <div className="sb-Modal__successIcon">
              <CheckCircle2 size={64} color="#10b981" aria-hidden="true" />
            </div>
            <h2 id="modal-title" className="sb-Modal__title">Report Downloaded!</h2>
            <p className="sb-Modal__text">Your security report has been generated successfully</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    monthlyCharge: 0,
    monthlyUsage: {},
    recentInvoices: [],
    apiKeysCount: 0,
    complianceStatus: '',
    pendingTickets: 0,
  });

  // Track timeout IDs for cleanup
  const timeoutRefs = React.useRef({ generation: null, logout: null });

  useEffect(() => {
    loadDashboardData();

    // Cleanup timeouts on unmount
    return () => {
      if (timeoutRefs.current.generation) {
        clearTimeout(timeoutRefs.current.generation);
      }
      if (timeoutRefs.current.logout) {
        clearTimeout(timeoutRefs.current.logout);
      }
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { apiService } = await import('../services/apiService');
      
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownloadReport = () => {
    // Start download flow (demo only - no actual file download)
    setIsDownloading(true);
    
    // Simulate report generation for dramatic effect
    timeoutRefs.current.generation = setTimeout(() => {
      showSuccessAndLogout();
    }, REPORT_GENERATION_DELAY);
  };

  const showSuccessAndLogout = () => {
    // Show success message
    setIsDownloading(false);
    setDownloadComplete(true);
    
    // After brief success message, logout and redirect
    timeoutRefs.current.logout = setTimeout(() => {
      handleLogout();
    }, SUCCESS_MESSAGE_DELAY);
  };

  const handleLogout = () => {
    // Clear all storage (intentional for demo "ending" - resets entire demo state)
    sessionStorage.clear();
    localStorage.clear();
    
    // Redirect to marketing site (demo "money shot" finale)
    window.location.href = MARKETING_SITE_URL;
  };

  if (loading) {
    return (
      <div className="sb-Dashboard__loading">
        <div className="sb-Dashboard__loadingContent">
          <div className="sb-Spinner"></div>
          <p className="sb-Dashboard__loadingText">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-Dashboard">
      {/* Download Modal */}
      <DownloadModal isDownloading={isDownloading} downloadComplete={downloadComplete} />

      {/* Header */}
      <div className="sb-Dashboard__header">
        <div className="sb-Dashboard__headerContent">
          <h1 className="sb-Dashboard__title">Dashboard</h1>
          <p className="sb-Dashboard__subtitle">Welcome back to SecureBase</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="sb-Dashboard__errorContainer">
          <div className="sb-Alert sb-Alert--error">
            <AlertCircle className="sb-Alert__icon" />
            <div className="sb-Alert__content">
              <h3 className="sb-Alert__title">Error loading dashboard</h3>
              <p className="sb-Alert__text">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="sb-Dashboard__content">
        {/* Top Stats Grid */}
        <div className="sb-Dashboard__statsGrid">
          {/* Monthly Charge */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Monthly Charge</p>
                <p className="sb-StatCard__value">
                  {formatCurrency(dashboardData.monthlyCharge)}
                </p>
              </div>
              <CreditCard className="sb-StatCard__icon sb-StatCard__icon--blue" />
            </div>
          </div>

          {/* API Keys */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Active API Keys</p>
                <p className="sb-StatCard__value">{dashboardData.apiKeysCount}</p>
              </div>
              <Key className="sb-StatCard__icon sb-StatCard__icon--purple" />
            </div>
          </div>

          {/* Compliance Status */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Compliance Status</p>
                <div className="sb-StatCard__statusWrapper">
                  <CheckCircle2 className="sb-StatCard__statusIcon sb-StatCard__statusIcon--success" />
                  <p className="sb-StatCard__statusText sb-StatCard__statusText--success">
                    {dashboardData.complianceStatus}
                  </p>
                </div>
              </div>
              <Shield className="sb-StatCard__icon sb-StatCard__icon--green" />
            </div>
          </div>

          {/* Open Tickets */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Open Tickets</p>
                <p className="sb-StatCard__value">{dashboardData.pendingTickets}</p>
              </div>
              <Ticket className="sb-StatCard__icon sb-StatCard__icon--orange" />
            </div>
          </div>
        </div>

        {/* Recent Invoices & Quick Actions */}
        <div className="sb-Dashboard__mainGrid">
          {/* Recent Invoices */}
          <div className="sb-InvoiceList">
            <div className="sb-InvoiceList__header">
              <h2 className="sb-InvoiceList__title">Recent Invoices</h2>
            </div>
            <div className="sb-InvoiceList__items">
              {dashboardData.recentInvoices.length > 0 ? (
                dashboardData.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="sb-InvoiceItem">
                    <div className="sb-InvoiceItem__content">
                      <div className="sb-InvoiceItem__info">
                        <p className="sb-InvoiceItem__number">{invoice.invoice_number}</p>
                        <p className="sb-InvoiceItem__date">
                          {formatDate(invoice.created_at)}
                        </p>
                      </div>
                      <div className="sb-InvoiceItem__details">
                        <p className="sb-InvoiceItem__amount">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                        <span className={`sb-Badge sb-Badge--${invoice.status}`}>{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sb-InvoiceList__empty">
                  <p>No invoices yet</p>
                </div>
              )}
            </div>
            <div className="sb-InvoiceList__footer">
              <a href="/invoices" className="sb-Link">
                View all invoices →
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="sb-QuickActions">
            <h3 className="sb-QuickActions__title">Quick Actions</h3>
            <div className="sb-QuickActions__list">
              <button 
                onClick={handleDownloadReport} 
                className="sb-ActionButton sb-ActionButton--blue"
                aria-label="Download security compliance report"
                disabled={isDownloading || downloadComplete}
              >
                <Download className="sb-ActionButton__icon" />
                Download Report
              </button>
              <a href="/api-keys" className="sb-ActionButton sb-ActionButton--purple">
                <Plus className="sb-ActionButton__icon" />
                Create API Key
              </a>
              <a href="/compliance" className="sb-ActionButton sb-ActionButton--green">
                <Shield className="sb-ActionButton__icon" />
                View Compliance
              </a>
              <a href="/support" className="sb-ActionButton sb-ActionButton--orange">
                <Ticket className="sb-ActionButton__icon" />
                Submit Ticket
              </a>
            </div>
          </div>
        </div>

        {/* Usage Trends */}
        <div className="sb-UsageTrends">
          <div className="sb-UsageTrends__header">
            <TrendingUp className="sb-UsageTrends__icon" />
            <h2 className="sb-UsageTrends__title">Usage This Month</h2>
          </div>
          <div className="sb-UsageTrends__grid">
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">AWS Accounts</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.account_count || 0}
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">CloudTrail Events</p>
              <p className="sb-UsageMetric__value">
                {(dashboardData.monthlyUsage.cloudtrail_events || 0).toLocaleString()}
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">Log Storage</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.log_storage_gb || 0} GB
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">Data Transfer</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.data_transfer_gb || 0} GB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}