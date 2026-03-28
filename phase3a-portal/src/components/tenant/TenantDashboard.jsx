import React, { useState, useEffect, useCallback } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, ArcElement, Filler, Title, Tooltip, Legend 
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  DollarSign, Activity, Database, Server, Shield, Clock,
  FileText, Users, Zap, HardDrive
} from 'lucide-react';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

/**
 * TenantDashboard Component - Phase 5.2
 * 
 * Customer-facing dashboard showing:
 * - Real-time compliance status and scores
 * - Usage metrics (API calls, storage, compute)
 * - Cost breakdown by service
 * - Configuration audit trail
 * - Active alerts and violations
 * - Drift detection timeline
 * 
 * Patterns from AdminDashboard.jsx and SystemHealth.jsx:
 * - useCallback for fetch functions to prevent cascading renders
 * - 60-second polling for real-time updates
 * - Card-based layout with Tailwind CSS
 * - Chart.js for visualizations
 */
const TenantDashboard = () => {
  // State management
  const [timeRange, setTimeRange] = useState('30d'); // Options: 7d, 30d, 90d
  const [complianceData, setComplianceData] = useState(null);
  const [usageMetrics, setUsageMetrics] = useState(null);
  const [costData, setCostData] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Data fetching function with useCallback pattern (from SystemHealth.jsx)
  const fetchTenantMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Future API endpoint: GET /tenant/metrics?timeRange={timeRange}
      // For now, use mock data (follow AdminDashboard pattern)
      const mockData = {
        compliance: {
          score: 94.5,
          violations: { critical: 2, high: 5, medium: 12, low: 8 },
          frameworks: {
            soc2: { passed: 78, total: 82, percentage: 95.1 },
            hipaa: { passed: 156, total: 164, percentage: 95.1 },
            pci: { passed: 291, total: 315, percentage: 92.4 },
            gdpr: { passed: 45, total: 50, percentage: 90.0 }
          },
          trend: [92.1, 93.4, 92.8, 94.2, 94.5], // Last 5 days
          nextAudit: '2026-05-15',
          lastAssessment: '2026-03-01'
        },
        usage: {
          apiCalls: {
            total: 45320,
            byDay: [1200, 1450, 1380, 1520, 1490, 1610, 1550],
            topEndpoints: [
              { name: '/api/compliance/check', calls: 12500 },
              { name: '/api/evidence/upload', calls: 8200 },
              { name: '/api/reports/generate', calls: 6800 },
              { name: '/api/audit/log', calls: 5400 },
              { name: '/api/users/list', calls: 3200 }
            ],
            successRate: 99.82
          },
          storage: {
            documents: 1250,
            evidenceGB: 125.4,
            logsGB: 45.2
          },
          compute: {
            lambdaHours: 125.5,
            dbQueryTime: 3456, // seconds
            avgResponseMs: 145
          }
        },
        costs: {
          currentMonth: 1245.67,
          forecasted: 1580.34,
          breakdown: {
            apiGateway: 125.34,
            lambda: 456.78,
            database: 523.12,
            storage: 98.45,
            dataTransfer: 41.98
          },
          planLimits: {
            apiCalls: { used: 45000, limit: 100000 },
            storageGB: { used: 125, limit: 500 },
            userSeats: { used: 8, limit: 10 }
          },
          trend: [1150, 1180, 1200, 1220, 1245.67]
        },
        auditTrail: [
          {
            id: 'evt_001',
            timestamp: '2026-03-28T14:30:00Z',
            changedBy: 'admin@example.com',
            resourceType: 'Policy',
            resourceId: 'pol_password_policy',
            action: 'Updated',
            status: 'success',
            changes: { field: 'min_length', oldValue: 12, newValue: 14 }
          },
          {
            id: 'evt_002',
            timestamp: '2026-03-28T12:15:00Z',
            changedBy: 'security@example.com',
            resourceType: 'Role',
            resourceId: 'role_admin',
            action: 'Created',
            status: 'success',
            changes: { field: 'permissions', oldValue: null, newValue: ['read', 'write', 'admin'] }
          },
          {
            id: 'evt_003',
            timestamp: '2026-03-28T10:45:00Z',
            changedBy: 'user@example.com',
            resourceType: 'API_Key',
            resourceId: 'key_abc123',
            action: 'Deleted',
            status: 'success',
            changes: { field: 'status', oldValue: 'active', newValue: 'deleted' }
          }
        ],
        alerts: [
          {
            id: 'alert_001',
            severity: 'critical',
            title: 'Critical Compliance Violation Detected',
            description: 'Password policy weakened below SOC 2 requirements',
            affectedResources: ['Password Policy', 'User Management'],
            recommendedAction: 'Restore password complexity requirements to meet SOC 2 Type II standards',
            timestamp: '2026-03-28T14:30:00Z',
            status: 'active'
          },
          {
            id: 'alert_002',
            severity: 'high',
            title: 'API Usage Approaching Limit',
            description: 'API calls at 85% of monthly quota with 10 days remaining',
            affectedResources: ['API Gateway'],
            recommendedAction: 'Consider upgrading to higher tier or optimizing API usage',
            timestamp: '2026-03-28T09:15:00Z',
            status: 'active'
          },
          {
            id: 'alert_003',
            severity: 'medium',
            title: 'Storage Capacity Warning',
            description: 'Evidence storage at 78% capacity',
            affectedResources: ['S3 Buckets'],
            recommendedAction: 'Archive old evidence files or increase storage limit',
            timestamp: '2026-03-27T16:20:00Z',
            status: 'acknowledged'
          }
        ]
      };
      
      setComplianceData(mockData.compliance);
      setUsageMetrics(mockData.usage);
      setCostData(mockData.costs);
      setAuditTrail(mockData.auditTrail);
      setAlerts(mockData.alerts);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching tenant metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchTenantMetrics();
    const interval = setInterval(fetchTenantMetrics, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, [fetchTenantMetrics]);

  // Helper function to format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Helper function to get compliance score color
  const getComplianceColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Helper function to get severity badge color
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
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Chart configurations
  const complianceTrendData = complianceData ? {
    labels: ['5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Today'],
    datasets: [
      {
        label: 'Compliance Score',
        data: complianceData.trend,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  } : null;

  const apiCallsData = usageMetrics ? {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'API Calls',
        data: usageMetrics.apiCalls.byDay,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      }
    ]
  } : null;

  const storageData = usageMetrics ? {
    labels: ['Documents', 'Evidence Files', 'Audit Logs'],
    datasets: [
      {
        data: [
          usageMetrics.storage.documents,
          usageMetrics.storage.evidenceGB,
          usageMetrics.storage.logsGB
        ],
        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899'],
        borderWidth: 0
      }
    ]
  } : null;

  const costBreakdownData = costData ? {
    labels: ['API Gateway', 'Lambda', 'Database', 'Storage', 'Data Transfer'],
    datasets: [
      {
        label: 'Cost ($)',
        data: [
          costData.breakdown.apiGateway,
          costData.breakdown.lambda,
          costData.breakdown.database,
          costData.breakdown.storage,
          costData.breakdown.dataTransfer
        ],
        backgroundColor: 'rgba(147, 51, 234, 0.6)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1
      }
    ]
  } : null;

  const costTrendData = costData ? {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Current'],
    datasets: [
      {
        label: 'Monthly Spend',
        data: costData.trend,
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4
      }
    ]
  } : null;

  if (loading && !complianceData) {
    return (
      <div className="tenant-dashboard min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-dashboard min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Customer Dashboard</h1>
          <p className="text-gray-600">Real-time compliance, usage & cost insights</p>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button 
            onClick={fetchTenantMetrics}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Export Report
          </button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 gap-6">
        {/* Top Row: Compliance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compliance Score Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Compliance Score</h3>
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center justify-center mb-4">
              <div className={`text-5xl font-bold ${getComplianceColor(complianceData?.score || 0)}`}>
                {complianceData?.score || 0}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Next Audit:</span>
                <span className="font-medium">{complianceData?.nextAudit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Assessment:</span>
                <span className="font-medium">{complianceData?.lastAssessment}</span>
              </div>
            </div>
          </div>

          {/* Violations Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Active Violations</h3>
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-red-600 font-medium">Critical</span>
                <span className="text-2xl font-bold text-red-600">
                  {complianceData?.violations.critical || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-orange-600 font-medium">High</span>
                <span className="text-2xl font-bold text-orange-600">
                  {complianceData?.violations.high || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-600 font-medium">Medium</span>
                <span className="text-2xl font-bold text-yellow-600">
                  {complianceData?.violations.medium || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-600 font-medium">Low</span>
                <span className="text-2xl font-bold text-blue-600">
                  {complianceData?.violations.low || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Compliance Trend</h3>
            {complianceTrendData && (
              <Line 
                data={complianceTrendData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `Score: ${context.parsed.y}%`
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
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Framework Compliance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {complianceData?.frameworks && Object.entries(complianceData.frameworks).map(([key, framework]) => (
            <div key={key} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700 uppercase">{key}</h4>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-2">
                {framework.passed}/{framework.total}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${framework.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {framework.percentage.toFixed(1)}% compliant
              </div>
            </div>
          ))}
        </div>

        {/* Usage Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* API Calls */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">API Calls This Month</h3>
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatNumber(usageMetrics?.apiCalls.total || 0)}
            </div>
            <div className="text-sm text-gray-600 mb-4">
              Success rate: {usageMetrics?.apiCalls.successRate}%
            </div>
            {apiCallsData && (
              <Bar 
                data={apiCallsData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } }
                }}
              />
            )}
          </div>

          {/* Storage */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Data Stored</h3>
              <HardDrive className="w-6 h-6 text-purple-600" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Documents:</span>
                <span className="font-medium">{usageMetrics?.storage.documents || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Evidence:</span>
                <span className="font-medium">{usageMetrics?.storage.evidenceGB || 0} GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Logs:</span>
                <span className="font-medium">{usageMetrics?.storage.logsGB || 0} GB</span>
              </div>
            </div>
            {storageData && (
              <Doughnut 
                data={storageData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { font: { size: 10 } }
                    }
                  }
                }}
              />
            )}
          </div>

          {/* Compute Hours */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Compute Hours</h3>
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Lambda Execution</span>
                  <span className="font-mono">{usageMetrics?.compute.lambdaHours.toFixed(1)}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>DB Query Time</span>
                  <span className="font-mono">{usageMetrics?.compute.dbQueryTime}s</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Avg Response Time</span>
                  <span className="font-mono">{usageMetrics?.compute.avgResponseMs}ms</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Breakdown Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Month Spend */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Current Month Spend</h3>
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {formatCurrency(costData?.currentMonth || 0)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">
                Forecasted: {formatCurrency(costData?.forecasted || 0)}
              </span>
            </div>
            {costTrendData && (
              <div className="mt-4">
                <Line 
                  data={costTrendData}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: false } }
                  }}
                />
              </div>
            )}
          </div>

          {/* Cost by Service */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cost by Service</h3>
            {costBreakdownData && (
              <Bar 
                data={costBreakdownData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => formatCurrency(context.parsed.x)
                      }
                    }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => '$' + value
                      }
                    }
                  }
                }}
              />
            )}
          </div>

          {/* Usage vs Plan Limits */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Usage vs Plan Limits</h3>
            <div className="space-y-4">
              {costData?.planLimits && Object.entries(costData.planLimits).map(([key, limit]) => {
                const percentage = (limit.used / limit.limit) * 100;
                const isNearLimit = percentage >= 80;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className={`font-mono ${isNearLimit ? 'text-orange-600' : 'text-gray-700'}`}>
                        {formatNumber(limit.used)} / {formatNumber(limit.limit)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          isNearLimit ? 'bg-orange-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {percentage.toFixed(1)}% used
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Endpoints */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top API Endpoints</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Endpoint</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Calls</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {usageMetrics?.apiCalls.topEndpoints.map((endpoint, idx) => {
                  const percentage = (endpoint.calls / usageMetrics.apiCalls.total) * 100;
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 font-mono">{endpoint.name}</td>
                      <td className="text-right py-3 px-4 text-sm font-medium text-gray-900">
                        {formatNumber(endpoint.calls)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
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

        {/* Configuration Audit Trail */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Configuration Audit Trail</h3>
            <FileText className="w-6 h-6 text-gray-600" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Timestamp</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Changed By</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Resource</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((event) => (
                  <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800">{event.changedBy}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800">{event.resourceType}</span>
                        <span className="text-xs text-gray-500 font-mono">{event.resourceId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800">{event.action}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        event.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Active Alerts</h3>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              {alerts.filter(a => a.status === 'active').length} Active
            </span>
          </div>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 p-4 rounded-r-lg ${
                  alert.severity === 'critical'
                    ? 'border-red-500 bg-red-50'
                    : alert.severity === 'high'
                    ? 'border-orange-500 bg-orange-50'
                    : alert.severity === 'medium'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{alert.title}</h4>
                    <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                    <div className="text-xs text-gray-600 mb-2">
                      <strong>Affected:</strong> {alert.affectedResources.join(', ')}
                    </div>
                    <div className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200">
                      <strong>Recommended Action:</strong> {alert.recommendedAction}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                      View Details
                    </button>
                    {alert.status === 'active' && (
                      <button className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
