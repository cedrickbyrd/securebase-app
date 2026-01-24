import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, XCircle, CheckCircle, Clock, Filter, Download, Eye } from 'lucide-react';
import api from '../services/api';

/**
 * Security Events Dashboard
 * Monitor and respond to security incidents with <15min response target
 */
const SecurityEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    limit: 100
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      params.limit = filters.limit;

      const data = await api.get('/security/events', { params });
      setEvents(data.events || []);
    } catch (err) {
      setError('Failed to load security events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full uppercase">Critical</span>,
      high: <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full uppercase">High</span>,
      medium: <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full uppercase">Medium</span>,
      low: <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full uppercase">Low</span>,
      info: <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full uppercase">Info</span>
    };
    return badges[severity] || badges.info;
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center space-x-1">
        <XCircle className="w-3 h-3" /><span>Open</span>
      </span>,
      investigating: <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full flex items-center space-x-1">
        <Clock className="w-3 h-3" /><span>Investigating</span>
      </span>,
      resolved: <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center space-x-1">
        <CheckCircle className="w-3 h-3" /><span>Resolved</span>
      </span>,
      false_positive: <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">False Positive</span>
    };
    return badges[status] || badges.open;
  };

  const getEventTypeIcon = (eventType) => {
    const icons = {
      failed_login: '🔑',
      account_locked: '🔒',
      suspicious_ip: '🌐',
      new_device: '📱',
      mfa_failed: '🛡️',
      password_reset_request: '🔄',
      api_key_leaked: '⚠️',
      unusual_activity: '👁️',
      brute_force_attempt: '💥',
      session_hijack_attempt: '🎭',
      privilege_escalation_attempt: '⬆️',
      data_exfiltration_attempt: '📤'
    };
    return icons[eventType] || '⚡';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const calculateResponseTime = (detectedAt, resolvedAt) => {
    if (!resolvedAt) return null;
    const diff = new Date(resolvedAt) - new Date(detectedAt);
    const minutes = Math.floor(diff / 60000);
    return minutes;
  };

  const exportEvents = () => {
    const csv = [
      ['Timestamp', 'Severity', 'Type', 'Description', 'Status', 'IP Address', 'User'],
      ...events.map(e => [
        e.detected_at,
        e.severity,
        e.event_type,
        e.description,
        e.status,
        e.ip_address || 'N/A',
        e.user_email || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const criticalCount = events.filter(e => e.severity === 'critical' && e.status === 'open').length;
  const highCount = events.filter(e => e.severity === 'high' && e.status === 'open').length;
  const openCount = events.filter(e => e.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-red-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Security Events</h2>
            <p className="text-sm text-gray-600">Real-time security monitoring with &lt;15min incident response target</p>
          </div>
        </div>
        <button
          onClick={exportEvents}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Events</div>
          <div className="text-3xl font-bold text-gray-900">{events.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
          <div className="text-sm text-gray-600 mb-1">Critical Open</div>
          <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
          {criticalCount > 0 && <div className="text-xs text-red-500 mt-1">⚠️ Requires immediate attention</div>}
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-orange-200">
          <div className="text-sm text-gray-600 mb-1">High Severity Open</div>
          <div className="text-3xl font-bold text-orange-600">{highCount}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-yellow-200">
          <div className="text-sm text-gray-600 mb-1">All Open</div>
          <div className="text-3xl font-bold text-yellow-600">{openCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Limit</label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="50">50 events</option>
                <option value="100">100 events</option>
                <option value="500">500 events</option>
                <option value="1000">1000 events</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Events List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading security events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No security events found</p>
            <p className="text-sm mt-1">Your system is secure</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {events.map((event) => {
              const responseTime = calculateResponseTime(event.detected_at, event.resolved_at);
              const isSlowResponse = responseTime && responseTime > 15;

              return (
                <div
                  key={event.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    event.severity === 'critical' ? 'bg-red-50 border-l-4 border-red-600' :
                    event.severity === 'high' ? 'border-l-4 border-orange-400' : ''
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">{getEventTypeIcon(event.event_type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {getSeverityBadge(event.severity)}
                            {getStatusBadge(event.status)}
                            {event.alert_sent && (
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                Alert Sent
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-gray-900 truncate">{event.description}</h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>{formatTimestamp(event.detected_at)}</span>
                            {event.user_email && (
                              <span>User: {event.user_email}</span>
                            )}
                            {event.ip_address && (
                              <span>IP: {event.ip_address}</span>
                            )}
                          </div>
                          {responseTime && (
                            <div className={`text-xs mt-1 ${isSlowResponse ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                              Response time: {responseTime} minutes
                              {isSlowResponse && ' ⚠️ Exceeded 15min target'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      className="ml-4 text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getEventTypeIcon(selectedEvent.event_type)}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedEvent.description}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      {getSeverityBadge(selectedEvent.severity)}
                      {getStatusBadge(selectedEvent.status)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Event ID</div>
                  <div className="text-sm text-gray-900 font-mono">{selectedEvent.id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Event Type</div>
                  <div className="text-sm text-gray-900">{selectedEvent.event_type.replace(/_/g, ' ').toUpperCase()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Detected At</div>
                  <div className="text-sm text-gray-900">{new Date(selectedEvent.detected_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Resolved At</div>
                  <div className="text-sm text-gray-900">
                    {selectedEvent.resolved_at ? new Date(selectedEvent.resolved_at).toLocaleString() : 'Not resolved'}
                  </div>
                </div>
                {selectedEvent.user_email && (
                  <div>
                    <div className="text-sm font-medium text-gray-700">User</div>
                    <div className="text-sm text-gray-900">{selectedEvent.user_email}</div>
                  </div>
                )}
                {selectedEvent.ip_address && (
                  <div>
                    <div className="text-sm font-medium text-gray-700">IP Address</div>
                    <div className="text-sm text-gray-900 font-mono">{selectedEvent.ip_address}</div>
                  </div>
                )}
              </div>

              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Additional Details</div>
                  <pre className="p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Response Time Warning */}
      {events.some(e => calculateResponseTime(e.detected_at, e.resolved_at) > 15) && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Response Time Alert:</strong> Some incidents exceeded the 15-minute response time target.
            Review incident response procedures and consider additional automation.
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityEvents;
