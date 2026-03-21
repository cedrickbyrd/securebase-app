import React, { useState } from 'react';
import { mockDashboardData } from '../utils/demoData';

const ALERT_THRESHOLD_CRITICAL = 80;

const statusColor = {
  healthy: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

const ProgressBar = ({ value, max = 100, color = 'bg-blue-500' }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className={`${color} h-2 rounded-full transition-all`}
      style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
    />
  </div>
);

const StatCard = ({ label, value, sub, highlight }) => (
  <div className={`rounded-xl p-4 border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'} shadow-sm`}>
    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const DemoDashboard = () => {
  const d = mockDashboardData;
  const [lastRefresh] = useState(new Date());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEMO MODE Banner */}
      <div className="bg-blue-600 text-white text-center py-2 text-sm font-semibold tracking-wide">
        🚀 DEMO MODE — All data is simulated. No real infrastructure is affected.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-sm">SB</div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">SRE Operations Dashboard</h1>
              <p className="text-xs text-gray-500">Acme Corporation · demo@securebase.tximhotep.com</p>
            </div>
          </div>
          <div className="text-xs text-gray-400">Last refresh: {lastRefresh.toLocaleTimeString()}</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Top-level stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Environments" value={d.environments.length} sub="Production · Staging · Dev" />
          <StatCard label="Compliance Score" value={`${d.complianceScore}%`} sub="197 / 209 controls passing" highlight />
          <StatCard label="Monthly Cost" value={`$${d.monthlyCost.toLocaleString()}`} sub="+3.2% vs last month" />
          <StatCard label="Active Alerts" value={d.activeAlerts} sub="1 critical · 1 warning · 1 info" />
        </div>

        {/* Environments */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Environments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {d.environments.map((env) => {
              const sc = statusColor[env.status] || statusColor.healthy;
              return (
                <div key={env.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{env.name}</span>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {env.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Region: <span className="font-mono">{env.region}</span></div>
                    <div>Accounts: {env.accounts}</div>
                    <div>Last deploy: {env.lastDeployment}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Infrastructure */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Infrastructure</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'CPU Utilization', value: d.infrastructure.cpu.current, color: d.infrastructure.cpu.current > ALERT_THRESHOLD_CRITICAL ? 'bg-red-500' : 'bg-blue-500' },
              { label: 'Memory Usage', value: d.infrastructure.memory.current, color: d.infrastructure.memory.current > ALERT_THRESHOLD_CRITICAL ? 'bg-red-500' : 'bg-purple-500' },
              { label: 'Disk Usage', value: d.infrastructure.disk.current, color: 'bg-green-500' },
              { label: 'Network In (GB/s)', value: d.infrastructure.network.in, max: 5, color: 'bg-teal-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-semibold text-gray-900">{item.value}{item.max ? '' : '%'}</span>
                </div>
                <ProgressBar value={item.value} max={item.max || 100} color={item.color} />
              </div>
            ))}
          </div>
        </section>

        {/* Deployments & Lambda */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Deployments */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Deployments</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex gap-4 text-sm mb-2">
                <div><span className="text-gray-500">Success rate:</span> <span className="font-bold text-green-600">{d.deployments.successRate}%</span></div>
                <div><span className="text-gray-500">Avg duration:</span> <span className="font-bold">{d.deployments.averageDuration}m</span></div>
              </div>
              {d.deployments.recent.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
                  <div>
                    <span className="font-medium text-gray-900">{dep.service}</span>
                    <span className="text-gray-400 ml-1">{dep.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {dep.duration && <span className="text-gray-400">{dep.duration}m</span>}
                    <span className={`px-2 py-0.5 rounded-full font-medium ${dep.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {dep.status}
                    </span>
                    <span className="text-gray-400">{dep.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Lambda */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Lambda Performance</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-4">
              {[
                { label: 'Cold Starts', value: `${d.lambda.coldStarts.count}`, sub: `${d.lambda.coldStarts.percentage}% of invocations` },
                { label: 'Concurrency', value: `${d.lambda.concurrency.current}`, sub: `${d.lambda.concurrency.utilization}% utilization` },
                { label: 'p50 Duration', value: `${d.lambda.duration.p50}ms`, sub: `p95: ${d.lambda.duration.p95}ms` },
                { label: 'Throttles', value: `${d.lambda.throttles.count}`, sub: 'No throttling' },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{item.label}</div>
                  <div className="text-xl font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500">{item.sub}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Cost by Service */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3">Cost by Service</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-gray-900">${d.cost.total.toLocaleString()}<span className="text-sm font-normal text-gray-400">/mo</span></span>
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">↑ {d.cost.trend.percentage}% vs last month</span>
            </div>
            <div className="space-y-2">
              {d.cost.byService.map((s) => (
                <div key={s.service} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-gray-600 text-xs">{s.service}</span>
                  <div className="flex-1">
                    <ProgressBar value={s.percentage} color="bg-blue-400" />
                  </div>
                  <span className="w-16 text-right font-medium text-gray-900">${s.cost.toLocaleString()}</span>
                  <span className="w-10 text-right text-xs text-gray-400">{s.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="mt-12 pb-8 text-center text-gray-400 text-xs">
        &copy; 2026 TxImhotep LLC · SecureBase Demo Environment · No real data
      </footer>
    </div>
  );
};

export default DemoDashboard;
