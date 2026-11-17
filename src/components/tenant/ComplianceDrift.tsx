import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  Filter,
  Calendar,
  Shield,
  XCircle,
  Building2,
  Lock,
  Layers,
  ArrowRight,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { DriftEvent, DriftHistoryPoint } from '../../services/mockApiService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

interface ComplianceDriftProps {
  tenantId?: string;
  onTenantChange?: (tenantId: string) => void;
}

const AVAILABLE_TENANTS = [
  { id: 'cnb-waxahachie', name: 'Citizens National Bank (Waxahachie)', domain: 'Regional Banking & FFIEC' },
  { id: 'ibg-texas', name: 'Independent Bank Group (IBG)', domain: 'Regional Banking & SOC 2' },
  { id: 'bswhealth-dallas', name: 'Baylor Scott & White Health', domain: 'Health System & HIPAA' },
  { id: 'cookchildrens-fw', name: "Cook Children's Health Care System", domain: 'Pediatric ePHI & HIPAA' }
];

export function ComplianceDrift({
  tenantId = 'cnb-waxahachie',
  onTenantChange
}: ComplianceDriftProps) {
  const [activeTenant, setActiveTenant] = useState<string>(tenantId);
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<DriftEvent[]>([]);
  const [complianceHistory, setComplianceHistory] = useState<DriftHistoryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    framework: string;
    severity: string;
    status: string;
    dateRange: string;
  }>({
    framework: 'all',
    severity: 'all',
    status: 'all',
    dateRange: '90d'
  });

  const calculateMTTR = (events: DriftEvent[]): number => {
    const resolvedEvents = events.filter((e) => e.status === 'resolved' && e.resolutionTimestamp);
    if (resolvedEvents.length === 0) return 0;
    const totalTime = resolvedEvents.reduce((sum, event) => {
      const start = new Date(event.detectionTimestamp).getTime();
      const end = new Date(event.resolutionTimestamp!).getTime();
      return sum + (end - start);
    }, 0);
    return Math.round((totalTime / resolvedEvents.length / (1000 * 60 * 60)) * 10) / 10;
  };

  const calculateDriftFrequency = (events: DriftEvent[]) => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const cat = e.controlCategory || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  };

  const getTopDriftingControls = (events: DriftEvent[]) => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const key = `${e.controlId}: ${e.controlName}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([control, count]) => ({ control, count }));
  };

  const fetchDriftData = useCallback(async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const data = await apiService.getDriftAnalytics(activeTenant);
      setComplianceHistory(data.history || []);
      setDriftEvents(data.events || []);
      setError(null);
    } catch (err) {
      console.error('[ComplianceDrift] Failed to load drift data:', err);
      setError('Failed to load drift analytics.');
    } finally {
      setLoading(false);
    }
  }, [activeTenant]);

  useEffect(() => {
    fetchDriftData();
  }, [fetchDriftData]);

  // Sync external tenantId prop if changed
  useEffect(() => {
    if (tenantId && tenantId !== activeTenant) {
      setActiveTenant(tenantId);
    }
  }, [tenantId]);

  useEffect(() => {
    let filtered = [...driftEvents];
    if (filters.framework !== 'all') {
      filtered = filtered.filter((e) => e.framework.toLowerCase() === filters.framework.toLowerCase());
    }
    if (filters.severity !== 'all') {
      filtered = filtered.filter((e) => e.severity === filters.severity);
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter((e) => e.status === filters.status);
    }
    setFilteredEvents(filtered);
  }, [filters, driftEvents]);

  const mttr = useMemo(() => calculateMTTR(driftEvents), [driftEvents]);
  const activeViolationsCount = useMemo(
    () => filteredEvents.filter((e) => e.status !== 'resolved').length,
    [filteredEvents]
  );
  const resolvedCount = useMemo(
    () => filteredEvents.filter((e) => e.status === 'resolved').length,
    [filteredEvents]
  );

  const getSeverityBadgeClass = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'text-rose-400 bg-rose-950/40 border-rose-800/80',
      high: 'text-amber-400 bg-amber-950/40 border-amber-800/80',
      medium: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/80',
      low: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/80'
    };
    return colors[severity] || 'text-slate-400 bg-slate-900 border-slate-800';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; icon: any; color: string }> = {
      resolved: { text: 'Resolved', icon: CheckCircle, color: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/80' },
      in_progress: { text: 'In Progress', icon: Clock, color: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/80' },
      open: { text: 'Open Drift', icon: AlertTriangle, color: 'bg-rose-950/50 text-rose-400 border-rose-800/80' }
    };
    return badges[status] || { text: 'Unknown', icon: XCircle, color: 'bg-slate-900 text-slate-400 border-slate-800' };
  };

  // Build drift detection date strings for charting
  const driftDays = useMemo(
    () => driftEvents.map((e) => new Date(e.detectionTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    [driftEvents]
  );

  const chartLabels = useMemo(
    () => complianceHistory.map((h) => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    [complianceHistory]
  );

  const chartData = useMemo(() => {
    return {
      labels: chartLabels,
      datasets: [
        {
          label: 'Overall Compliance Posture Score',
          data: complianceHistory.map((h) => h.score),
          borderColor: '#10b981', // Emerald-500
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: (ctx: any) => {
            const label = chartLabels[ctx.dataIndex];
            return driftDays.includes(label) ? 6 : 0;
          },
          pointHoverRadius: 8,
          pointBackgroundColor: (ctx: any) => {
            const label = chartLabels[ctx.dataIndex];
            return driftDays.includes(label) ? '#ef4444' : '#10b981';
          },
          pointBorderColor: (ctx: any) => {
            const label = chartLabels[ctx.dataIndex];
            return driftDays.includes(label) ? '#ffffff' : '#047857';
          },
          pointBorderWidth: 2
        }
      ]
    };
  }, [chartLabels, complianceHistory, driftDays]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#020617',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        titleFont: { family: 'monospace', size: 11 },
        bodyFont: { family: 'monospace', size: 11 },
        padding: 10,
        callbacks: {
          label: (context) => `Compliance Score: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(51, 65, 85, 0.25)'
        },
        ticks: {
          color: '#64748b',
          font: { family: 'monospace', size: 10 },
          maxTicksLimit: 12
        }
      },
      y: {
        min: 75,
        max: 100,
        grid: {
          color: 'rgba(51, 65, 85, 0.25)'
        },
        ticks: {
          color: '#64748b',
          font: { family: 'monospace', size: 10 },
          stepSize: 5,
          callback: (value) => `${value}%`
        }
      }
    }
  };

  const copyShaToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3 font-mono text-xs text-slate-400">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        <span>Loading 90-day compliance drift analytics for {activeTenant}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/30 border border-rose-800 rounded-xl text-rose-300 font-mono text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Error Loading Drift Telemetry</span>
        </div>
        <p>{error}</p>
        <button
          onClick={fetchDriftData}
          className="px-3 py-1 bg-slate-900 border border-slate-700 text-slate-200 rounded hover:bg-slate-800 cursor-pointer text-xs"
        >
          Retry Fetch
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tenant Selector & Telemetry Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-400">Target Tenant:</span>
              <span className="text-white font-bold">
                {AVAILABLE_TENANTS.find((t) => t.id === activeTenant)?.name || activeTenant}
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-semibold">
                {AVAILABLE_TENANTS.find((t) => t.id === activeTenant)?.domain || 'Tenant Sandbox'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous 90-Day Regulatory Drift Analytics &middot; Shift-Left PR Enforcement &middot; WORM Audit Defense
            </p>
          </div>
        </div>

        {/* Tenant Switcher dropdown */}
        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">Tenant:</span>
          <select
            value={activeTenant}
            onChange={(e) => {
              setActiveTenant(e.target.value);
              if (onTenantChange) onTenantChange(e.target.value);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
          >
            {AVAILABLE_TENANTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchDriftData}
            title="Refresh drift analytics"
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
            <span>Mean Time to Resolve (MTTR)</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {mttr} <span className="text-base text-slate-400 font-sans font-normal">hours</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Average elapsed time from detection to non-destructive PR patch
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
            <span>Active Drift Events</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-400 tabular-nums">
            {activeViolationsCount} <span className="text-base text-slate-400 font-sans font-normal">unresolved</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {activeViolationsCount > 0 ? 'Requires HCL remediation approval' : 'All controls nominal'}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase tracking-wider">
            <span>Resolved Drift Incidents</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">
            {resolvedCount} <span className="text-base text-slate-400 font-sans font-normal">vaulted</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Cryptographically anchored with SHA-256 evidence digests
          </div>
        </div>
      </div>

      {/* 90-Day Timeline Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Compliance Posture Timeline (90 Days)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous posture scoring across 90 rolling days. Red markers indicate detected configuration drift events.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Nominal Score</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Drift Injected</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Filter Bar & Events List */}
      <div className="space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">Drift Incident Ledger:</span>
            <span className="text-slate-400">
              Showing {filteredEvents.length} of {driftEvents.length} event{driftEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* Framework Filter */}
            <select
              value={filters.framework}
              onChange={(e) => setFilters({ ...filters, framework: e.target.value })}
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 text-xs cursor-pointer"
            >
              <option value="all">All Frameworks</option>
              <option value="soc2">SOC 2</option>
              <option value="hipaa">HIPAA</option>
              <option value="ffiec-cat">FFIEC CAT</option>
            </select>

            {/* Severity Filter */}
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 text-xs cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500 text-xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="resolved">Resolved</option>
              <option value="in_progress">In Progress</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>

        {/* Detailed Event Cards */}
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-400 font-mono text-xs">
              No drift events matching the active filter criteria.
            </div>
          ) : (
            filteredEvents.map((event) => {
              const statusBadge = getStatusBadge(event.status);
              const StatusIcon = statusBadge.icon;
              return (
                <div
                  key={event.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-xs">
                        <span className={`px-2 py-0.5 rounded border font-bold text-[10px] uppercase ${getSeverityBadgeClass(event.severity)}`}>
                          {event.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 font-semibold ${statusBadge.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusBadge.text}</span>
                        </span>
                        <span className="text-slate-500">&middot;</span>
                        <span className="text-slate-400 uppercase text-[10px]">
                          {event.framework.toUpperCase()}
                        </span>
                        <span className="text-slate-500">&middot;</span>
                        <span className="text-slate-400 text-[10px]">
                          Category: {event.controlCategory}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white tracking-tight">
                        <span className="text-cyan-400 font-mono mr-2">{event.controlId}:</span>
                        {event.controlName}
                      </h4>
                    </div>

                    <div className="text-right font-mono text-[11px] text-slate-400 shrink-0">
                      <div>Detected: {new Date(event.detectionTimestamp).toLocaleDateString()}</div>
                      {event.resolutionTimestamp && (
                        <div className="text-emerald-400">
                          Resolved: {new Date(event.resolutionTimestamp).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Root Cause Box */}
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                    <span className="font-mono text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                      Root Cause Finding:
                    </span>
                    <p className="text-slate-200 font-sans leading-relaxed">
                      {event.rootCause}
                    </p>
                  </div>

                  {/* Remediation Steps */}
                  <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-2">
                    <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      Autonomous Remediation &amp; Guardrails Applied:
                    </span>
                    <ul className="space-y-1 text-slate-300 font-sans">
                      {event.remediationSteps?.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>

                    {event.resolutionNotes && (
                      <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                        <strong className="text-slate-300">Resolution Note:</strong> {event.resolutionNotes}
                      </div>
                    )}
                  </div>

                  {/* Evidence SHA-256 Digest */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                    <div className="flex items-center gap-2 text-slate-400 truncate">
                      <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Evidence SHA-256 Digest:</span>
                      <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate">
                        {event.sha256Evidence}
                      </code>
                    </div>

                    <button
                      onClick={() => copyShaToClipboard(event.sha256Evidence)}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedSha === event.sha256Evidence ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
