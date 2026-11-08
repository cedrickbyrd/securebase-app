// phase3a-portal/src/components/tenant/ComplianceDrift.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, TimeScale, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  AlertTriangle, CheckCircle, Clock, Database, Filter, ShieldCheck, XCircle
} from 'lucide-react';
import { apiService } from '../../services/apiService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Tooltip, Legend, Filler);

export default function ComplianceDrift({ tenantId }) {
  const [driftEvents, setDriftEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [complianceHistory, setComplianceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    framework: 'all',
    severity: 'all',
    status: 'all',
    dateRange: '90d'
  });

  // Client-side Analytics Calculations
  const calculateMTTR = (events) => {
    const resolvedEvents = events.filter(e => (e.status === 'resolved' || e.status === 'SYNCED') && e.resolutionTimestamp);
    if (resolvedEvents.length === 0) return 0;
    const totalTime = resolvedEvents.reduce((sum, event) => {
      return sum + (new Date(event.resolutionTimestamp).getTime() - new Date(event.detectionTimestamp || event.created_at).getTime());
    }, 0);
    return Math.round((totalTime / resolvedEvents.length) / (1000 * 60 * 60) * 10) / 10;
  };

  const calculateDriftFrequency = (events) => {
    const counts = {};
    events.forEach(e => {
      const category = e.controlCategory || e.category || 'Uncategorized';
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, count]) => ({ category, count }));
  };

  const getTopDriftingControls = (events) => {
    const counts = {};
    events.forEach(e => {
      const id = e.controlId || e.rule_id || 'Unknown';
      const name = e.controlName || e.rule_name || 'Unnamed Rule';
      const key = `${id}: ${name}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([control, count]) => ({ control, count }));
  };

  const fetchDriftData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await apiService.getDriftAnalytics(tenantId);
      
      setComplianceHistory(data.history || []);
      setDriftEvents(data.events || []);
      
      setAnalytics({
        mttr: calculateMTTR(data.events || []),
        frequency: calculateDriftFrequency(data.events || []),
        topDriftingControls: getTopDriftingControls(data.events || [])
      });
      setError(null);
    } catch (err) {
      console.error('[ComplianceDrift] Failed to load drift data:', err);
      setError('Failed to load drift analytics.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchDriftData();
  }, [fetchDriftData]);

  useEffect(() => {
    let filtered = [...driftEvents];
    if (filters.framework !== 'all') {
      filtered = filtered.filter(e => (e.framework || '').toLowerCase() === filters.framework.toLowerCase());
    }
    if (filters.severity !== 'all') {
      filtered = filtered.filter(e => (e.severity || '').toLowerCase() === filters.severity.toLowerCase());
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter(e => (e.status || '').toLowerCase() === filters.status.toLowerCase());
    }
    setFilteredEvents(filtered);
  }, [filters, driftEvents]);

  // --- UI Helpers ---
  const getSeverityColor = (severity = '') => {
    const s = severity.toLowerCase();
    const colors = {
      critical: 'text-red-700 bg-red-100 border border-red-300',
      high: 'text-orange-700 bg-orange-100 border border-orange-300',
      medium: 'text-yellow-800 bg-yellow-100 border border-yellow-300',
      low: 'text-blue-700 bg-blue-100 border border-blue-300'
    };
    return colors[s] || 'text-gray-700 bg-gray-100 border border-gray-300';
  };

  const getStatusBadge = (status = '') => {
    const s = status.toLowerCase();
    if (s === 'pending_s3_sync') {
      return { 
        text: 'Buffered (PostgreSQL WORM)', 
        icon: Database, 
        color: 'bg-amber-100 text-amber-900 border border-amber-300',
        pulse: true 
      };
    }
    if (s === 'synced' || s === 'resolved') {
      return { 
        text: 'Immutable (S3 WORM)', 
        icon: ShieldCheck, 
        color: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
        pulse: false 
      };
    }
    if (s === 'in_progress') {
      return { 
        text: 'In Progress', 
        icon: Clock, 
        color: 'bg-blue-100 text-blue-900 border border-blue-300',
        pulse: false 
      };
    }
    if (s === 'open' || s === 'failed') {
      return { 
        text: 'Non-Compliant / Open', 
        icon: AlertTriangle, 
        color: 'bg-rose-100 text-rose-900 border border-rose-300',
        pulse: false 
      };
    }
    return { 
      text: status || 'Unknown', 
      icon: XCircle, 
      color: 'bg-gray-100 text-gray-800 border border-gray-300',
      pulse: false 
    };
  };

  // --- Chart Configuration ---
  const driftDays = driftEvents.map(e => new Date(e.detectionTimestamp || e.created_at).toLocaleDateString());
  const chartData = {
    labels: complianceHistory.map(h => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Overall Compliance Score',
      data: complianceHistory.map(h => h.score),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: (ctx) => driftDays.includes(chartData.labels[ctx.dataIndex]) ? 8 : 2,
      pointBackgroundColor: (ctx) => driftDays.includes(chartData.labels[ctx.dataIndex]) ? '#ef4444' : '#22c55e',
      pointBorderColor: (ctx) => driftDays.includes(chartData.labels[ctx.dataIndex]) ? '#dc2626' : '#16a34a',
    }]
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>;
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">{error}</div>;

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Framework</label>
            <select value={filters.framework} onChange={(e) => setFilters({ ...filters, framework: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Frameworks</option>
              <option value="soc2">SOC 2</option>
              <option value="hipaa">HIPAA</option>
              <option value="ffiec-cat">FFIEC CAT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              <option value="open">Open / Drifted</option>
              <option value="pending_s3_sync">Buffered (PostgreSQL WORM)</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Immutable (S3 WORM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Mean Time to Resolve</h3>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics?.mttr || 0}h</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Active Drift Events</h3>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{filteredEvents.filter(e => e.status !== 'resolved' && e.status !== 'SYNCED').length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Buffered Records</h3>
            <Database className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-600">
            {driftEvents.filter(e => (e.status || '').toLowerCase() === 'pending_s3_sync').length}
          </div>
        </div>
      </div>

      {/* Interactive Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Timeline (90 Days)</h3>
        <div className="h-72">
          <Line 
            data={chartData} 
            options={{ 
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { min: 80, max: 100 } }
            }} 
          />
        </div>
      </div>

      {/* Rich Drift Event Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Compliance & Drift Events</h3>
        {filteredEvents.map(event => {
          const StatusBadge = getStatusBadge(event.status);
          const Icon = StatusBadge.icon;
          const controlId = event.controlId || event.rule_id || 'UNKNOWN';
          const controlName = event.controlName || event.rule_name || 'Policy Verification';
          const summary = event.summary || event.rootCause || 'No summary available.';
          const hash = event.evidence_hash || event.sha256Evidence;
          const steps = event.remediationSteps || (Array.isArray(event.payload?.remediation) ? event.payload.remediation : event.remediation);

          return (
            <div key={event.id || `${controlId}-${event.run_id}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex flex-wrap gap-2 mb-2 items-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityColor(event.severity)} uppercase`}>
                      {event.severity || 'HIGH'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${StatusBadge.color} flex items-center gap-1.5`}>
                      {StatusBadge.pulse && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      <Icon className="w-3.5 h-3.5" /> {StatusBadge.text}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700 uppercase">
                      {event.framework || 'SOC 2'}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{controlId}: {controlName}</h4>
                  <p className="text-sm text-gray-600 mt-1"><strong>Finding / Root Cause:</strong> {summary}</p>
                  {hash && (
                    <p className="text-xs font-mono text-gray-500 mt-1 break-all">
                      SHA-256 Digest: {hash}
                    </p>
                  )}
                </div>
              </div>
              {steps && steps.length > 0 && (
                <div className="bg-gray-50 rounded p-4 text-sm mt-4 border border-gray-100">
                  <p className="font-semibold text-gray-700 mb-2">Remediation Steps:</p>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {Array.isArray(steps) 
                      ? steps.map((step, i) => <li key={i}>{step}</li>)
                      : <li>{steps}</li>}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
