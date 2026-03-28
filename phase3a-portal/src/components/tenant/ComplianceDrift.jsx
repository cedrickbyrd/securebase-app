import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  Filter,
  Calendar,
  Shield,
  XCircle
} from 'lucide-react';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

/**
 * ComplianceDrift Component - Phase 5.2
 * 
 * Interactive timeline showing compliance drift detection
 * Features:
 * - 90-day timeline visualization with drift events
 * - Color-coded drift event cards
 * - Filters by framework, severity, status, date range
 * - Drift analytics (MTTR, frequency, top drifting controls)
 * - Root cause analysis and remediation tracking
 */
const ComplianceDrift = () => {
  // State management
  const [driftEvents, setDriftEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    framework: 'all',
    severity: 'all',
    status: 'all',
    dateRange: '90d'
  });
  const [loading, setLoading] = useState(true);
  const [complianceHistory, setComplianceHistory] = useState([]);

  // Generate date labels for 90 days
  const generateDateLabels = (days) => {
    const labels = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
  };

  // Calculate Mean Time to Resolve (MTTR)
  const calculateMTTR = (events) => {
    const resolvedEvents = events.filter(e => e.status === 'resolved' && e.resolutionTimestamp);
    if (resolvedEvents.length === 0) return 0;
    
    const totalResolutionTime = resolvedEvents.reduce((sum, event) => {
      const detectionTime = new Date(event.detectionTimestamp).getTime();
      const resolutionTime = new Date(event.resolutionTimestamp).getTime();
      return sum + (resolutionTime - detectionTime);
    }, 0);
    
    const avgMs = totalResolutionTime / resolvedEvents.length;
    const avgHours = avgMs / (1000 * 60 * 60);
    return Math.round(avgHours * 10) / 10; // Round to 1 decimal
  };

  // Calculate drift frequency by control category
  const calculateDriftFrequency = (events) => {
    const categoryCounts = {};
    events.forEach(event => {
      const category = event.controlCategory || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  };

  // Get top drifting controls
  const getTopDriftingControls = (events, limit = 10) => {
    const controlCounts = {};
    events.forEach(event => {
      const key = `${event.controlId}: ${event.controlName}`;
      controlCounts[key] = (controlCounts[key] || 0) + 1;
    });
    return Object.entries(controlCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([control, count]) => ({ control, count }));
  };

  // Data fetching function with useCallback pattern
  const fetchDriftData = useCallback(async () => {
    setLoading(true);
    try {
      // Future API endpoint: GET /tenant/drift-events?timeRange={90d}&severity={severity}
      // For now, use mock data
      const mockComplianceHistory = [];
      const mockEvents = [];
      const today = new Date();
      
      // Generate 90 days of compliance scores with drift events
      for (let i = 89; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Base score with random variation
        let score = 92 + Math.random() * 6;
        
        // Add drift events at specific points
        if (i === 67 || i === 32 || i === 15) {
          score = 87 + Math.random() * 3; // Drift to lower score
        }
        
        mockComplianceHistory.push({
          date: date.toISOString(),
          score: score
        });
      }

      // Create drift events
      const driftEventTemplates = [
        {
          id: 'drift_001',
          detectionTimestamp: new Date(today.getTime() - 67 * 24 * 60 * 60 * 1000).toISOString(),
          controlId: 'AC-2',
          controlName: 'Account Management',
          controlCategory: 'Access Control',
          framework: 'soc2',
          severity: 'critical',
          status: 'resolved',
          previousState: 'compliant',
          currentState: 'non-compliant',
          rootCause: 'Password policy weakened - minimum length reduced from 14 to 8 characters',
          remediationSteps: [
            'Restore password minimum length to 14 characters',
            'Review admin change logs for policy modifications',
            'Implement approval workflow for security policy changes'
          ],
          assignedTo: 'security@example.com',
          resolutionTimestamp: new Date(today.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString(),
          resolutionNotes: 'Password policy restored to compliant settings. Implemented approval workflow.'
        },
        {
          id: 'drift_002',
          detectionTimestamp: new Date(today.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString(),
          controlId: 'AU-2',
          controlName: 'Audit Events',
          controlCategory: 'Audit and Accountability',
          framework: 'hipaa',
          severity: 'high',
          status: 'resolved',
          previousState: 'compliant',
          currentState: 'non-compliant',
          rootCause: 'Audit log retention period changed from 7 years to 30 days',
          remediationSteps: [
            'Restore audit log retention to 7 years (2555 days)',
            'Verify existing audit logs are not deleted',
            'Lock S3 bucket retention policies'
          ],
          assignedTo: 'compliance@example.com',
          resolutionTimestamp: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          resolutionNotes: 'Retention policy restored. Implemented S3 Object Lock to prevent future changes.'
        },
        {
          id: 'drift_003',
          detectionTimestamp: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          controlId: 'IA-5',
          controlName: 'Authenticator Management',
          controlCategory: 'Identification and Authentication',
          framework: 'pci',
          severity: 'high',
          status: 'in_progress',
          previousState: 'compliant',
          currentState: 'non-compliant',
          rootCause: 'MFA disabled for privileged users in production environment',
          remediationSteps: [
            'Re-enable MFA for all privileged accounts',
            'Conduct security training for administrators',
            'Implement SCP to prevent MFA deactivation'
          ],
          assignedTo: 'admin@example.com',
          resolutionTimestamp: null,
          resolutionNotes: null
        },
        {
          id: 'drift_004',
          detectionTimestamp: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          controlId: 'SC-7',
          controlName: 'Boundary Protection',
          controlCategory: 'System and Communications Protection',
          framework: 'soc2',
          severity: 'medium',
          status: 'open',
          previousState: 'compliant',
          currentState: 'non-compliant',
          rootCause: 'Security group rule added allowing inbound SSH from 0.0.0.0/0',
          remediationSteps: [
            'Remove overly permissive security group rule',
            'Implement bastion host for SSH access',
            'Enable VPC Flow Logs for network monitoring'
          ],
          assignedTo: 'devops@example.com',
          resolutionTimestamp: null,
          resolutionNotes: null
        },
        {
          id: 'drift_005',
          detectionTimestamp: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          controlId: 'CM-2',
          controlName: 'Baseline Configuration',
          controlCategory: 'Configuration Management',
          framework: 'gdpr',
          severity: 'low',
          status: 'open',
          previousState: 'compliant',
          currentState: 'non-compliant',
          rootCause: 'Production EC2 instance launched without required encryption tags',
          remediationSteps: [
            'Add required encryption tags to EC2 instance',
            'Update launch templates with mandatory tags',
            'Implement AWS Config rule for tag compliance'
          ],
          assignedTo: 'devops@example.com',
          resolutionTimestamp: null,
          resolutionNotes: null
        }
      ];

      mockEvents.push(...driftEventTemplates);

      // Calculate analytics
      const analyticsData = {
        mttr: calculateMTTR(mockEvents),
        frequency: calculateDriftFrequency(mockEvents),
        topDriftingControls: getTopDriftingControls(mockEvents, 10)
      };

      setComplianceHistory(mockComplianceHistory);
      setDriftEvents(mockEvents);
      setFilteredEvents(mockEvents);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching drift data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDriftData();
  }, [fetchDriftData]);

  // Apply filters
  useEffect(() => {
    let filtered = [...driftEvents];

    if (filters.framework !== 'all') {
      filtered = filtered.filter(e => e.framework === filters.framework);
    }

    if (filters.severity !== 'all') {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    // Date range filter (already limited to 90d in mock data)
    setFilteredEvents(filtered);
  }, [filters, driftEvents]);

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-300';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-300';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  // Helper function to get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return { text: 'Resolved', icon: CheckCircle, color: 'bg-green-100 text-green-800' };
      case 'in_progress':
        return { text: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800' };
      case 'open':
        return { text: 'Open', icon: AlertTriangle, color: 'bg-red-100 text-red-800' };
      default:
        return { text: 'Unknown', icon: XCircle, color: 'bg-gray-100 text-gray-800' };
    }
  };

  // Timeline chart data
  const driftTimelineData = {
    labels: generateDateLabels(90),
    datasets: [
      {
        label: 'Compliance Score',
        data: complianceHistory.map(h => h.score),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: (context) => {
          // Larger points on drift event days
          const dayIndex = context.dataIndex;
          const driftDays = [15, 32, 67];
          return driftDays.includes(89 - dayIndex) ? 8 : 2;
        },
        pointBackgroundColor: (context) => {
          const dayIndex = context.dataIndex;
          const driftDays = [15, 32, 67];
          return driftDays.includes(89 - dayIndex) ? '#ef4444' : '#22c55e';
        },
        pointBorderColor: (context) => {
          const dayIndex = context.dataIndex;
          const driftDays = [15, 32, 67];
          return driftDays.includes(89 - dayIndex) ? '#dc2626' : '#16a34a';
        },
        pointBorderWidth: 2,
        pointHoverRadius: 10
      }
    ]
  };

  if (loading) {
    return (
      <div className="compliance-drift min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading drift detection data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="compliance-drift min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Compliance Drift Detection</h1>
        <p className="text-gray-600">
          Interactive timeline showing when controls drift from compliant to non-compliant state
        </p>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Framework</label>
            <select
              value={filters.framework}
              onChange={(e) => setFilters({ ...filters, framework: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Frameworks</option>
              <option value="soc2">SOC 2</option>
              <option value="hipaa">HIPAA</option>
              <option value="pci">PCI-DSS</option>
              <option value="gdpr">GDPR</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Compliance Timeline (90 Days)</h3>
        <div className="h-64">
          <Line
            data={driftTimelineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `Compliance Score: ${context.parsed.y.toFixed(1)}%`,
                    afterLabel: (context) => {
                      const dayIndex = context.dataIndex;
                      const driftDays = [15, 32, 67];
                      if (driftDays.includes(89 - dayIndex)) {
                        return '⚠️ Drift Event Detected';
                      }
                      return '';
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 80,
                  max: 100,
                  ticks: {
                    callback: (value) => value + '%'
                  }
                }
              },
              interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
              }
            }}
          />
        </div>
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600">Drift Event</span>
          </div>
        </div>
      </div>

      {/* Drift Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* MTTR */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Mean Time to Resolve</h3>
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {analytics?.mttr || 0}h
          </div>
          <p className="text-sm text-gray-600">Average time to resolve drift issues</p>
        </div>

        {/* Drift Frequency */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Drift Frequency</h3>
            <TrendingDown className="w-6 h-6 text-orange-600" />
          </div>
          <div className="space-y-2">
            {analytics?.frequency.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-sm text-gray-700">{item.category}</span>
                <span className="text-sm font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Drift Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Active Drift Events</h3>
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {filteredEvents.filter(e => e.status !== 'resolved').length}
          </div>
          <p className="text-sm text-gray-600">
            {filteredEvents.filter(e => e.status === 'resolved').length} resolved
          </p>
        </div>
      </div>

      {/* Drift Event Cards */}
      <div className="space-y-4 mb-6">
        <h3 className="text-xl font-semibold text-gray-800">Drift Events</h3>
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">No drift events match your filter criteria</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const statusBadge = getStatusBadge(event.status);
            const StatusIcon = statusBadge.icon;
            return (
              <div
                key={event.id}
                className={`bg-white rounded-lg shadow border-l-4 p-6 ${
                  event.severity === 'critical'
                    ? 'border-red-500'
                    : event.severity === 'high'
                    ? 'border-orange-500'
                    : event.severity === 'medium'
                    ? 'border-yellow-500'
                    : 'border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusBadge.text}
                      </span>
                      <span className="text-xs text-gray-500 uppercase font-semibold">
                        {event.framework}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1">
                      {event.controlId}: {event.controlName}
                    </h4>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Category:</strong> {event.controlCategory}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Detected:</strong> {new Date(event.detectionTimestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">State Transition</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        {event.previousState}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                        {event.currentState}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Assigned To</p>
                    <p className="text-sm text-gray-900">{event.assignedTo}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Root Cause Analysis</p>
                  <p className="text-sm text-gray-800">{event.rootCause}</p>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Remediation Steps</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {event.remediationSteps.map((step, idx) => (
                      <li key={idx} className="text-sm text-gray-800">{step}</li>
                    ))}
                  </ol>
                </div>

                {event.status === 'resolved' && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 mb-1">
                          Resolved on {new Date(event.resolutionTimestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-green-800">{event.resolutionNotes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {event.status !== 'resolved' && (
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                      Update Status
                    </button>
                    <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors">
                      Add Note
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Top Drifting Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Drifting Controls</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Control</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Drift Count</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.topDriftingControls.map((item, idx) => {
                const maxCount = analytics.topDriftingControls[0].count;
                const percentage = (item.count / maxCount) * 100;
                return (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">#{idx + 1}</td>
                    <td className="py-3 px-4 text-sm text-gray-800 font-medium">{item.control}</td>
                    <td className="text-right py-3 px-4 text-sm font-bold text-gray-900">
                      {item.count}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDrift;
