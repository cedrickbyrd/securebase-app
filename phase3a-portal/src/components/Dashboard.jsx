import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import NotificationBell from './NotificationBell';
import { ToastContainer } from './NotificationToast';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [metricsData, invoicesData, keysData, complianceData, ticketsData] = await Promise.all([
        apiService.getMetrics(),
        apiService.getInvoices(),
        apiService.getApiKeys(),
        apiService.getComplianceStatus(),
        apiService.getTickets({ status: 'open', limit: 5 })
      ]);

      setMetrics(metricsData);
      setInvoices(invoicesData.slice(0, 3));
      setApiKeys(keysData);
      setCompliance(complianceData);
      setTickets(ticketsData.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
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
            <p>Welcome back to SecureBase</p>
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
                          <p className="invoice-date">{new Date(invoice.date).toLocaleDateString()}</p>
                        </div>
                        <div className="invoice-amount">
                          <p className="amount">${invoice.amount.toLocaleString()}</p>
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
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
