import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ArrowDown, ArrowRight, ArrowUp, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_ENDPOINT || '';
const FRAMEWORKS = ['SOC2', 'HIPAA', 'FedRAMP'];
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function getToken() {
  return (
    sessionStorage.getItem('sessionToken') ||
    localStorage.getItem('sessionToken') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('auth_token') ||
    ''
  );
}

function getTrendIcon(trend) {
  if (trend === 'Improving') return <ArrowUp className="w-4 h-4" />;
  if (trend === 'Declining') return <ArrowDown className="w-4 h-4" />;
  return <ArrowRight className="w-4 h-4" />;
}

function statusClasses(status) {
  if (status === 'Passing') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'At Risk') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function severityClasses(severity) {
  if (severity === 'Critical') return 'bg-red-100 text-red-700';
  if (severity === 'High') return 'bg-amber-100 text-amber-700';
  if (severity === 'Medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-blue-100 text-blue-700';
}

function roundScore(value) {
  if (value === null || value === undefined) return '—';
  return Math.round(Number(value));
}

export default function ComplianceTrend({ days = 90 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [frameworkData, setFrameworkData] = useState({});
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [severityAsc, setSeverityAsc] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/compliance/history?framework=all&days=${days}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFrameworkData(data.frameworks || {});
    } catch (err) {
      console.error('ComplianceTrend fetch error:', err);
      setError('Unable to load compliance history.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const hasAnyHistory = useMemo(
    () => FRAMEWORKS.some((fw) => (frameworkData?.[fw]?.history || []).length > 0),
    [frameworkData]
  );

  const chartData = useMemo(() => {
    const byDate = {};
    FRAMEWORKS.forEach((framework) => {
      (frameworkData?.[framework]?.history || []).forEach((point) => {
        if (!point?.date) return;
        if (!byDate[point.date]) byDate[point.date] = { date: point.date };
        byDate[point.date][framework] = Number(point.score);
      });
    });

    return Object.values(byDate)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((row) => ({ ...row, tick: String(row.date).slice(5) }));
  }, [frameworkData]);

  const violationRows = useMemo(() => {
    const rows = FRAMEWORKS.flatMap((framework) =>
      (frameworkData?.[framework]?.violations || []).map((violation) => ({
        framework,
        ...violation,
      }))
    );

    const filtered = frameworkFilter === 'all'
      ? rows
      : rows.filter((row) => row.framework === frameworkFilter);

    return filtered.sort((a, b) => {
      const delta = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      return severityAsc ? delta : -delta;
    });
  }, [frameworkData, frameworkFilter, severityAsc]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FRAMEWORKS.map((fw) => (
            <div key={fw} className="h-28 rounded-xl bg-gray-100 border border-gray-200" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-gray-100 border border-gray-200" />
        <div className="h-44 rounded-xl bg-gray-100 border border-gray-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
        {error}
      </div>
    );
  }

  if (!hasAnyHistory) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500 text-sm">
        Your first compliance score will appear after the daily calculation runs at 02:00 UTC
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Compliance Score Trend (90 Days)</h2>
        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FRAMEWORKS.map((framework) => {
          const data = frameworkData?.[framework] || {};
          const delta = data.score_delta_7d;
          const deltaLabel = delta === null || delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${delta} pts`;
          return (
            <div key={framework} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{framework}</p>
                  <p className="text-3xl font-bold text-gray-900">{roundScore(data.current_score)}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClasses(data.status)}`}>
                  {data.status || 'Failing'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1 text-gray-700">
                  {getTrendIcon(data.trend)} {data.trend || 'Stable'}
                </span>
                <span className="text-gray-600">{deltaLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tick" interval={Math.max(0, Math.floor(chartData.length / 12))} tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="SOC2" stroke="#1e3a8a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="HIPAA" stroke="#0f766e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="FedRAMP" stroke="#9333ea" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-gray-900">Control Violations</h3>
          <div className="flex gap-2">
            <select
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="all">All Frameworks</option>
              {FRAMEWORKS.map((framework) => (
                <option key={framework} value={framework}>{framework}</option>
              ))}
            </select>
            <button
              onClick={() => setSeverityAsc((prev) => !prev)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Severity {severityAsc ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="text-left py-2 pr-3">Framework</th>
                <th className="text-left py-2 pr-3">Control ID</th>
                <th className="text-left py-2 pr-3">Control Name</th>
                <th className="text-left py-2 pr-3">Severity</th>
                <th className="text-left py-2 pr-3">Days Failing</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {violationRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">No violations found for the selected filter.</td>
                </tr>
              ) : (
                violationRows.map((row, index) => (
                  <tr key={`${row.framework}-${row.control_id}-${index}`} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{row.framework}</td>
                    <td className="py-2 pr-3 font-medium text-gray-900">{row.control_id}</td>
                    <td className="py-2 pr-3">{row.control_name}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${severityClasses(row.severity)}`}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{row.days_failing}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
