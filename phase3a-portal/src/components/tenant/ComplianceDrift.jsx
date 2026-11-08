// phase3a-portal/src/components/tenant/ComplianceDrift.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, TimeScale, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  AlertTriangle, CheckCircle, Clock, Filter, XCircle
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
    const resolvedEvents = events.filter(e => e.status === 'resolved' && e.resolutionTimestamp);
    if (resolvedEvents.length === 0) return 0;
    const totalTime = resolvedEvents.reduce((sum, event) => {
      return sum + (new Date(event.resolutionTimestamp).getTime() - new Date(event.detectionTimestamp).getTime());
    }, 0);
    return Math.round((totalTime / resolvedEvents.length) / (1000 * 60 * 60) * 10) / 10;
  };

  const calculateDriftFrequency = (events) => {
    const counts = {};
    events.forEach(e => counts[e.controlCategory || 'Uncategorized'] = (counts[e.controlCategory] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, count]) => ({ category, count }));
  };

  const getTopDriftingControls = (events) => {
    const counts = {};
    events.forEach(e => {
      const key = `${e.controlId}: ${e.controlName}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([control, count]) => ({ control, count }));
  };

  const fetchDriftData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Fetches rich payload via apiService interceptor
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
      console.error('[ComplianceDrift] Failed to load rich drift data:', err);
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
    if (filters.framework !== 'all') filtered = filtered.filter(e => e.framework === filters.framework);
    if (filters.severity !== 'all') filtered = filtered.filter(e => e.severity === filters.severity);
    if (filters.status !== 'all') filtered = filtered.filter(e => e.status === filters.status);
    setFilteredEvents(filtered);
  }, [filters, driftEvents]);

  // --- UI Helpers ---
  const getSeverityColor = (severity) => {
    const colors = { critical: 'text-red-600 bg-red-100 border-red-300', high: 'text-orange-600 bg-orange-100 border-orange-300', medium: 'text-yellow-600 bg-yellow-100 border-yellow-300', low: 'text-blue-600 bg-blue-100 border-blue-300' };
    return colors[severity] || 'text-gray-600 bg-gray-100 border-gray-300';
  };

  const getStatusBadge = (status) => {
    const badges = {
      resolved: { text: 'Resolved', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
      in_progress: { text: 'In Progress', icon: Clock, color: 'bg-blue-100 text-blue-800' },
      open: { text: 'Open', icon: AlertTriangle, color: 'bg-red-100 text-red-800' }
    };
    return badges[status] || { text: 'Unknown', icon: XCircle, color: 'bg-gray-100 text-gray-800' };
  };

  // --- Chart Configuration ---
  const driftDays = driftEvents.map(e => new Date(e.detectionTimestamp).toLocaleDateString());
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
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
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
          <div className="text-3xl font-bold text-gray-900">{filteredEvents.filter(e => e.status !== 'resolved').length}</div>
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
        <h3 className="text-lg font-semibold text-gray-900">Drift Events</h3>
        {filteredEvents.map(event => {
          const StatusBadge = getStatusBadge(event.status);
          const Icon = StatusBadge.icon;
          return (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityColor(event.severity)} uppercase`}>{event.severity}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${StatusBadge.color} flex items-center gap-1`}>
                      <Icon className="w-3 h-3" /> {StatusBadge.text}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700 uppercase">{event.framework}</span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{event.controlId}: {event.controlName}</h4>
                  <p className="text-sm text-gray-500 mt-1"><strong>Root Cause:</strong> {event.rootCause}</p>
                  {event.sha256Evidence && (
                    <p className="text-xs font-mono text-gray-400 mt-1">SHA-256: {event.sha256Evidence}</p>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded p-4 text-sm mt-4">
                <p className="font-semibold text-gray-700 mb-2">Remediation Steps:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {event.remediationSteps?.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
