import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import { adminService } from '../../services/adminService';

const REFRESH_INTERVAL_MS = 60000;

const SEVERITY_CONFIG = {
  P1: { label: 'P1 Critical', color: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-500', textColor: 'text-red-700' },
  P2: { label: 'P2 High', color: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500', textColor: 'text-orange-700' },
  P3: { label: 'P3 Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400', textColor: 'text-yellow-700' },
};

const SeverityBadge = ({ severity }) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.P3;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {severity}
    </span>
  );
};

const MetricCard = ({ label, value, subtext, icon: Icon, colorClass = 'text-gray-900' }) => (
  <div className="border border-gray-200 rounded-xl p-4 bg-white">
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
    </div>
    <p className={`text-2xl font-bold ${colorClass}`}>{value ?? '—'}</p>
    {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
  </div>
);

const formatDuration = (seconds) => {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const groupHistoryByDay = (history) => {
  const days = {};
  history.forEach((item) => {
    const day = (item.triggered_at || '').slice(0, 10);
    if (!day) return;
    if (!days[day]) days[day] = { date: day, P1: 0, P2: 0, P3: 0 };
    const sev = item.severity || 'P3';
    if (days[day][sev] !== undefined) days[day][sev] += 1;
  });
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
};

const AlarmHistoryChart = ({ history }) => {
  const days = useMemo(() => groupHistoryByDay(history), [history]);

  if (!days.length) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">No alarm history for the past 30 days.</div>
    );
  }

  const maxTotal = Math.max(1, ...days.map((d) => d.P1 + d.P2 + d.P3));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-max" style={{ height: '120px' }}>
        {days.map((d) => {
          const total = d.P1 + d.P2 + d.P3;
          const heightPct = (total / maxTotal) * 100;
          return (
            <div key={d.date} className="flex flex-col items-center gap-0.5 group" style={{ width: '24px' }}>
              <div
                className="w-full rounded-t overflow-hidden flex flex-col-reverse"
                style={{ height: `${heightPct || 2}%`, minHeight: total > 0 ? '4px' : '2px' }}
                title={`${d.date}: P1=${d.P1} P2=${d.P2} P3=${d.P3}`}
              >
                <div className="bg-yellow-400" style={{ flex: d.P3 }} />
                <div className="bg-orange-500" style={{ flex: d.P2 }} />
                <div className="bg-red-500" style={{ flex: d.P1 }} />
              </div>
              <span className="text-gray-400 group-hover:text-gray-600 transition-colors"
                style={{ fontSize: '8px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '28px' }}>
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> P1 Critical</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> P2 High</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> P3 Medium</span>
      </div>
    </div>
  );
};

const AlertingDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [mttaMetrics, setMttaMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [summaryData, historyData, metricsData] = await Promise.all([
        adminService.getAlarmSummary(),
        adminService.getAlarmHistory(),
        adminService.getMttaMttrMetrics(),
      ]);
      if (!mountedRef.current) return;
      setSummary(summaryData);
      setHistory(historyData || []);
      setMttaMetrics(metricsData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const activeAlarms = summary?.active_alarms || { P1: 0, P2: 0, P3: 0, total: 0 };

  const activeAlarmsList = useMemo(
    () => (summary?.alarms || []).filter((a) => a.state === 'ALARM').sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    }),
    [summary],
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            Alerting &amp; Incident Response
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Phase 6 / Track 3 — CloudWatch alarms + runbook automation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Refreshing...
            </span>
          )}
          <button
            type="button"
            onClick={() => load(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm text-red-700">
          Unable to load alerting data. Retrying automatically.
        </div>
      )}

      {/* Severity Count Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="P1 Critical"
          value={activeAlarms.P1}
          subtext="Page immediately"
          icon={AlertTriangle}
          colorClass={activeAlarms.P1 > 0 ? 'text-red-700' : 'text-gray-400'}
        />
        <MetricCard
          label="P2 High"
          value={activeAlarms.P2}
          subtext="Page in 5 min"
          icon={AlertTriangle}
          colorClass={activeAlarms.P2 > 0 ? 'text-orange-600' : 'text-gray-400'}
        />
        <MetricCard
          label="P3 Medium"
          value={activeAlarms.P3}
          subtext="Ticket only"
          icon={Bell}
          colorClass={activeAlarms.P3 > 0 ? 'text-yellow-700' : 'text-gray-400'}
        />
        <MetricCard
          label="Total Active"
          value={activeAlarms.total}
          subtext={activeAlarms.total === 0 ? 'All systems normal' : `${activeAlarms.total} alarm${activeAlarms.total !== 1 ? 's' : ''} firing`}
          icon={activeAlarms.total === 0 ? CheckCircle : AlertTriangle}
          colorClass={activeAlarms.total === 0 ? 'text-green-600' : 'text-red-700'}
        />
      </div>

      {/* MTTA / MTTR Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Mean Time to Acknowledge (MTTA)"
          value={formatDuration(mttaMetrics?.mean_mtta_seconds)}
          subtext={mttaMetrics?.sample_count ? `Based on ${mttaMetrics.sample_count} incidents` : 'No data yet'}
          icon={Clock}
          colorClass={
            mttaMetrics?.mean_mtta_seconds == null ? 'text-gray-400'
            : mttaMetrics.mean_mtta_seconds < 300 ? 'text-green-600' : 'text-orange-600'
          }
        />
        <MetricCard
          label="Mean Time to Resolve (MTTR)"
          value={formatDuration(mttaMetrics?.mean_mttr_seconds)}
          subtext={mttaMetrics?.sample_count ? `Based on ${mttaMetrics.sample_count} incidents` : 'No data yet'}
          icon={TrendingUp}
          colorClass={
            mttaMetrics?.mean_mttr_seconds == null ? 'text-gray-400'
            : mttaMetrics.mean_mttr_seconds < 900 ? 'text-green-600' : 'text-orange-600'
          }
        />
        <MetricCard
          label="P1 SLA Target"
          value="< 5 min MTTA"
          subtext={
            mttaMetrics?.mean_mtta_seconds != null && mttaMetrics.mean_mtta_seconds < 300
              ? '✓ Within SLA'
              : mttaMetrics?.mean_mtta_seconds != null
              ? '⚠ SLA breach risk'
              : 'No P1 incidents recorded'
          }
          colorClass={
            mttaMetrics?.mean_mtta_seconds != null && mttaMetrics.mean_mtta_seconds < 300
              ? 'text-green-600'
              : 'text-gray-700'
          }
        />
      </div>

      {/* 30-Day Alarm History Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          30-Day Alarm History
        </h3>
        <AlarmHistoryChart history={history} />
      </div>

      {/* Active Alarms List */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Active Alarms
          {activeAlarms.total > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              {activeAlarms.total}
            </span>
          )}
        </h3>
        {activeAlarmsList.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 py-4">
            <CheckCircle className="w-4 h-4" />
            No active alarms — all systems healthy.
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlarmsList.map((alarm) => (
              <article
                key={`${alarm.alarm_name}-${alarm.triggered_at}`}
                className="border border-gray-100 rounded-lg p-3 flex flex-wrap items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={alarm.severity} />
                    <span className="text-sm font-medium text-gray-900 truncate">{alarm.alarm_name}</span>
                  </div>
                  {alarm.reason && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{alarm.reason}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {alarm.triggered_at ? new Date(alarm.triggered_at).toLocaleString() : ''}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-400">Last updated: {lastUpdated.toLocaleString()}</p>
      )}
    </div>
  );
};

export default AlertingDashboard;
