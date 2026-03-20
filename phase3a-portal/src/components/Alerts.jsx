import React, { useState, useEffect } from 'react';
import { demoAwareApiService } from '../services/demoApiService';
import { isDemoMode } from '../utils/demoData';
import './Alerts.css';

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await demoAwareApiService.getAlerts();
      setAlerts(response.data || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      await demoAwareApiService.markAlertAsRead(alertId);
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      ));
    } catch (err) {
      console.error('Error marking alert as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="alerts-loading">
        <div className="loading-spinner"></div>
        <p>Loading alerts...</p>
      </div>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.read);
  const readAlerts = alerts.filter(a => a.read);

  return (
    <div className="alerts-container">
      {isDemoMode() && (
        <div className="demo-banner">
          <span className="demo-icon">🎯</span>
          <div className="demo-text">
            <strong>Demo Mode:</strong> Showing sample alerts
          </div>
        </div>
      )}

      <div className="alerts-header">
        <h1>Alerts & Notifications</h1>
        <p className="subtitle">
          {unreadAlerts.length} unread notification{unreadAlerts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Unread Alerts */}
      {unreadAlerts.length > 0 && (
        <div className="alerts-section">
          <h2>Unread</h2>
          <div className="alerts-list">
            {unreadAlerts.map((alert) => (
              <div key={alert.id} className={`alert-card alert-${alert.type} unread`}>
                <div className="alert-icon">
                  {alert.type === 'warning' && '⚠️'}
                  {alert.type === 'info' && 'ℹ️'}
                  {alert.type === 'success' && '✅'}
                  {alert.type === 'error' && '❌'}
                </div>
                <div className="alert-content">
                  <div className="alert-header-row">
                    <h3>{alert.title}</h3>
                    <span className={`severity-badge severity-${alert.severity}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                  <div className="alert-footer">
                    <span className="alert-time">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="mark-read-btn"
                    >
                      Mark as read
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Read Alerts */}
      {readAlerts.length > 0 && (
        <div className="alerts-section">
          <h2>Read</h2>
          <div className="alerts-list">
            {readAlerts.map((alert) => (
              <div key={alert.id} className={`alert-card alert-${alert.type} read`}>
                <div className="alert-icon">
                  {alert.type === 'warning' && '⚠️'}
                  {alert.type === 'info' && 'ℹ️'}
                  {alert.type === 'success' && '✅'}
                  {alert.type === 'error' && '❌'}
                </div>
                <div className="alert-content">
                  <div className="alert-header-row">
                    <h3>{alert.title}</h3>
                    <span className={`severity-badge severity-${alert.severity}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="alert-message">{alert.message}</p>
                  <span className="alert-time">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="no-alerts-card">
          <span className="no-alerts-icon">🔔</span>
          <h3>No alerts</h3>
          <p>You're all caught up!</p>
        </div>
      )}
    </div>
  );
}
