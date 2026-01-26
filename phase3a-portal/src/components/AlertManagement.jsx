import React, { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, CheckCircle, XCircle,
  Clock, User, Filter, Search, RefreshCw, ExternalLink,
  ChevronDown, ChevronRight, Archive, CheckSquare, X, Activity
} from 'lucide-react';
// import { sreService } from '../services/sreService'; // TODO: Use sreService for production API calls

/**
 * AlertManagement Component - Phase 5 Component 3
 * 
 * Real-time alert monitoring and incident management for SRE teams.
 * 
 * Features:
 * - Real-time alert monitoring with auto-refresh
 * - Alert severity filtering (critical, high, medium, low, info)
 * - Incident tracking and lifecycle management
 * - Alert acknowledgment and resolution workflows
 * - Integration hooks for PagerDuty/Opsgenie
 * - Alert history and audit trail
 * - Escalation status tracking
 * - Search and filter capabilities
 * 
 * Success Criteria:
 * - Real-time updates (<5 second latency)
 * - Clear action buttons for SRE workflows
 * - Alert noise reduction through smart filtering
 * - Integration with on-call rotations
 */
const AlertManagement = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [expandedAlerts, setExpandedAlerts] = useState(new Set());
  const [selectedAlerts, setSelectedAlerts] = useState(new Set());

  // Alert statistics
  const [alertStats, setAlertStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    acknowledged: 0,
    resolved: 0
  });

  /**
   * Fetch alerts from API
   */
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      // In production, this would be a real API call to sreService
      // For now, using mock data for demonstration
      const mockAlerts = generateMockAlerts();
      
      setAlerts(mockAlerts);
      calculateAlertStats(mockAlerts);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate mock alerts for demonstration
   */
  const generateMockAlerts = () => {
    return [
      {
        id: 'ALT-001',
        title: 'High CPU usage on Lambda function: auth-v2',
        severity: 'critical',
        status: 'active',
        source: 'CloudWatch',
        service: 'Lambda',
        timestamp: new Date(Date.now() - 300000), // 5 min ago
        description: 'CPU utilization exceeded 85% threshold for 3 consecutive periods',
        affectedResources: ['auth-v2', 'api-gateway'],
        metrics: {
          current: '92%',
          threshold: '85%',
          duration: '5 minutes'
        },
        acknowledgedBy: null,
        resolvedAt: null,
        escalationLevel: 1,
        runbookUrl: '/runbooks/high-cpu-lambda',
        relatedIncidents: []
      },
      {
        id: 'ALT-002',
        title: 'Aurora database connection pool nearing capacity',
        severity: 'high',
        status: 'acknowledged',
        source: 'CloudWatch',
        service: 'Aurora',
        timestamp: new Date(Date.now() - 900000), // 15 min ago
        description: 'Database connections at 78/100 (78% utilization)',
        affectedResources: ['aurora-primary', 'api-gateway'],
        metrics: {
          current: '78 connections',
          threshold: '80 connections',
          duration: '15 minutes'
        },
        acknowledgedBy: 'john.doe@example.com',
        acknowledgedAt: new Date(Date.now() - 600000),
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/database-connections',
        relatedIncidents: ['INC-2024-001']
      },
      {
        id: 'ALT-003',
        title: 'DynamoDB write throttling detected',
        severity: 'high',
        status: 'active',
        source: 'CloudWatch',
        service: 'DynamoDB',
        timestamp: new Date(Date.now() - 600000), // 10 min ago
        description: 'Write capacity exceeded for table: customer_metrics',
        affectedResources: ['customer_metrics', 'billing-worker'],
        metrics: {
          current: '520 WCU',
          threshold: '500 WCU',
          duration: '10 minutes'
        },
        acknowledgedBy: null,
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/dynamodb-throttling',
        relatedIncidents: []
      },
      {
        id: 'ALT-004',
        title: 'API Gateway error rate spike',
        severity: 'medium',
        status: 'active',
        source: 'CloudWatch',
        service: 'API Gateway',
        timestamp: new Date(Date.now() - 1200000), // 20 min ago
        description: '5xx errors increased to 2.3% (threshold: 1%)',
        affectedResources: ['api-gateway', 'lambda-functions'],
        metrics: {
          current: '2.3%',
          threshold: '1.0%',
          duration: '20 minutes'
        },
        acknowledgedBy: null,
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/api-errors',
        relatedIncidents: []
      },
      {
        id: 'ALT-005',
        title: 'ElastiCache memory usage high',
        severity: 'medium',
        status: 'acknowledged',
        source: 'CloudWatch',
        service: 'ElastiCache',
        timestamp: new Date(Date.now() - 1800000), // 30 min ago
        description: 'Memory usage at 82% on cache cluster',
        affectedResources: ['redis-cluster'],
        metrics: {
          current: '82%',
          threshold: '80%',
          duration: '30 minutes'
        },
        acknowledgedBy: 'jane.smith@example.com',
        acknowledgedAt: new Date(Date.now() - 900000),
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/cache-memory',
        relatedIncidents: []
      },
      {
        id: 'ALT-006',
        title: 'Lambda cold starts increased',
        severity: 'low',
        status: 'active',
        source: 'X-Ray',
        service: 'Lambda',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        description: 'Cold start percentage increased to 4.2% (baseline: 2.5%)',
        affectedResources: ['lambda-functions'],
        metrics: {
          current: '4.2%',
          threshold: '3.0%',
          duration: '1 hour'
        },
        acknowledgedBy: null,
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/lambda-cold-starts',
        relatedIncidents: []
      },
      {
        id: 'ALT-007',
        title: 'Deployment pipeline failure: frontend',
        severity: 'high',
        status: 'resolved',
        source: 'CodePipeline',
        service: 'Deployment',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        description: 'Build step failed due to dependency conflict',
        affectedResources: ['frontend-pipeline'],
        metrics: {
          failedStep: 'Build',
          error: 'npm ERR! peer dependency',
          duration: '45 seconds'
        },
        acknowledgedBy: 'deploy-bot@example.com',
        acknowledgedAt: new Date(Date.now() - 6000000),
        resolvedAt: new Date(Date.now() - 5400000),
        resolvedBy: 'deploy-bot@example.com',
        escalationLevel: 0,
        runbookUrl: '/runbooks/pipeline-failures',
        relatedIncidents: []
      },
      {
        id: 'ALT-008',
        title: 'S3 bucket nearing quota limit',
        severity: 'info',
        status: 'active',
        source: 'AWS Budgets',
        service: 'S3',
        timestamp: new Date(Date.now() - 86400000), // 24 hours ago
        description: 'Bucket size at 4.2TB (quota: 5TB)',
        affectedResources: ['securebase-audit-logs'],
        metrics: {
          current: '4.2TB',
          threshold: '4.5TB',
          utilization: '84%'
        },
        acknowledgedBy: null,
        resolvedAt: null,
        escalationLevel: 0,
        runbookUrl: '/runbooks/s3-quota',
        relatedIncidents: []
      }
    ];
  };

  /**
   * Calculate alert statistics
   */
  const calculateAlertStats = (alertList) => {
    const stats = {
      total: alertList.length,
      critical: alertList.filter(a => a.severity === 'critical').length,
      high: alertList.filter(a => a.severity === 'high').length,
      medium: alertList.filter(a => a.severity === 'medium').length,
      low: alertList.filter(a => a.severity === 'low').length,
      info: alertList.filter(a => a.severity === 'info').length,
      acknowledged: alertList.filter(a => a.status === 'acknowledged').length,
      resolved: alertList.filter(a => a.status === 'resolved').length
    };
    setAlertStats(stats);
  };

  /**
   * Filter alerts based on search and filters
   */
  const getFilteredAlerts = () => {
    return alerts.filter(alert => {
      // Search filter
      if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !alert.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !alert.service.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && alert.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  };

  /**
   * Alert action handlers
   */
  const handleAcknowledge = async (alertId) => {
    try {
      // In production, call sreService.acknowledgeAlert(alertId)
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'acknowledged',
                acknowledgedBy: 'current.user@example.com',
                acknowledgedAt: new Date()
              }
            : alert
        )
      );
      console.log(`Acknowledged alert: ${alertId}`);
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      // In production, call sreService.resolveAlert(alertId)
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedBy: 'current.user@example.com'
              }
            : alert
        )
      );
      console.log(`Resolved alert: ${alertId}`);
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleEscalate = async (alertId) => {
    try {
      // In production, call sreService.escalateAlert(alertId)
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? { ...alert, escalationLevel: alert.escalationLevel + 1 }
            : alert
        )
      );
      console.log(`Escalated alert: ${alertId}`);
    } catch (error) {
      console.error('Error escalating alert:', error);
    }
  };

  const toggleAlertExpansion = (alertId) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const toggleAlertSelection = (alertId) => {
    setSelectedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const handleBulkAcknowledge = async () => {
    for (const alertId of selectedAlerts) {
      await handleAcknowledge(alertId);
    }
    setSelectedAlerts(new Set());
  };

  const handleBulkResolve = async () => {
    for (const alertId of selectedAlerts) {
      await handleResolve(alertId);
    }
    setSelectedAlerts(new Set());
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchAlerts();

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchAlerts, 30000); // 30 second refresh
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  /**
   * Helper functions
   */
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'info':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Bell className="w-5 h-5 text-blue-600" />;
      case 'info':
        return <Bell className="w-5 h-5 text-gray-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (alert) => {
    if (alert.status === 'resolved') {
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center">
        <CheckCircle className="w-3 h-3 mr-1" />
        Resolved
      </span>;
    }
    if (alert.status === 'acknowledged') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center">
        <CheckSquare className="w-3 h-3 mr-1" />
        Acknowledged
      </span>;
    }
    return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Active
    </span>;
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Bell className="w-8 h-8 mr-3 text-blue-600" />
              Alert Management
            </h1>
            <p className="text-gray-600 mt-1">Real-time monitoring and incident response</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 inline mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={fetchAlerts}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Refresh Now
            </button>
          </div>
        </div>

        {/* Alert Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{alertStats.total}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">{alertStats.critical}</div>
            <div className="text-xs text-red-700">Critical</div>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-4 text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{alertStats.high}</div>
            <div className="text-xs text-orange-700">High</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 text-center border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{alertStats.medium}</div>
            <div className="text-xs text-yellow-700">Medium</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{alertStats.low}</div>
            <div className="text-xs text-blue-700">Low</div>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-gray-600">{alertStats.info}</div>
            <div className="text-xs text-gray-700">Info</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{alertStats.acknowledged}</div>
            <div className="text-xs text-blue-700">Acknowledged</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{alertStats.resolved}</div>
            <div className="text-xs text-green-700">Resolved</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search alerts by title, description, or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedAlerts.size > 0 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-800">
              {selectedAlerts.size} alert{selectedAlerts.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleBulkAcknowledge}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Acknowledge Selected
              </button>
              <button
                onClick={handleBulkResolve}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Resolve Selected
              </button>
              <button
                onClick={() => setSelectedAlerts(new Set())}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <p className="text-gray-600">No alerts found matching your filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg shadow border-l-4 ${
                alert.severity === 'critical' ? 'border-red-500' :
                alert.severity === 'high' ? 'border-orange-500' :
                alert.severity === 'medium' ? 'border-yellow-500' :
                alert.severity === 'low' ? 'border-blue-500' :
                'border-gray-500'
              }`}
            >
              {/* Alert Header */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedAlerts.has(alert.id)}
                      onChange={() => toggleAlertSelection(alert.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getSeverityIcon(alert.severity)}
                        <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {getStatusBadge(alert)}
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{alert.description}</p>

                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimestamp(alert.timestamp)}
                        </span>
                        <span className="flex items-center">
                          <Activity className="w-3 h-3 mr-1" />
                          {alert.service}
                        </span>
                        {alert.acknowledgedBy && (
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            Ack by {alert.acknowledgedBy.split('@')[0]}
                          </span>
                        )}
                        {alert.escalationLevel > 0 && (
                          <span className="flex items-center text-red-600">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Escalation Level {alert.escalationLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleAlertExpansion(alert.id)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    {expandedAlerts.has(alert.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Alert Actions */}
                <div className="flex items-center space-x-2 mt-3">
                  {alert.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Resolve
                      </button>
                    </>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleEscalate(alert.id)}
                      className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                    >
                      Escalate
                    </button>
                  )}
                  {alert.runbookUrl && (
                    <a
                      href={alert.runbookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors flex items-center"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Runbook
                    </a>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedAlerts.has(alert.id) && (
                <div className="px-4 pb-4 border-t border-gray-200">
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Affected Resources */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Affected Resources</h4>
                      <div className="space-y-1">
                        {alert.affectedResources.map((resource, idx) => (
                          <div key={idx} className="text-sm bg-gray-50 px-2 py-1 rounded">
                            {resource}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Metrics</h4>
                      <div className="space-y-1">
                        {Object.entries(alert.metrics).map(([key, value]) => (
                          <div key={key} className="text-sm flex justify-between">
                            <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mt-4">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Timeline</h4>
                    <div className="space-y-2">
                      <div className="text-sm flex items-center text-gray-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                        Alert triggered: {alert.timestamp.toLocaleString()}
                      </div>
                      {alert.acknowledgedAt && (
                        <div className="text-sm flex items-center text-gray-600">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          Acknowledged by {alert.acknowledgedBy}: {alert.acknowledgedAt.toLocaleString()}
                        </div>
                      )}
                      {alert.resolvedAt && (
                        <div className="text-sm flex items-center text-gray-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          Resolved by {alert.resolvedBy}: {alert.resolvedAt.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Related Incidents */}
                  {alert.relatedIncidents && alert.relatedIncidents.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Related Incidents</h4>
                      <div className="space-y-1">
                        {alert.relatedIncidents.map((incident, idx) => (
                          <a
                            key={idx}
                            href={`/incidents/${incident}`}
                            className="text-sm text-blue-600 hover:underline block"
                          >
                            {incident}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertManagement;
