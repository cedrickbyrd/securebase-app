import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import SystemHealth from './SystemHealth';
import { adminService } from '../../services/adminService';

const INITIAL_DELAY_MS = 30000;
const MAX_DELAY_MS = 300000;

const defaultMetrics = {
  overview: null,
  infrastructure: null,
  security: null,
  customers: null,
  costs: null,
  operations: null,
  alerts: [],
};

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [error, setError] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshDelay, setRefreshDelay] = useState(INITIAL_DELAY_MS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [costStartDate, setCostStartDate] = useState('');
  const [costEndDate, setCostEndDate] = useState('');
  const [costSortBy, setCostSortBy] = useState('totalCost');
  const [costSortDirection, setCostSortDirection] = useState('desc');
  const delayRef = useRef(INITIAL_DELAY_MS);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const isAdmin = role === 'admin';

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!hasLoadedRef.current) {
      if (isMountedRef.current) {
        setIsInitialLoading(true);
      }
    } else {
      if (isMountedRef.current) {
        setIsRefreshing(true);
      }
    }

    try {
      const [
        overview,
        infrastructure,
        security,
        customers,
        costs,
        operations,
        alerts,
      ] = await Promise.all([
        adminService.getSystemOverview(),
        adminService.getInfrastructureHealth(),
        adminService.getSecurityMetrics(),
        adminService.getCustomerAnalytics(),
        adminService.getCostManagement({
          start: costStartDate || undefined,
          end: costEndDate || undefined,
        }),
        adminService.getOperationsStatus(),
        adminService.getRecentAlerts(),
      ]);

      delayRef.current = INITIAL_DELAY_MS;
      if (isMountedRef.current) {
        setMetrics({ overview, infrastructure, security, customers, costs, operations, alerts });
        setError(null);
        setRefreshDelay(INITIAL_DELAY_MS);
        setLastUpdated(new Date());
        setRefreshKey((value) => value + 1);
      }
      hasLoadedRef.current = true;
      return INITIAL_DELAY_MS;
    } catch (fetchError) {
      const nextDelay = Math.min(delayRef.current * 2, MAX_DELAY_MS);
      delayRef.current = nextDelay;
      if (isMountedRef.current) {
        setError(fetchError);
        setRefreshDelay(nextDelay);
        setLastUpdated(new Date());
      }
      return nextDelay;
    } finally {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [costEndDate, costStartDate]);

  useEffect(() => {
    let mounted = true;
    let timer;

    const run = async () => {
      if (!mounted) return;
      const nextDelay = await loadDashboard();
      if (!mounted) return;
      timer = setTimeout(run, nextDelay ?? delayRef.current);
    };

    run();

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [loadDashboard]);

  const handleManualRefresh = () => {
    loadDashboard();
  };

  const mrrTrend = useMemo(() => {
    const points = metrics.customers?.mrrTrend || [];
    if (points.length < 2) return 'No trend data';
    const start = points[0];
    const end = points[points.length - 1];
    if (
      typeof start !== 'number'
      || typeof end !== 'number'
      || !Number.isFinite(start)
      || !Number.isFinite(end)
      || start === 0
    ) {
      return 'Trend unavailable';
    }
    const delta = (((end - start) / start) * 100).toFixed(1);
    const sign = Number(delta) >= 0 ? '+' : '';
    return `${sign}${delta}% over trend window`;
  }, [metrics.customers]);

  const sortedTenantCosts = useMemo(() => {
    const rows = Array.isArray(metrics.costs?.tenantCostHistory) ? [...metrics.costs.tenantCostHistory] : [];
    rows.sort((a, b) => {
      const aValue = a?.[costSortBy];
      const bValue = b?.[costSortBy];
      if (costSortBy === 'date' || costSortBy === 'tenant_id') {
        const comparison = String(aValue || '').localeCompare(String(bValue || ''));
        return costSortDirection === 'asc' ? comparison : -comparison;
      }
      const comparison = Number(aValue || 0) - Number(bValue || 0);
      return costSortDirection === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [costSortBy, costSortDirection, metrics.costs]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isInitialLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Executive/Admin Dashboard</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse text-sm text-gray-500">
          Loading executive dashboard...
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive/Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Phase 5.1 platform health and business intelligence</p>
          <p className="text-xs text-gray-500 mt-1">
            Refresh cadence: {Math.round(refreshDelay / 1000)}s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && (
            <span className="inline-flex items-center text-sm text-blue-700">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              Refreshing...
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Refresh now
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm text-red-700">
          Unable to refresh admin metrics. Retrying with exponential back-off.
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Active Tenants" value={metrics.overview?.activeTenants} />
          <Metric label="Total Revenue" value={`$${(metrics.overview?.totalRevenue || 0).toLocaleString()}`} />
          <Metric label="Uptime" value={`${metrics.overview?.uptimePercentage || 0}%`} />
          <Metric label="Open Support Tickets" value={metrics.overview?.openSupportTickets} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Infrastructure Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Lambda Invocations" value={(metrics.infrastructure?.lambdaInvocations || 0).toLocaleString()} />
          <Metric label="API Latency" value={`p50 ${metrics.infrastructure?.apiLatency?.p50 || 0}ms / p95 ${metrics.infrastructure?.apiLatency?.p95 || 0}ms / p99 ${metrics.infrastructure?.apiLatency?.p99 || 0}ms`} />
          <Metric label="Error Rate" value={`${metrics.infrastructure?.errorRate || 0}%`} />
          <Metric label="CloudWatch Alarms" value={metrics.infrastructure?.cloudwatchAlarms} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Security & Compliance</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
          <Metric label="SOC 2" value={`${metrics.security?.complianceScores?.soc2 || 0}%`} />
          <Metric label="FedRAMP" value={`${metrics.security?.complianceScores?.fedramp || 0}%`} />
          <Metric label="HIPAA" value={`${metrics.security?.complianceScores?.hipaa || 0}%`} />
          <Metric label="Failed Auth Attempts" value={metrics.security?.failedAuthAttempts} />
          <Metric label="Security Events (24h)" value={metrics.security?.securityEvents24h} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Customer Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <Metric label="New Signups (30d)" value={metrics.customers?.newSignups30d} />
          <Metric label="Churn Rate" value={`${metrics.customers?.churnRate || 0}%`} />
          <Metric label="MRR Trend" value={mrrTrend} />
          <Metric label="NPS Score" value={metrics.customers?.npsScore} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Cost Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">Start date</span>
            <input
              type="date"
              value={costStartDate}
              onChange={(event) => setCostStartDate(event.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">End date</span>
            <input
              type="date"
              value={costEndDate}
              onChange={(event) => setCostEndDate(event.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">Sort by</span>
            <select
              value={costSortBy}
              onChange={(event) => setCostSortBy(event.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="totalCost">Total cost</option>
              <option value="tenant_id">Tenant</option>
              <option value="date">Date</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-600">Direction</span>
            <select
              value={costSortDirection}
              onChange={(event) => setCostSortDirection(event.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
          <Metric label="AWS Spend (MTD)" value={`$${(metrics.costs?.awsSpendMtd || 0).toLocaleString()}`} />
          <Metric label="Cost per Tenant" value={`$${metrics.costs?.costPerTenant || 0}`} />
          <Metric label="Savings vs On-Demand" value={`${metrics.costs?.savingsVsOnDemand || 0}%`} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">Top 5 Services by Cost</h3>
          {metrics.costs?.topServicesByCost?.slice(0, 5).map((service) => (
            <div key={service.name} className="flex justify-between text-sm text-gray-700">
              <span>{service.name}</span>
              <span>${service.cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Cost Per Tenant (Daily)</h3>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Tenant</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {sortedTenantCosts.length > 0 ? (
                  sortedTenantCosts.map((row, index) => (
                    <tr key={`${row.tenant_id}-${row.date}-${index}`} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.tenant_id}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2 text-right">${Number(row.totalCost || 0).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-center text-gray-500">
                      No tenant cost history available for selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Active Deployments" value={metrics.operations?.activeDeployments} />
          <Metric label="Failed CI/CD Pipelines" value={metrics.operations?.failedPipelines} />
          <Metric label="Pending Terraform Changes" value={metrics.operations?.pendingTerraformChanges} />
          <Metric label="Lambda Cold Starts" value={metrics.operations?.lambdaColdStarts} />
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Alerts</h2>
        <div className="space-y-3">
          {metrics.alerts?.map((alert) => (
            <article key={alert.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <p className="font-medium text-gray-900">{alert.summary}</p>
                <span className="uppercase text-xs font-semibold text-gray-600">{alert.severity}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {alert.source} • {new Date(alert.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </section>

      <SystemHealth refreshKey={refreshKey} />

      {lastUpdated && (
        <p className="text-xs text-gray-500">Last updated: {lastUpdated.toLocaleString()}</p>
      )}
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
    <p className="text-xs text-gray-600">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1">{value ?? 0}</p>
  </div>
);

export default AdminDashboard;
