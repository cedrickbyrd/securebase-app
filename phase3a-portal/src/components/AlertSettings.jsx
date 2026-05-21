import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const DEFAULT_ALERT_SETTINGS = {
  slack_webhook: '',
  email_notify: true,
  notify_email: localStorage.getItem('userEmail') || '',
  score_drop_threshold: 5,
  notify_on_critical: true,
  notify_on_high: true,
};

const SCORE_THRESHOLD_OPTIONS = [3, 5, 10, 15];

const MOCK_ALERT_HISTORY = [
  { id: 'h001', type: 'critical', message: 'New critical finding: Unencrypted PHI in S3', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'active' },
  { id: 'h002', type: 'score_drop', message: 'SOC 2 score dropped 5 points (81% → 76%)', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), status: 'active' },
  { id: 'h003', type: 'high', message: 'New high finding: MFA not enforced for admin users', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'resolved' },
];

function getTokenHeaders() {
  const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function readStoredSettings() {
  try {
    const stored = localStorage.getItem('alert_settings');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function normalizeSettings(payload) {
  const source = payload || {};
  return {
    slack_webhook: String(source.slack_webhook || ''),
    email_notify: source.email_notify !== undefined ? Boolean(source.email_notify) : true,
    notify_email: source.notify_email || localStorage.getItem('userEmail') || '',
    score_drop_threshold: Number.isFinite(Number(source.score_drop_threshold)) ? Number(source.score_drop_threshold) : 5,
    notify_on_critical: source.notify_on_critical !== undefined ? Boolean(source.notify_on_critical) : true,
    notify_on_high: source.notify_on_high !== undefined ? Boolean(source.notify_on_high) : true,
  };
}

function formatRelativeTime(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return 'Unknown';
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function alertTypeIcon(type) {
  if (type === 'critical') return '🚨';
  if (type === 'high') return '⚠️';
  return '📉';
}

export function areAlertsConfigured(settings) {
  if (!settings) return false;
  const hasSlack = Boolean(String(settings.slack_webhook || '').trim());
  const hasEmail = Boolean(settings.email_notify && String(settings.notify_email || '').trim());
  return hasSlack || hasEmail;
}

export default function AlertSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [history] = useState(MOCK_ALERT_HISTORY);
  const orgName = localStorage.getItem('orgName') || 'Organization';

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/alerts/settings', {
          method: 'GET',
          headers: getTokenHeaders(),
        });
        if (!response.ok) throw new Error(`alerts_settings_fetch_failed:${response.status}`);
        const payload = await response.json();
        if (!active) return;
        const normalized = normalizeSettings(payload);
        setSettings(normalized);
        localStorage.setItem('alert_settings', JSON.stringify(normalized));
      } catch {
        const fallback = normalizeSettings(readStoredSettings() || DEFAULT_ALERT_SETTINGS);
        if (!active) return;
        setSettings(fallback);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const alertsConfigured = useMemo(() => areAlertsConfigured(settings), [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/alerts/settings', {
        method: 'POST',
        headers: getTokenHeaders(),
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error(`alerts_settings_save_failed:${response.status}`);
    } catch {
      localStorage.setItem('alert_settings', JSON.stringify(settings));
    } finally {
      localStorage.setItem('alert_settings', JSON.stringify(settings));
      setSaving(false);
      setToastMessage('✓ Alert settings saved');
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: getTokenHeaders(),
        body: JSON.stringify({ channel: 'slack' }),
      });
      if (!response.ok) throw new Error(`alerts_test_failed:${response.status}`);
      setToastMessage('✓ Test notification sent');
    } catch {
      setToastMessage('⚠ Could not send test — check your webhook URL');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button type="button" onClick={() => navigate('/dashboard')} className="view-all-btn" style={{ marginBottom: '0.25rem' }}>
              ← Dashboard
            </button>
            <h1>🔔 Alert Settings</h1>
            <p>{orgName} · Notification preferences &amp; alert history</p>
          </div>
          {!alertsConfigured && <span className="alerts-unconfigured-dot" aria-label="Alerts not configured" />}
        </div>
      </header>

      <main className="dashboard-main" style={{ maxWidth: 1100 }}>
        {toastMessage && (
          <div style={{ marginBottom: '0.75rem' }}>
            <span className="status-toast">{toastMessage}</span>
          </div>
        )}

        <section className="alert-settings-card">
          {loading ? (
            <p style={{ margin: 0, color: '#6b7280' }}>Loading alert settings…</p>
          ) : (
            <>
              <div className="alert-section-label">Score Alerts</div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#374151', fontSize: '0.88rem' }}>
                Alert me when compliance score drops by:
              </label>
              <select
                value={settings.score_drop_threshold}
                onChange={(event) => setSettings((prev) => ({ ...prev, score_drop_threshold: Number(event.target.value) }))}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
              >
                {SCORE_THRESHOLD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}%</option>
                ))}
              </select>

              <div className="alert-section-label">Finding Alerts</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={settings.notify_on_critical}
                  onChange={(event) => setSettings((prev) => ({ ...prev, notify_on_critical: event.target.checked }))}
                />
                Notify on new Critical findings
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#374151', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={settings.notify_on_high}
                  onChange={(event) => setSettings((prev) => ({ ...prev, notify_on_high: event.target.checked }))}
                />
                Notify on new High findings
              </label>

              <div className="alert-section-label">Email Notifications</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.7rem' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.email_notify}
                    onChange={(event) => setSettings((prev) => ({ ...prev, email_notify: event.target.checked }))}
                  />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: '0.9rem', color: '#374151' }}>Send email alerts</span>
              </div>
              <input
                type="email"
                value={settings.notify_email}
                onChange={(event) => setSettings((prev) => ({ ...prev, notify_email: event.target.value }))}
                placeholder="user@example.com"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
              />

              <div className="alert-section-label">Slack Integration</div>
              <input
                type="url"
                value={settings.slack_webhook}
                onChange={(event) => setSettings((prev) => ({ ...prev, slack_webhook: event.target.value }))}
                placeholder="https://hooks.slack.com/..."
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
              />
              <p style={{ margin: '0.5rem 0 0.85rem', fontSize: '0.8rem', color: '#6b7280' }}>
                Paste your Slack incoming webhook URL. <a href="#slack-webhook-help">How to get one →</a>
              </p>
              <button type="button" onClick={handleSendTest} style={btnSecondaryInline} disabled={testing}>
                {testing ? 'Sending…' : 'Send Test Notification'}
              </button>

              <button
                type="button"
                onClick={handleSave}
                style={{ ...btnPrimaryInline, marginTop: '1rem', width: '100%', opacity: saving ? 0.8 : 1 }}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Alert Settings'}
              </button>
            </>
          )}
        </section>

        <section className="activity-log">
          <div className="activity-log-header">🔔 Alert History</div>
          {history.map((alert) => (
            <div key={alert.id} className="activity-log-row">
              <span>{alertTypeIcon(alert.type)}</span>
              <span style={{ flex: 1, color: '#374151' }}>{alert.message}</span>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatRelativeTime(alert.timestamp)}</span>
              <span style={{
                fontSize: '0.75rem',
                borderRadius: 999,
                padding: '0.1rem 0.5rem',
                background: alert.status === 'resolved' ? '#dcfce7' : '#fef3c7',
                color: alert.status === 'resolved' ? '#166534' : '#92400e',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}>
                {alert.status}
              </span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

const btnPrimaryInline = {
  background: '#0f4c81',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '0.65rem 1.1rem',
  fontWeight: 700,
  fontSize: '0.86rem',
  cursor: 'pointer',
};

const btnSecondaryInline = {
  background: '#fff',
  color: '#0f4c81',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: '0.5rem 0.9rem',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
};
