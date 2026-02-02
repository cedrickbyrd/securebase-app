import React, { useState, useEffect } from 'react';
import {
  Server, Database, Zap, Activity, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Clock, BarChart3, Cpu, HardDrive,
  Network, Gauge, Timer, Thermometer, DollarSign, RefreshCw,
  Cloud, Box, Layers, GitBranch, Play, CheckSquare, XCircle
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
// import { sreService } from '../services/sreService'; // TODO: Use sreService for production API calls

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * SRE/Operations Dashboard - Phase 5 Component 3
 * 
 * Provides on-call engineers (SREs) with real-time observability into:
 * - Infrastructure health (CPU, memory, disk, network)
 * - Deployment pipeline status
 * - Auto-scaling metrics (current vs desired capacity)
 * - Database performance (query latency, connection pool)
 * - Cache hit rates (Redis/ElastiCache)
 * - Error rates by service
 * - Lambda performance metrics (cold starts, duration, throttling)
 * - Cost per service (with trend analysis)
 * 
 * Data Sources:
 * - CloudWatch metrics and logs
 * - AWS X-Ray traces
 * - Custom metrics from sreService
 * - PagerDuty/Opsgenie alerts
 * 
 * Success Criteria:
 * - Dashboard load time <2s
 * - Real-time updates (30s refresh)
 * - Integration with on-call workflows
 */
const SREDashboard = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Infrastructure health state
  const [infrastructureMetrics, setInfrastructureMetrics] = useState({
    cpu: { current: 0, average: 0, max: 0, trend: [] },
    memory: { current: 0, average: 0, max: 0, trend: [] },
    disk: { current: 0, average: 0, max: 0, trend: [] },
    network: { in: 0, out: 0, trend: [] }
  });

  // Deployment pipeline state
  const [deploymentMetrics, setDeploymentMetrics] = useState({
    recent: [],
    successRate: 0,
    averageDuration: 0,
    inProgress: 0
  });

  // Auto-scaling state
  const [scalingMetrics, setScalingMetrics] = useState({
    lambda: { current: 0, desired: 0, max: 0, utilization: 0 },
    ecs: { current: 0, desired: 0, max: 0, utilization: 0 },
    apiGateway: { requests: 0, throttles: 0 }
  });

  // Database performance state
  const [databaseMetrics, setDatabaseMetrics] = useState({
    aurora: {
      queryLatency: { p50: 0, p95: 0, p99: 0 },
      connections: { current: 0, max: 0, utilization: 0 },
      iops: { read: 0, write: 0 },
      replicationLag: 0
    },
    dynamodb: {
      readCapacity: { consumed: 0, provisioned: 0 },
      writeCapacity: { consumed: 0, provisioned: 0 },
      throttles: { read: 0, write: 0 },
      latency: { get: 0, put: 0, query: 0 }
    }
  });

  // Cache metrics state
  const [cacheMetrics, setCacheMetrics] = useState({
    redis: {
      hitRate: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      connections: 0,
      memoryUsage: 0
    }
  });

  // Error rates state
  const [errorMetrics, setErrorMetrics] = useState({
    byService: [],
    total: 0,
    rate: 0,
    trend: []
  });

  // Lambda performance state
  const [lambdaMetrics, setLambdaMetrics] = useState({
    coldStarts: { count: 0, percentage: 0, avgDuration: 0 },
    duration: { p50: 0, p95: 0, p99: 0, max: 0 },
    throttles: { count: 0, rate: 0 },
    concurrency: { current: 0, max: 0, utilization: 0 },
    errors: { count: 0, rate: 0 },
    byFunction: []
  });

  // Cost metrics state
  const [costMetrics, setCostMetrics] = useState({
    byService: [],
    total: 0,
    trend: { direction: 'up', percentage: 0 },
    forecast: 0
  });

  /**
   * Fetch all SRE dashboard metrics
   */
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // In production, these would be real API calls to sreService
      // For now, using mock data for demonstration
      await Promise.all([
        fetchInfrastructureMetrics(),
        fetchDeploymentMetrics(),
        fetchScalingMetrics(),
        fetchDatabaseMetrics(),
        fetchCacheMetrics(),
        fetchErrorMetrics(),
        fetchLambdaMetrics(),
        fetchCostMetrics()
      ]);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching SRE dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mock data fetching functions
   * In production, replace with actual sreService API calls
   */
  const fetchInfrastructureMetrics = async () => {
    // Mock infrastructure data
    const mockTrend = Array.from({ length: 12 }, (_, i) => ({
      time: new Date(Date.now() - (11 - i) * 5 * 60000).toISOString(),
      value: 45 + Math.random() * 20
    }));

    setInfrastructureMetrics({
      cpu: { current: 58.4, average: 52.1, max: 73.2, trend: mockTrend },
      memory: { current: 64.2, average: 61.5, max: 78.9, trend: mockTrend.map(t => ({ ...t, value: t.value + 10 })) },
      disk: { current: 42.1, average: 38.7, max: 55.3, trend: mockTrend.map(t => ({ ...t, value: t.value - 5 })) },
      network: { in: 125.4, out: 87.3, trend: mockTrend }
    });
  };

  const fetchDeploymentMetrics = async () => {
    setDeploymentMetrics({
      recent: [
        { id: 'dep-001', service: 'api-gateway', status: 'success', duration: 245, timestamp: new Date(Date.now() - 3600000) },
        { id: 'dep-002', service: 'lambda-auth', status: 'success', duration: 180, timestamp: new Date(Date.now() - 7200000) },
        { id: 'dep-003', service: 'frontend', status: 'in-progress', duration: 0, timestamp: new Date() },
        { id: 'dep-004', service: 'database-migration', status: 'success', duration: 420, timestamp: new Date(Date.now() - 14400000) },
        { id: 'dep-005', service: 'monitoring', status: 'failed', duration: 95, timestamp: new Date(Date.now() - 21600000) }
      ],
      successRate: 95.2,
      averageDuration: 234,
      inProgress: 1
    });
  };

  const fetchScalingMetrics = async () => {
    setScalingMetrics({
      lambda: { current: 42, desired: 50, max: 100, utilization: 84.0 },
      ecs: { current: 8, desired: 10, max: 20, utilization: 80.0 },
      apiGateway: { requests: 15420, throttles: 23 }
    });
  };

  const fetchDatabaseMetrics = async () => {
    setDatabaseMetrics({
      aurora: {
        queryLatency: { p50: 12.4, p95: 48.7, p99: 125.3 },
        connections: { current: 47, max: 100, utilization: 47.0 },
        iops: { read: 1240, write: 380 },
        replicationLag: 0.8
      },
      dynamodb: {
        readCapacity: { consumed: 245, provisioned: 500 },
        writeCapacity: { consumed: 87, provisioned: 200 },
        throttles: { read: 0, write: 2 },
        latency: { get: 4.2, put: 5.8, query: 12.3 }
      }
    });
  };

  const fetchCacheMetrics = async () => {
    setCacheMetrics({
      redis: {
        hitRate: 94.7,
        hits: 48230,
        misses: 2670,
        evictions: 145,
        connections: 24,
        memoryUsage: 67.3
      }
    });
  };

  const fetchErrorMetrics = async () => {
    const mockErrorTrend = Array.from({ length: 12 }, (_, i) => ({
      time: new Date(Date.now() - (11 - i) * 5 * 60000).toISOString(),
      value: Math.random() * 10
    }));

    setErrorMetrics({
      byService: [
        { service: 'api-gateway', errors: 23, rate: 0.15 },
        { service: 'lambda-auth', errors: 8, rate: 0.05 },
        { service: 'lambda-billing', errors: 45, rate: 1.2 },
        { service: 'dynamodb', errors: 2, rate: 0.01 },
        { service: 'aurora', errors: 0, rate: 0.0 }
      ],
      total: 78,
      rate: 0.42,
      trend: mockErrorTrend
    });
  };

  const fetchLambdaMetrics = async () => {
    setLambdaMetrics({
      coldStarts: { count: 127, percentage: 3.8, avgDuration: 847 },
      duration: { p50: 145, p95: 387, p99: 892, max: 1245 },
      throttles: { count: 12, rate: 0.36 },
      concurrency: { current: 42, max: 100, utilization: 42.0 },
      errors: { count: 34, rate: 1.02 },
      byFunction: [
        { name: 'auth-v2', invocations: 15420, errors: 8, avgDuration: 124, coldStarts: 23 },
        { name: 'billing-worker', invocations: 2340, errors: 12, avgDuration: 456, coldStarts: 45 },
        { name: 'metrics-aggregator', invocations: 8920, errors: 5, avgDuration: 234, coldStarts: 18 },
        { name: 'report-engine', invocations: 450, errors: 9, avgDuration: 1245, coldStarts: 41 }
      ]
    });
  };

  const fetchCostMetrics = async () => {
    setCostMetrics({
      byService: [
        { service: 'Lambda', cost: 124.50, percentage: 28.5, trend: 'up' },
        { service: 'Aurora', cost: 187.30, percentage: 42.8, trend: 'stable' },
        { service: 'DynamoDB', cost: 45.80, percentage: 10.5, trend: 'down' },
        { service: 'ElastiCache', cost: 52.40, percentage: 12.0, trend: 'up' },
        { service: 'API Gateway', cost: 18.20, percentage: 4.2, trend: 'stable' },
        { service: 'CloudWatch', cost: 8.90, percentage: 2.0, trend: 'up' }
      ],
      total: 437.10,
      trend: { direction: 'up', percentage: 8.3 },
      forecast: 473.40
    });
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData();

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchDashboardData, 30000); // 30 second refresh
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timeRange, autoRefresh]);

  /**
   * Helper functions
   */
  const getStatusColor = (value, thresholds = { warning: 70, critical: 85 }) => {
    if (value >= thresholds.critical) return 'text-red-600 bg-red-100';
    if (value >= thresholds.warning) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  /**
   * Chart configurations
   */
  const cpuChartData = {
    labels: infrastructureMetrics.cpu.trend.map(t => new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [{
      label: 'CPU Usage (%)',
      data: infrastructureMetrics.cpu.trend.map(t => t.value),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  const errorRateChartData = {
    labels: errorMetrics.trend.map(t => new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [{
      label: 'Error Rate',
      data: errorMetrics.trend.map(t => t.value),
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  const costByServiceChartData = {
    labels: costMetrics.byService.map(s => s.service),
    datasets: [{
      label: 'Cost ($)',
      data: costMetrics.byService.map(s => s.cost),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ]
    }]
  };

  const cacheHitRateChartData = {
    labels: ['Hits', 'Misses'],
    datasets: [{
      data: [cacheMetrics.redis.hits, cacheMetrics.redis.misses],
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)']
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Server className="w-8 h-8 mr-3 text-blue-600" />
              SRE Operations Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Real-time infrastructure observability for on-call engineers</p>
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
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Infrastructure Health</p>
              <p className="text-2xl font-bold text-gray-900">
                {((100 - infrastructureMetrics.cpu.current) + (100 - infrastructureMetrics.memory.current)) / 2 > 50 ? '✓' : '⚠'} {
                  ((100 - infrastructureMetrics.cpu.current) + (100 - infrastructureMetrics.memory.current)) / 2 > 50 ? 'Healthy' : 'Degraded'
                }
              </p>
            </div>
            <Activity className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">{errorMetrics.rate}%</p>
              <p className="text-xs text-gray-500 mt-1">{errorMetrics.total} errors</p>
            </div>
            <AlertTriangle className={`w-12 h-12 ${errorMetrics.rate > 1 ? 'text-red-500' : 'text-yellow-500'}`} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-gray-900">{cacheMetrics.redis.hitRate}%</p>
              <p className="text-xs text-gray-500 mt-1">{cacheMetrics.redis.hits.toLocaleString()} hits</p>
            </div>
            <Database className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">${costMetrics.total.toFixed(2)}</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                {getTrendIcon(costMetrics.trend.direction)}
                <span className="ml-1">{costMetrics.trend.percentage}% vs last period</span>
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Infrastructure Health Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Cpu className="w-5 h-5 mr-2" />
            Infrastructure Health
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* CPU Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(infrastructureMetrics.cpu.current)}`}>
                  {infrastructureMetrics.cpu.current}%
                </span>
              </div>
              <div className="h-48">
                <Line data={cpuChartData} options={chartOptions} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-600">
                <div>Current: {infrastructureMetrics.cpu.current}%</div>
                <div>Average: {infrastructureMetrics.cpu.average}%</div>
                <div>Peak: {infrastructureMetrics.cpu.max}%</div>
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(infrastructureMetrics.memory.current)}`}>
                  {infrastructureMetrics.memory.current}%
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Current</span>
                    <span>{infrastructureMetrics.memory.current}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${infrastructureMetrics.memory.current}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Average</div>
                    <div className="text-lg font-semibold">{infrastructureMetrics.memory.average}%</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Peak</div>
                    <div className="text-lg font-semibold">{infrastructureMetrics.memory.max}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disk and Network */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <HardDrive className="w-5 h-5 mr-2 text-gray-700" />
                <span className="font-medium text-gray-700">Disk Usage</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current</span>
                  <span className="font-semibold">{infrastructureMetrics.disk.current}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Average</span>
                  <span className="font-semibold">{infrastructureMetrics.disk.average}%</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <Network className="w-5 h-5 mr-2 text-gray-700" />
                <span className="font-medium text-gray-700">Network I/O</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Inbound</span>
                  <span className="font-semibold">{infrastructureMetrics.network.in} MB/s</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Outbound</span>
                  <span className="font-semibold">{infrastructureMetrics.network.out} MB/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Deployments & Scaling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Deployment Pipeline Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <GitBranch className="w-5 h-5 mr-2" />
              Deployment Pipeline
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{deploymentMetrics.successRate}%</div>
                <div className="text-xs text-gray-600">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{deploymentMetrics.averageDuration}s</div>
                <div className="text-xs text-gray-600">Avg Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{deploymentMetrics.inProgress}</div>
                <div className="text-xs text-gray-600">In Progress</div>
              </div>
            </div>

            <div className="space-y-2">
              {deploymentMetrics.recent.map((deployment) => (
                <div key={deployment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {deployment.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {deployment.status === 'in-progress' && <Play className="w-5 h-5 text-blue-600 animate-pulse" />}
                    {deployment.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                    <div>
                      <div className="font-medium text-sm">{deployment.service}</div>
                      <div className="text-xs text-gray-500">{deployment.timestamp.toLocaleTimeString()}</div>
                    </div>
                  </div>
                  {deployment.duration > 0 && (
                    <div className="text-sm text-gray-600">{deployment.duration}s</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-Scaling Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Gauge className="w-5 h-5 mr-2" />
              Auto-Scaling Status
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Lambda Scaling */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Lambda Concurrency</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(scalingMetrics.lambda.utilization)}`}>
                  {scalingMetrics.lambda.utilization}%
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm mb-1">
                <span className="text-gray-600">Current: {scalingMetrics.lambda.current}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Desired: {scalingMetrics.lambda.desired}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Max: {scalingMetrics.lambda.max}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${scalingMetrics.lambda.utilization}%` }}
                />
              </div>
            </div>

            {/* ECS Scaling */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">ECS Tasks</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(scalingMetrics.ecs.utilization)}`}>
                  {scalingMetrics.ecs.utilization}%
                </span>
              </div>
              <div className="flex items-center space-x-2 text-sm mb-1">
                <span className="text-gray-600">Current: {scalingMetrics.ecs.current}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Desired: {scalingMetrics.ecs.desired}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Max: {scalingMetrics.ecs.max}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${scalingMetrics.ecs.utilization}%` }}
                />
              </div>
            </div>

            {/* API Gateway Metrics */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">API Gateway</span>
                <Cloud className="w-5 h-5 text-gray-600" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Requests</div>
                  <div className="text-lg font-semibold">{scalingMetrics.apiGateway.requests.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-600">Throttles</div>
                  <div className="text-lg font-semibold text-yellow-600">{scalingMetrics.apiGateway.throttles}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Performance */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Database Performance
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aurora Metrics */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Aurora PostgreSQL</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Query Latency (ms)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-green-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">p50</div>
                      <div className="font-semibold">{databaseMetrics.aurora.queryLatency.p50}</div>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">p95</div>
                      <div className="font-semibold">{databaseMetrics.aurora.queryLatency.p95}</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">p99</div>
                      <div className="font-semibold">{databaseMetrics.aurora.queryLatency.p99}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Connection Pool</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Utilization</span>
                    <span className="font-semibold">{databaseMetrics.aurora.connections.utilization}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${databaseMetrics.aurora.connections.utilization}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {databaseMetrics.aurora.connections.current} / {databaseMetrics.aurora.connections.max} connections
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Read IOPS</div>
                    <div className="text-lg font-semibold">{databaseMetrics.aurora.iops.read}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Write IOPS</div>
                    <div className="text-lg font-semibold">{databaseMetrics.aurora.iops.write}</div>
                  </div>
                </div>

                <div className={`p-3 rounded ${databaseMetrics.aurora.replicationLag > 5 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-xs text-gray-600">Replication Lag</div>
                  <div className="text-lg font-semibold">{databaseMetrics.aurora.replicationLag}s</div>
                </div>
              </div>
            </div>

            {/* DynamoDB Metrics */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">DynamoDB</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Read Capacity</div>
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-xs text-gray-600">Consumed / Provisioned</div>
                      <div className="text-lg font-semibold">
                        {databaseMetrics.dynamodb.readCapacity.consumed} / {databaseMetrics.dynamodb.readCapacity.provisioned}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Write Capacity</div>
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-xs text-gray-600">Consumed / Provisioned</div>
                      <div className="text-lg font-semibold">
                        {databaseMetrics.dynamodb.writeCapacity.consumed} / {databaseMetrics.dynamodb.writeCapacity.provisioned}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Throttles</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded text-center ${databaseMetrics.dynamodb.throttles.read > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div className="text-xs text-gray-600">Read</div>
                      <div className="font-semibold">{databaseMetrics.dynamodb.throttles.read}</div>
                    </div>
                    <div className={`p-2 rounded text-center ${databaseMetrics.dynamodb.throttles.write > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div className="text-xs text-gray-600">Write</div>
                      <div className="font-semibold">{databaseMetrics.dynamodb.throttles.write}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Operation Latency (ms)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">GET</div>
                      <div className="font-semibold">{databaseMetrics.dynamodb.latency.get}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">PUT</div>
                      <div className="font-semibold">{databaseMetrics.dynamodb.latency.put}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-600">QUERY</div>
                      <div className="font-semibold">{databaseMetrics.dynamodb.latency.query}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cache, Errors, Lambda Performance - Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cache Hit Rates */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Cache Performance
            </h2>
          </div>
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-green-600">{cacheMetrics.redis.hitRate}%</div>
              <div className="text-sm text-gray-600">Hit Rate</div>
            </div>

            <div className="h-40 mb-4">
              <Doughnut data={cacheHitRateChartData} options={{ ...chartOptions, plugins: { legend: { display: true, position: 'bottom' } } }} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Hits</span>
                <span className="font-semibold">{cacheMetrics.redis.hits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Misses</span>
                <span className="font-semibold">{cacheMetrics.redis.misses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Evictions</span>
                <span className="font-semibold">{cacheMetrics.redis.evictions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connections</span>
                <span className="font-semibold">{cacheMetrics.redis.connections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Memory Usage</span>
                <span className="font-semibold">{cacheMetrics.redis.memoryUsage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Rates by Service */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Error Rates
            </h2>
          </div>
          <div className="p-6">
            <div className="text-center mb-4">
              <div className={`text-4xl font-bold ${errorMetrics.rate > 1 ? 'text-red-600' : 'text-yellow-600'}`}>
                {errorMetrics.rate}%
              </div>
              <div className="text-sm text-gray-600">Overall Rate</div>
            </div>

            <div className="h-40 mb-4">
              <Line data={errorRateChartData} options={chartOptions} />
            </div>

            <div className="space-y-2">
              {errorMetrics.byService.map((service) => (
                <div key={service.service} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{service.service}</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{service.errors}</span>
                    <span className={`px-2 py-1 rounded text-xs ${service.rate > 1 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {service.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lambda Performance */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Lambda Metrics
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-xs text-gray-600">Cold Starts</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{lambdaMetrics.coldStarts.count}</div>
                <div className="text-sm text-yellow-700">{lambdaMetrics.coldStarts.percentage}%</div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Avg: {lambdaMetrics.coldStarts.avgDuration}ms</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Duration (ms)</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600">p50</div>
                  <div className="font-semibold">{lambdaMetrics.duration.p50}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600">p95</div>
                  <div className="font-semibold">{lambdaMetrics.duration.p95}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-xs text-gray-600">p99</div>
                  <div className="font-semibold">{lambdaMetrics.duration.p99}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`p-3 rounded ${lambdaMetrics.throttles.count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-600">Throttles</div>
                <div className="text-lg font-semibold">{lambdaMetrics.throttles.count}</div>
              </div>
              <div className={`p-3 rounded ${lambdaMetrics.errors.count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-600">Errors</div>
                <div className="text-lg font-semibold">{lambdaMetrics.errors.count}</div>
              </div>
            </div>

            <div className={`p-3 rounded ${getStatusColor(lambdaMetrics.concurrency.utilization)}`}>
              <div className="text-xs text-gray-600">Concurrency</div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{lambdaMetrics.concurrency.current} / {lambdaMetrics.concurrency.max}</div>
                <div className="text-sm">{lambdaMetrics.concurrency.utilization}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Cost Analysis
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">${costMetrics.total.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Current Period</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">${costMetrics.forecast.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Forecasted</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${costMetrics.trend.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                {getTrendIcon(costMetrics.trend.direction)}
                {costMetrics.trend.percentage}%
              </div>
              <div className="text-sm text-gray-600">Trend</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <Bar data={costByServiceChartData} options={{ ...chartOptions, indexAxis: 'y' }} />
            </div>

            <div className="space-y-2">
              {costMetrics.byService.map((service) => (
                <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    <div className="font-medium text-sm">{service.service}</div>
                    {getTrendIcon(service.trend)}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${service.cost.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{service.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SREDashboard;
