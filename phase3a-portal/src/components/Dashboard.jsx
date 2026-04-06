import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { demoAwareApiService } from '../services/demoApiService';
import NotificationBell from './NotificationBell';
import { ToastContainer } from './NotificationToast';
import BRANDING from '../config/branding';
import { useDemoCustomer } from '../hooks/useDemoCustomer';
import DemoCustomerIndicator from './DemoCustomerIndicator';
import { CUSTOMER_TIERS } from '../config/customerTiers';
import { trackPageView, trackPageEngagement, incrementPagesViewed, trackCTAClick, trackWave3HighValueAction } from '../utils/analytics';
import { fetchData, isDemoMode as checkDemoMode } from '../utils/fetchData';
import { usePersonalization } from '../hooks/usePersonalization';
import LeadCaptureForm from './LeadCaptureForm';
import './Dashboard.css';

const TEXAS_FINTECH_TIERS = new Set([CUSTOMER_TIERS.FINTECH_PRO, CUSTOMER_TIERS.FINTECH_ELITE]);

function getCustomerTier() {
  return localStorage.getItem('customerTier') || '';
}

function Dashboard() {
  const navigate = useNavigate();
  const personalization = usePersonalization();
  const [metrics, setMetrics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [texasCompliance, setTexasCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const { customer, customerIndex } = useDemoCustomer();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const startTimeRef = useRef(null);

  // Determine if current customer has Texas fintech compliance
  const effectiveTier = customer?.tier || getCustomerTier();
  const hasTexasCompliance = TEXAS_FINTECH_TIERS.has(effectiveTier) || isDemoMode;

  useEffect(() => {
    startTimeRef.current = Date.now();
    trackPageView('Dashboard', '/dashboard');
    incrementPagesViewed();
    loadDashboardData();
    return () => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      trackPageEngagement('Dashboard', timeSpent);
    };
  }, []);

  const loadDashboardData = async () => {
    if (checkDemoMode()) {
      const mockMetrics = await fetchData('/metrics');
      setMetrics(mockMetrics);
      setLoading(false);
      return;
    }

    try {
      const requests = [
        apiService.getMetrics(),
        apiService.getInvoices(),
        apiService.getApiKeys(),
        apiService.getComplianceStatus(),
        apiService.getTickets({ status: 'open', limit: 5 })
      ];

      if (hasTexasCompliance) {
        requests.push(demoAwareApiService.getFintechComplianceStatus());
      }

      const [metricsData, invoicesData, keysData, complianceData, ticketsData, texasData] = await Promise.all(requests);

      setMetrics(metricsData);
      // Handle both wrapped ({ data: [...] }) and unwrapped formats
      const invoicesArray = invoicesData?.data || invoicesData;
      const keysArray = keysData?.data || keysData;
      const ticketsArray = ticketsData?.data || ticketsData;
      
      setInvoices(Array.isArray(invoicesArray) ? invoicesArray.slice(0, 3) : []);
      setApiKeys(Array.isArray(keysArray) ? keysArray : []);
      setCompliance(complianceData);
      setTickets(Array.isArray(ticketsArray) ? ticketsArray.slice(0, 5) : []);
      if (texasData) setTexasCompliance(texasData.data || texasData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sessionToken');
    navigate('/login');
  };

  const handleCriticalAlert = (notification) => {
    // Add toast for critical notification
    setToasts(prev => [...prev, notification]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Dashboard</h1>
            <p>Welcome back to {BRANDING.productShortName}</p>
          </div>
          <div className="header-right">
            <NotificationBell onCriticalAlert={handleCriticalAlert} />
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Demo Customer Indicator */}
        {isDemoMode && customer && customerIndex !== null && (
          <DemoCustomerIndicator customer={customer} customerIndex={customerIndex} />
        )}
        {/* Wave 3 Personalization Hero */}
        {personalization.isWave3 && (
          <section style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            marginBottom: '1.5rem',
            color: '#fff',
          }}>
            {/* Urgency banner */}
            {personalization.urgencyMessage && (
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '0.5rem',
                padding: '0.6rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.875rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                <span>{personalization.urgencyMessage}</span>
                {personalization.urgencyExpiry && (
                  <span style={{ opacity: 0.85 }}>⏰ {personalization.urgencyExpiry}</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Hero copy */}
              <div style={{ flex: '1 1 280px' }}>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.3 }}>
                  {personalization.heroHeading}
                </h2>
                <p style={{ margin: '0 0 1rem', opacity: 0.9, fontSize: '0.95rem' }}>
                  {personalization.heroParagraph}
                </p>
                <p style={{ margin: '0 0 1rem', opacity: 0.8, fontSize: '0.82rem' }}>
                  {personalization.socialProof}
                </p>
                <button
                  onClick={() => {
                    trackCTAClick('wave3_primary_cta', 'dashboard_hero');
                    trackWave3HighValueAction('primary_cta_clicked');
                  }}
                  style={{
                    background: '#fff',
                    color: '#764ba2',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.7rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  {personalization.primaryCTA}
                </button>
              </div>

              {/* Inline lead capture */}
              <div style={{
                flex: '1 1 260px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  Get a personalised demo →
                </p>
                <LeadCaptureForm
                  trigger="demo"
                  onSuccess={() => trackWave3HighValueAction('demo_lead_captured')}
                />
              </div>
            </div>
          </section>
        )}

        {/* Metrics Grid */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#e6f2ff' }}>
              💳
            </div>
            <div className="metric-content">
              <h3>Monthly Charge</h3>
              <p className="metric-value">${metrics?.monthlyCharge?.toLocaleString() || '0'}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#f0fdf4' }}>
              🔑
            </div>
            <div className="metric-content">
              <h3>Active API Keys</h3>
              <p className="metric-value">{apiKeys?.filter(k => k.status === 'active').length || 0}</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/compliance')}>
            <div className="metric-icon" style={{ background: compliance?.overall_status === 'passing' ? '#f0fdf4' : '#fff7ed' }}>
              {compliance?.overall_status === 'passing' ? '✅' : '⚠️'}
            </div>
            <div className="metric-content">
              <h3>Compliance Status</h3>
              <p className="metric-value">{compliance?.overall_status || 'Unknown'}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#fef2f2' }}>
              🎫
            </div>
            <div className="metric-content">
              <h3>Open Tickets</h3>
              <p className="metric-value">{tickets?.length || 0}</p>
            </div>
          </div>

          <div
            className="metric-card clickable"
            onClick={() => navigate('/sre-dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/sre-dashboard')}
            aria-label="Navigate to SRE Dashboard"
          >
            <div className="metric-icon" style={{ background: '#eff6ff' }}>
              🖥️
            </div>
            <div className="metric-content">
              <h3>SRE Dashboard</h3>
              <p className="metric-value">Infrastructure</p>
            </div>
          </div>

          <div
            className="metric-card clickable"
            onClick={() => navigate('/alerts')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/alerts')}
            aria-label="Navigate to Alert Management"
          >
            <div className="metric-icon" style={{ background: '#fef9c3' }}>
              🔔
            </div>
            <div className="metric-content">
              <h3>Alert Management</h3>
              <p className="metric-value">Operations</p>
            </div>
          </div>

          {hasTexasCompliance && (
            <div
              className="metric-card clickable"
              onClick={() => navigate('/fintech-portal')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/fintech-portal')}
              aria-label="Navigate to Texas Examiner Portal"
            >
              <div className="metric-icon" style={{ background: '#eff6ff' }}>
                ⭐
              </div>
              <div className="metric-content">
                <h3>Texas DOB Compliance</h3>
                <p className="metric-value" style={{ color: '#10b981', fontSize: '0.95rem' }}>
                  {texasCompliance
                    ? `${texasCompliance.passingControls}/${texasCompliance.totalControls} controls`
                    : '5/5 controls'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Two Column Layout */}
        <div className="dashboard-columns">
          {/* Left Column */}
          <div className="dashboard-column">
            {/* Recent Invoices */}
            <section className="dashboard-card">
              <div className="card-header">
                <h2>Recent Invoices</h2>
                <button className="view-all-btn">View All →</button>
              </div>
              <div className="card-content">
                {invoices.length > 0 ? (
                  <div className="invoices-list">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="invoice-item">
                        <div className="invoice-info">
                          <p className="invoice-number">{invoice.invoice_number}</p>
                          <p className="invoice-date">{invoice.created_at || invoice.date ? new Date(invoice.created_at || invoice.date).toLocaleDateString() : '—'}</p>
                        </div>
                        <div className="invoice-amount">
                          <p className="amount">${(invoice.total_amount ?? invoice.amount ?? 0).toLocaleString()}</p>
                          <span className={`status-badge ${invoice.status}`}>{invoice.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No invoices found</p>
                )}
              </div>
            </section>

            {/* API Keys Summary */}
            <section className="dashboard-card">
              <div className="card-header">
                <h2>API Keys</h2>
                <button className="view-all-btn">Manage →</button>
              </div>
              <div className="card-content">
                {apiKeys.length > 0 ? (
                  <div className="api-keys-list">
                    {apiKeys.slice(0, 3).map((key) => (
                      <div key={key.id} className="api-key-item">
                        <div className="key-info">
                          <p className="key-name">{key.name}</p>
                          <p className="key-preview">{key.key_preview}</p>
                        </div>
                        <span className={`status-badge ${key.status}`}>{key.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No API keys found</p>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="dashboard-column">
            {/* Compliance Overview */}
            <section className="dashboard-card">
              <div className="card-header">
                <h2>Compliance Overview</h2>
                <button className="view-all-btn" onClick={() => navigate('/compliance')}>
                  View Details →
                </button>
              </div>
              <div className="card-content">
                {compliance ? (
                  <div className="compliance-summary">
                    <div className="compliance-status">
                      <div className={`status-indicator ${compliance.overall_status}`}>
                        {compliance.overall_status === 'passing' ? '✅' : '⚠️'}
                      </div>
                      <div>
                        <p className="status-label">Overall Status</p>
                        <p className="status-value">{compliance.overall_status}</p>
                      </div>
                    </div>
                    <div className="compliance-stats">
                      <div className="stat">
                        <span className="stat-value" style={{ color: '#10b981' }}>{compliance.passing || 0}</span>
                        <span className="stat-label">Passing</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value" style={{ color: '#f59e0b' }}>{compliance.warning || 0}</span>
                        <span className="stat-label">Warning</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value" style={{ color: '#ef4444' }}>{compliance.failing || 0}</span>
                        <span className="stat-label">Failing</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">No compliance data available</p>
                )}
              </div>
            </section>

            {/* Support Tickets */}
            <section className="dashboard-card">
              <div className="card-header">
                <h2>Recent Tickets</h2>
                <button className="view-all-btn">View All →</button>
              </div>
              <div className="card-content">
                {tickets.length > 0 ? (
                  <div className="tickets-list">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="ticket-item">
                        <div className="ticket-info">
                          <p className="ticket-title">{ticket.subject}</p>
                          <p className="ticket-meta">
                            <span className={`priority-badge ${ticket.priority}`}>{ticket.priority}</span>
                            <span className="ticket-date">{new Date(ticket.created_at).toLocaleDateString()}</span>
                          </p>
                        </div>
                        <span className={`status-badge ${ticket.status}`}>{ticket.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No open tickets</p>
                )}
              </div>
            </section>

            {/* Texas DOB Compliance (fintech_pro / fintech_elite) */}
            {hasTexasCompliance && (
              <section className="dashboard-card" style={{ borderLeft: '4px solid #1e3a5f' }}>
                <div className="card-header">
                  <h2>⭐ Texas DOB Compliance</h2>
                  <button
                    className="view-all-btn"
                    onClick={() => navigate('/fintech-portal')}
                  >
                    Access Examiner Portal →
                  </button>
                </div>
                <div className="card-content">
                  {texasCompliance ? (
                    <div>
                      <div className="compliance-status" style={{ marginBottom: '1rem' }}>
                        <div className="status-indicator passing" style={{ background: '#f0fdf4' }}>✅</div>
                        <div>
                          <p className="status-label">Texas DOB Status</p>
                          <p className="status-value" style={{ color: '#10b981' }}>
                            {texasCompliance.passingControls}/{texasCompliance.totalControls} Controls Passing
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(texasCompliance.controls || []).slice(0, 3).map(ctrl => (
                          <div key={ctrl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: 6 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                              ✅ {ctrl.id}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{ctrl.name}</span>
                          </div>
                        ))}
                        {(texasCompliance.controls || []).length > 3 && (
                          <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', margin: '0.25rem 0 0' }}>
                            +{(texasCompliance.controls || []).length - 3} more controls
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="empty-state">Loading Texas compliance data…</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
