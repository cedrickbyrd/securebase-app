import React, { useState, useEffect } from 'react';
import { isDemoMode } from '../utils/demoData';
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

const SREDashboard = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const isDemo = isDemoMode();

  // All the existing state declarations...
  const [infrastructureMetrics, setInfrastructureMetrics] = useState({
    cpu: { current: 0, average: 0, max: 0, trend: [] },
    memory: { current: 0, average: 0, max: 0, trend: [] },
    disk: { current: 0, average: 0, max: 0, trend: [] },
    network: { in: 0, out: 0, trend: [] }
  });

  const [deploymentMetrics, setDeploymentMetrics] = useState({
    recent: [],
    successRate: 0,
    averageDuration: 0,
    inProgress: 0
  });

  const [scalingMetrics, setScalingMetrics] = useState({
    lambda: { current: 0, desired: 0, max: 0, utilization: 0 },
    ecs: { current: 0, desired: 0, max: 0, utilization: 0 },
    apiGateway: { requests: 0, throttles: 0 }
  });

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

  const [errorMetrics, setErrorMetrics] = useState({
    byService: [],
    total: 0,
    rate: 0,
    trend: []
  });

  const [lambdaMetrics, setLambdaMetrics] = useState({
    coldStarts: { count: 0, percentage: 0, avgDuration: 0 },
    duration: { p50: 0, p95: 0, p99: 0, max: 0 },
    throttles: { count: 0, rate: 0 },
    concurrency: { current: 0, max: 0, utilization: 0 },
    errors: { count: 0, rate: 0 },
    byFunction: []
  });

  const [costMetrics, setCostMetrics] = useState({
    byService: [],
    total: 0,
    trend: { direction: 'up', percentage: 0 },
    forecast: 0
  });

  // All existing fetch functions remain the same...
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
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

  const fetchInfrastructureMetrics = async () => {
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

  // Chart configurations (keeping existing ones)
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

  if (loading && !infrastructureMetrics.cpu.current) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading SRE dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Demo Banner - Only show in demo mode */}
      {isDemo && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-blue-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Demo Mode: Showing sample infrastructure metrics
              </p>
              <p className="text-xs text-gray-600 mt-1">
                This data represents a typical production environment for Acme Corporation
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Rest of the dashboard JSX remains exactly the same... */}
      {/* Quick Stats, Infrastructure, Deployments, Scaling, Database, Cache, Errors, Lambda, Cost sections */}
      {/* (Keeping all existing JSX for brevity - just adding the demo banner at top) */}
