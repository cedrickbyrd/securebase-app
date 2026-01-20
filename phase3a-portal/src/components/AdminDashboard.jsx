import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, DollarSign, AlertTriangle, 
  TrendingUp, Server, Database, Zap, 
  Clock, CheckCircle, XCircle, Shield,
  BarChart3, PieChart, LineChart, RefreshCw
} from 'lucide-react';
import SystemHealth from './SystemHealth';
import { adminService } from '../services/adminService';

/**
 * Executive/Admin Dashboard - Phase 5 Component 1
 * 
 * Provides real-time platform-wide visibility for executives and platform administrators.
 * Features:
 * - Customer overview (active, churned, MRR, growth)
 * - API performance metrics (latency, error rates, throughput)
 * - Infrastructure health (Lambda, DynamoDB, Aurora)
 * - Security alerts and compliance violations
 * - Deployment timeline and rollback history
 * - Cost analytics and trending
 * 
 * Data Sources:
 * - CloudWatch custom metrics
 * - DynamoDB metrics tables
 * - EventBridge deployment events
 * - Security Hub findings
 */
const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Dashboard data state
  const [platformMetrics, setPlatformMetrics] = useState({
    customers: {
      total: 0,
      active: 0,
      churned: 0,
      growth: 0,
      mrr: 0
    },
    api: {
      requests: 0,
      latency_p50: 0,
      latency_p95: 0,
      latency_p99: 0,
      errorRate: 0,
      successRate: 0
    },
    infrastructure: {
      lambdaColdStarts: 0,
      lambdaErrors: 0,
      dynamodbThrottles: 0,
      auroraConnections: 0,
      cacheHitRate: 0
    },
    security: {
      criticalAlerts: 0,
      violations: 0,
      openIncidents: 0,
      complianceScore: 0
    },
    costs: {
      current: 0,
      projected: 0,
      byService: [],
      trend: 0
    },
    deployments: {
      recent: [],
      successRate: 0
    }
  });

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await adminService.getPlatformMetrics(timeRange);
      setPlatformMetrics(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboardData();
    
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchDashboardData, 30000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timeRange, autoRefresh]);

  // Manual refresh
  const handleRefresh = () => {
    fetchDashboardData();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
            <p className="text-gray-600 mt-1">Platform-wide health and performance metrics</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium ${
                autoRefresh
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-2">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>

      {/* Customer Overview */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Customer Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Total Customers"
            value={platformMetrics.customers.total}
            icon={Users}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Active Customers"
            value={platformMetrics.customers.active}
            icon={CheckCircle}
            color="green"
            trend={platformMetrics.customers.growth}
            loading={loading}
          />
          <MetricCard
            title="Churned (30d)"
            value={platformMetrics.customers.churned}
            icon={XCircle}
            color="red"
            loading={loading}
          />
          <MetricCard
            title="Monthly Recurring Revenue"
            value={`$${(platformMetrics.customers.mrr / 1000).toFixed(1)}K`}
            icon={DollarSign}
            color="purple"
            trend={platformMetrics.customers.growth}
            loading={loading}
          />
          <MetricCard
            title="Growth Rate"
            value={`${platformMetrics.customers.growth > 0 ? '+' : ''}${platformMetrics.customers.growth}%`}
            icon={TrendingUp}
            color={platformMetrics.customers.growth >= 0 ? 'green' : 'red'}
            loading={loading}
          />
        </div>
      </div>

      {/* API Performance */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          API Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <MetricCard
            title="Total Requests"
            value={platformMetrics.api.requests.toLocaleString()}
            icon={BarChart3}
            color="blue"
            subtitle={`in ${timeRange}`}
            loading={loading}
          />
          <MetricCard
            title="Latency P50"
            value={`${platformMetrics.api.latency_p50}ms`}
            icon={Zap}
            color="green"
            threshold={{ value: platformMetrics.api.latency_p50, max: 100 }}
            loading={loading}
          />
          <MetricCard
            title="Latency P95"
            value={`${platformMetrics.api.latency_p95}ms`}
            icon={Zap}
            color="yellow"
            threshold={{ value: platformMetrics.api.latency_p95, max: 500 }}
            loading={loading}
          />
          <MetricCard
            title="Latency P99"
            value={`${platformMetrics.api.latency_p99}ms`}
            icon={Zap}
            color="orange"
            threshold={{ value: platformMetrics.api.latency_p99, max: 1000 }}
            loading={loading}
          />
          <MetricCard
            title="Error Rate"
            value={`${platformMetrics.api.errorRate.toFixed(2)}%`}
            icon={AlertTriangle}
            color={platformMetrics.api.errorRate > 1 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Success Rate"
            value={`${platformMetrics.api.successRate.toFixed(2)}%`}
            icon={CheckCircle}
            color={platformMetrics.api.successRate >= 99.9 ? 'green' : 'yellow'}
            loading={loading}
          />
        </div>
      </div>

      {/* Infrastructure Health */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2" />
          Infrastructure Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Lambda Cold Starts"
            value={platformMetrics.infrastructure.lambdaColdStarts}
            icon={Zap}
            color={platformMetrics.infrastructure.lambdaColdStarts > 100 ? 'yellow' : 'green'}
            subtitle={`in ${timeRange}`}
            loading={loading}
          />
          <MetricCard
            title="Lambda Errors"
            value={platformMetrics.infrastructure.lambdaErrors}
            icon={AlertTriangle}
            color={platformMetrics.infrastructure.lambdaErrors > 10 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="DynamoDB Throttles"
            value={platformMetrics.infrastructure.dynamodbThrottles}
            icon={Database}
            color={platformMetrics.infrastructure.dynamodbThrottles > 0 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Aurora Connections"
            value={platformMetrics.infrastructure.auroraConnections}
            icon={Database}
            color="blue"
            subtitle="Active connections"
            loading={loading}
          />
          <MetricCard
            title="Cache Hit Rate"
            value={`${platformMetrics.infrastructure.cacheHitRate.toFixed(1)}%`}
            icon={Activity}
            color={platformMetrics.infrastructure.cacheHitRate >= 70 ? 'green' : 'yellow'}
            loading={loading}
          />
        </div>
      </div>

      {/* Security & Compliance */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Security & Compliance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Critical Alerts"
            value={platformMetrics.security.criticalAlerts}
            icon={AlertTriangle}
            color={platformMetrics.security.criticalAlerts > 0 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Policy Violations"
            value={platformMetrics.security.violations}
            icon={XCircle}
            color={platformMetrics.security.violations > 0 ? 'yellow' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Open Incidents"
            value={platformMetrics.security.openIncidents}
            icon={AlertTriangle}
            color={platformMetrics.security.openIncidents > 0 ? 'red' : 'green'}
            loading={loading}
          />
          <MetricCard
            title="Compliance Score"
            value={`${platformMetrics.security.complianceScore}%`}
            icon={Shield}
            color={platformMetrics.security.complianceScore >= 95 ? 'green' : 'yellow'}
            loading={loading}
          />
        </div>
      </div>

      {/* Cost Analytics */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Cost Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Current Month"
            value={`$${(platformMetrics.costs.current / 1000).toFixed(2)}K`}
            icon={DollarSign}
            color="blue"
            loading={loading}
          />
          <MetricCard
            title="Projected Month-End"
            value={`$${(platformMetrics.costs.projected / 1000).toFixed(2)}K`}
            icon={TrendingUp}
            color="purple"
            trend={platformMetrics.costs.trend}
            loading={loading}
          />
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-4">Top Cost Drivers</h3>
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {platformMetrics.costs.byService.slice(0, 5).map((service, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{service.name}</span>
                    <span className="font-medium">${service.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Deployments */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Recent Deployments
        </h2>
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {platformMetrics.deployments.recent.map((deployment, idx) => (
                  <DeploymentRow key={idx} deployment={deployment} />
                ))}
                {platformMetrics.deployments.recent.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No recent deployments</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Component */}
      <SystemHealth timeRange={timeRange} loading={loading} />
    </div>
  );
};

/**
 * MetricCard Component
 * Displays a single metric with icon, value, and optional trend/threshold
 */
const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue', 
  trend, 
  subtitle,
  threshold,
  loading 
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  // Check threshold breach
  const thresholdBreached = threshold && threshold.value > threshold.max;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm font-medium ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className={`w-4 h-4 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      
      {loading ? (
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
      ) : (
        <>
          <p className={`text-2xl font-bold ${thresholdBreached ? 'text-red-600' : 'text-gray-900'}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {thresholdBreached && (
            <p className="text-xs text-red-600 mt-1">
              ⚠️ Exceeds threshold ({threshold.max})
            </p>
          )}
        </>
      )}
    </div>
  );
};

/**
 * DeploymentRow Component
 * Displays a single deployment in the timeline
 */
const DeploymentRow = ({ deployment }) => {
  const statusColors = {
    success: 'text-green-600 bg-green-100',
    failed: 'text-red-600 bg-red-100',
    in_progress: 'text-blue-600 bg-blue-100',
    rolled_back: 'text-yellow-600 bg-yellow-100'
  };

  const statusIcons = {
    success: CheckCircle,
    failed: XCircle,
    in_progress: RefreshCw,
    rolled_back: AlertTriangle
  };

  const StatusIcon = statusIcons[deployment.status] || CheckCircle;

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div className="flex items-center space-x-4">
        <div className={`p-2 rounded-lg ${statusColors[deployment.status]}`}>
          <StatusIcon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-medium text-gray-900">{deployment.service}</h4>
          <p className="text-sm text-gray-600">{deployment.version}</p>
        </div>
      </div>
      
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{deployment.environment}</p>
        <p className="text-xs text-gray-500">
          {new Date(deployment.timestamp).toLocaleString()}
        </p>
      </div>
      
      <div className="text-right">
        <p className="text-sm text-gray-600">by {deployment.deployer}</p>
        <p className="text-xs text-gray-500">{deployment.duration}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
