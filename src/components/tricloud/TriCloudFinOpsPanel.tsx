import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import {
  CloudProviderId,
  TriCloudFinOpsReport,
  fetchFilteredFinOpsViaApi,
  remediateIdleDriftViaApi
} from '../../services/triCloudApiService';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface TriCloudFinOpsPanelProps {
  initialFinOps: TriCloudFinOpsReport;
}

export const TriCloudFinOpsPanel: React.FC<TriCloudFinOpsPanelProps> = ({ initialFinOps }) => {
  const [finops, setFinops] = useState<TriCloudFinOpsReport>(initialFinOps);
  const [cloudFilter, setCloudFilter] = useState<CloudProviderId | 'ALL'>('ALL');
  const [tenantFilter, setTenantFilter] = useState<string>('ALL');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleFilterChange = async (
    nextCloud: CloudProviderId | 'ALL',
    nextTenant: string
  ) => {
    setCloudFilter(nextCloud);
    setTenantFilter(nextTenant);
    setIsUpdating(true);
    try {
      const res = await fetchFilteredFinOpsViaApi(nextCloud, nextTenant);
      setFinops(res.finops);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemediateDrift = async (alertId: string) => {
    setIsUpdating(true);
    try {
      const res = await remediateIdleDriftViaApi(alertId);
      setFinops(res.finops);
    } finally {
      setIsUpdating(false);
    }
  };

  const spendChartData = useMemo(() => {
    return {
      labels: finops.cloudSpend.map((c) => c.cloud),
      datasets: [
        {
          label: 'Compute & OIDC Runners',
          data: finops.cloudSpend.map((c) => c.computeUsd),
          backgroundColor: '#22d3ee'
        },
        {
          label: 'WORM / Object Lock Storage',
          data: finops.cloudSpend.map((c) => c.wormStorageUsd),
          backgroundColor: '#10b981'
        },
        {
          label: 'KMS CMEK & TLS Ingress',
          data: finops.cloudSpend.map((c) => c.kmsCryptoUsd + c.networkFailoverUsd),
          backgroundColor: '#3b82f6'
        }
      ]
    };
  }, [finops.cloudSpend]);

  const marketplaceDoughnutData = useMemo(() => {
    return {
      labels: finops.marketplaceMetering.map((m) => m.marketplace),
      datasets: [
        {
          label: 'Metered Drawdown ($)',
          data: finops.marketplaceMetering.map((m) => m.meteredDrawdownUsd),
          backgroundColor: ['#f59e0b', '#3b82f6', '#06b6d4'],
          borderColor: '#0f172a',
          borderWidth: 2
        }
      ]
    };
  }, [finops.marketplaceMetering]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#cbd5e1', font: { family: 'monospace', size: 11 } }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: '#94a3b8' },
        grid: { color: '#1e293b' }
      },
      y: {
        stacked: true,
        ticks: { color: '#94a3b8' },
        grid: { color: '#1e293b' }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#cbd5e1', font: { family: 'monospace', size: 11 } }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Keyless FinOps Normalization (AWS Cost Explorer · GCP securebase-gcp-dev · Azure Cost Mgmt)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {(['ALL', 'AWS', 'GCP', 'AZURE'] as Array<CloudProviderId | 'ALL'>).map((cloud) => (
            <button
              key={cloud}
              onClick={() => handleFilterChange(cloud, tenantFilter)}
              disabled={isUpdating}
              className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                cloudFilter === cloud
                  ? 'bg-slate-800 border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cloud === 'ALL' ? 'All Clouds' : cloud}
            </button>
          ))}

          <select
            value={tenantFilter}
            onChange={(e) => handleFilterChange(cloudFilter, e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Enterprise Tenants</option>
            <option value="cnb-waxahachie">Citizens National Bank of Texas</option>
            <option value="texas-regional-health">Baylor Edge Clinical Consortium</option>
            <option value="meridian-fed-fin">Meridian Treasury Services</option>
          </select>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs font-mono text-slate-400">Normalized Monthly Spend</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            ${finops.totalMonthlySpendUsd.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-cyan-400 mt-1">WIF/OIDC Billing Read-Only</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs font-mono text-slate-400">Tenant Monthly ARR</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            ${finops.totalMonthlyRevenueUsd.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1">Marketplace Committed</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs font-mono text-slate-400">Blended Cost / Compliance Scan</div>
          <div className="text-2xl font-bold text-cyan-300 font-mono tabular-nums mt-1">
            ${finops.blendedCostPerScanUsd.toFixed(3)}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">Unit Scan Infra Cost</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs font-mono text-slate-400">Blended Gross Margin</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {finops.blendedGrossMarginPct}%
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">After Multi-Cloud Metering</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Normalized Multi-Cloud Cost Breakdown</h3>
              <p className="text-xs text-slate-400">Monthly spend across OIDC compute, WORM vaults, and KMS/TLS</p>
            </div>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="h-64">
            <Bar data={spendChartData} options={barOptions} />
          </div>
        </div>

        <div className="lg:col-span-5 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Marketplace EDP / MACC Metering</h3>
              <p className="text-xs text-slate-400">Reconciled annual commitment drawdown by cloud</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="h-64">
            <Doughnut data={marketplaceDoughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Per-Tenant Compliance Scan Unit Economics */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-sm font-bold text-white">Per-Tenant Compliance Scan Unit Economics</h3>
        <div className="border border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <th className="py-2.5 px-3">Tenant</th>
                <th className="py-2.5 px-3">Primary Cloud</th>
                <th className="py-2.5 px-3 text-right">Scans / Mo</th>
                <th className="py-2.5 px-3 text-right">Infra Cost</th>
                <th className="py-2.5 px-3 text-right">Cost / Scan</th>
                <th className="py-2.5 px-3 text-right">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {finops.tenantUnitEconomics.map((row) => (
                <tr key={row.tenantId}>
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {row.tenantName}
                    <div className="text-[11px] font-mono font-normal text-slate-400">{row.tier}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-cyan-300">{row.primaryCloud}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-200">
                    {row.scansExecuted.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-200">
                    ${row.monthlyInfraCostUsd.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right text-cyan-300">
                    ${row.costPerScanUsd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-right text-emerald-400 font-semibold">
                    {row.grossMarginPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Idle Resource Drift Alerts & Marketplace Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-sm font-bold text-white">Idle Resource Drift Alerts</h3>
          <div className="space-y-3">
            {finops.idleDriftAlerts.map((alert) => (
              <div
                key={alert.alertId}
                className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    {alert.status === 'OPEN' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="text-white font-semibold">{alert.resourceId}</span>
                    <span className="text-slate-400">· {alert.cloud}</span>
                  </div>
                  <div className="text-slate-400">{alert.reason}</div>
                  <div className="font-mono tabular-nums text-amber-300">
                    Est. Waste: ${alert.monthlyWasteUsd}/mo · Status: {alert.status}
                  </div>
                </div>
                <button
                  onClick={() => handleRemediateDrift(alert.alertId)}
                  disabled={isUpdating || alert.status === 'REMEDIATED'}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-xs font-mono text-cyan-300 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  {alert.status === 'REMEDIATED' ? 'Remediated' : 'Synthesize Cleanup'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-sm font-bold text-white">Tri-Cloud Marketplace Metering Reconciliation</h3>
          <div className="border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                  <th className="py-2.5 px-3">Marketplace</th>
                  <th className="py-2.5 px-3">OIDC Auth</th>
                  <th className="py-2.5 px-3 text-right">Drawdown</th>
                  <th className="py-2.5 px-3 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {finops.marketplaceMetering.map((m) => (
                  <tr key={m.marketplace}>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {m.marketplace}
                      <div className="text-[11px] font-mono font-normal text-slate-400">{m.offerId}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300">{m.authProtocol}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-200">
                      ${m.meteredDrawdownUsd.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-right text-emerald-400">
                      ${m.unreconciledDeltaUsd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
