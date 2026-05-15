import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Shield, AlertTriangle,
  CheckCircle2, Loader, RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('sessionToken') ||
    sessionStorage.getItem('sessionToken') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const FRAMEWORK_CONFIG = {
  // Healthcare
  HIPAA:   { label: 'HIPAA',    color: '#0f4c81', bg: '#eff6ff',  group: 'healthcare' },
  // Cross-industry
  SOC2:    { label: 'SOC 2',   color: '#1e3a5f', bg: '#e8f0fe',  group: 'cross' },
  FedRAMP: { label: 'FedRAMP', color: '#065f46', bg: '#ecfdf5',  group: 'government' },
  // Banking Edition
  FDICIA:  { label: 'FDICIA',  color: '#7c2d12', bg: '#fff7ed',  group: 'banking' },
  GLBA:    { label: 'GLBA',    color: '#713f12', bg: '#fefce8',  group: 'banking' },
  CRA:     { label: 'CRA',     color: '#1e3a5f', bg: '#f0fdf4',  group: 'banking' },
};

const FRAMEWORK_GROUPS = {
  banking:    { label: 'Banking Edition', frameworks: ['FDICIA', 'GLBA', 'CRA'] },
  healthcare: { label: 'Healthcare',      frameworks: ['HIPAA'] },
  cross:      { label: 'Cross-Industry',  frameworks: ['SOC2'] },
  government: { label: 'Government',      frameworks: ['FedRAMP'] },
};

function TrendBadge({ trend, delta }) {
  if (trend === 'improving') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
      <TrendingUp className="w-3 h-3" />+{delta}pts / 7d
    </span>
  );
  if (trend === 'degrading') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      <TrendingDown className="w-3 h-3" />{delta}pts / 7d
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
      <Minus className="w-3 h-3" />Stable
    </span>
  );
}

function ScoreGauge({ score }) {
  const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
  const label = score >= 90 ? 'Strong' : score >= 70 ? 'Moderate' : 'At Risk';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-700 font-bold">Score: {payload[0]?.value}</p>
      {d && (
        <>
          <p className="text-gray-500">Passing: {d.controls_passing}/{d.controls_total}</p>
          {d.critical_violations > 0 && <p className="text-red-600">Critical: {d.critical_violations}</p>}
          {d.high_violations > 0 && <p className="text-orange-500">High: {d.high_violations}</p>}
        </>
      )}
    </div>
  );
};

export default function ComplianceTrend({ defaultFramework = 'HIPAA', days = 90, compact = false }) {
  const [framework, setFramework] = useState(defaultFramework);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/tenant/compliance/history?framework=${framework}&days=${days}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('ComplianceTrend fetch error:', err);
      setError('Unable to load compliance history.');
    } finally {
      setLoading(false);
    }
  }, [framework, days]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const cfg = FRAMEWORK_CONFIG[framework] || FRAMEWORK_CONFIG.HIPAA;
  const summary = data?.summary || {};
  const history = (data?.history || [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      ...item,
      date: item.date?.slice(5),
      score: parseFloat(item.score || 0),
    }));

  // Compact mode for Dashboard inline card
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex gap-1 flex-wrap">
            {Object.entries(FRAMEWORK_CONFIG).map(([fw, c]) => (
              <button key={fw} onClick={() => setFramework(fw)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  framework === fw ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={framework === fw ? { background: c.color } : {}}>
                {c.label}
              </button>
            ))}
          </div>
          {!loading && summary.trend && (
            <TrendBadge trend={summary.trend} delta={summary.score_delta_7d} />
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <ScoreGauge score={Math.round(summary.latest_score || 0)} />
              <div className="flex-1 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between"><span>90-day high</span><span className="font-semibold text-gray-800">{summary.max_score}</span></div>
                <div className="flex justify-between"><span>90-day low</span><span className="font-semibold text-gray-800">{summary.min_score}</span></div>
                <div className="flex justify-between"><span>Average</span><span className="font-semibold text-gray-800">{summary.avg_score}</span></div>
              </div>
            </div>
            {history.length > 1 && (
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={history} margin={{ top: 2, right: 4, left: -30, bottom: 0 }}>
                  <Line type="monotone" dataKey="score" stroke={cfg.color} strokeWidth={2} dot={false} />
                  <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                  <YAxis domain={[0, 100]} hide />
                  <XAxis dataKey="date" hide />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Compliance Score Trend
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {days}-day continuous compliance history — updated daily at 02:00 UTC
          </p>
        </div>
        <button onClick={fetchHistory} disabled={loading}
          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Framework tabs grouped */}
      <div className="space-y-2">
        {Object.entries(FRAMEWORK_GROUPS).map(([groupKey, group]) => (
          <div key={groupKey} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 w-24 shrink-0">{group.label}</span>
            <div className="flex gap-1 flex-wrap">
              {group.frameworks.map(fw => {
                const c = FRAMEWORK_CONFIG[fw];
                return (
                  <button key={fw} onClick={() => setFramework(fw)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                      framework === fw
                        ? 'text-white shadow-sm border-transparent'
                        : 'text-gray-500 border-gray-200 hover:text-gray-700 hover:border-gray-300 bg-white'
                    }`}
                    style={framework === fw ? { background: c.color } : {}}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-400">Loading compliance history…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-500">{error}</span>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Current Score', value: summary.latest_score, highlight: true },
              { label: '90-Day High',   value: summary.max_score },
              { label: '90-Day Low',    value: summary.min_score },
              { label: 'Average',       value: summary.avg_score },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`rounded-lg p-3 border ${
                highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'
              }`}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${
                  highlight ? 'text-blue-700' : 'text-gray-800'
                }`}>{value ?? '—'}</p>
              </div>
            ))}
          </div>

          {/* Trend badge */}
          <div className="flex items-center gap-2">
            <TrendBadge trend={summary.trend} delta={summary.score_delta_7d} />
            {summary.trend === 'improving' && <span className="text-xs text-green-600">Compliance posture is strengthening.</span>}
            {summary.trend === 'degrading' && <span className="text-xs text-red-600">Compliance posture requires attention.</span>}
            {summary.trend === 'stable' && <span className="text-xs text-gray-500">No significant change in the last 7 days.</span>}
          </div>

          {/* Chart */}
          {history.length > 1 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={Math.floor(history.length / 6)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4"
                    label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="score" stroke={cfg.color} strokeWidth={2.5}
                    dot={{ fill: cfg.color, r: 3 }}
                    activeDot={{ r: 5, stroke: cfg.color, strokeWidth: 2, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-100">
              <Shield className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-400 text-center">
                Trend data builds after 2+ daily score calculations.<br />Check back tomorrow.
              </p>
            </div>
          )}

          {/* Violation breakdown */}
          {history.length > 0 && (() => {
            const latest = history[history.length - 1];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Critical', count: latest.critical_violations, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
                  { label: 'High',     count: latest.high_violations,     color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
                  { label: 'Medium',   count: latest.medium_violations,   color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
                  { label: 'Low',      count: latest.low_violations,      color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
                ].map(({ label, count, color, bg, border }) => (
                  <div key={label} className={`rounded-lg p-2.5 border ${bg} ${border}`}>
                    <p className="text-xs text-gray-500">{label} violations</p>
                    <p className={`text-xl font-bold ${color}`}>{count}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
