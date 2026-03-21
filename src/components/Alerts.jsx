import React, { useState, useEffect } from 'react';
import { isDemoMode, demoAwareApiService } from '../services/demoApiService';
import { DEMO_CUSTOMER } from '../utils/demoData';
import './Alerts.css';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

const SeverityBadge = ({ severity }) => (
  <span className={`alerts-badge alerts-badge--${severity}`}>{severity}</span>
);

const StatusBadge = ({ status }) => (
  <span className={`alerts-badge alerts-badge--status alerts-badge--status-${status.replace('_', '-')}`}>{status.replace('_', ' ')}</span>
);

const formatTime = (ts) => {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const isDemo = isDemoMode();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await demoAwareApiService.getAlerts();
        setAlerts(result.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAcknowledge = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged', assignee: DEMO_CUSTOMER.email } : a))
    );
  };

  const handleResolve = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a))
    );
  };

  const filtered = alerts
    .filter((a) => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));

  return (
    <div className="alerts-page">
      {isDemo && (
        <div className="alerts-demo-banner">
          🚀 DEMO MODE — Alert actions are simulated and do not affect real infrastructure.
        </div>
      )}

      <div className="alerts-header">
        <div>
          <h1 className="alerts-title">Alerts</h1>
          <p className="alerts-subtitle">{alerts.length} total · {alerts.filter((a) => a.status === 'active').length} active</p>
        </div>
      </div>

      {/* Filters */}
      <div className="alerts-filters">
        <input
          className="alerts-search"
          type="text"
          placeholder="Search alerts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="alerts-select" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select className="alerts-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Content */}
      {loading && <div className="alerts-empty">Loading alerts…</div>}
      {error && <div className="alerts-error">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="alerts-empty">No alerts match your filters.</div>
      )}

      <div className="alerts-list">
        {filtered.map((alert) => (
          <div key={alert.id} className={`alerts-card alerts-card--${alert.severity}`}>
            <div className="alerts-card__header">
              <div className="alerts-card__badges">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
              </div>
              <span className="alerts-card__time">{formatTime(alert.timestamp)}</span>
            </div>
            <h3 className="alerts-card__title">{alert.title}</h3>
            <p className="alerts-card__description">{alert.description}</p>
            <div className="alerts-card__meta">
              <span>{alert.service}</span>
              <span>{alert.environment}</span>
              {alert.assignee && <span>Assigned: {alert.assignee}</span>}
            </div>
            {alert.status === 'active' && (
              <div className="alerts-card__actions">
                <button className="alerts-btn alerts-btn--acknowledge" onClick={() => handleAcknowledge(alert.id)}>
                  Acknowledge
                </button>
                <button className="alerts-btn alerts-btn--resolve" onClick={() => handleResolve(alert.id)}>
                  Resolve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
