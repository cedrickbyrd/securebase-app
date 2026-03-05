import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { Loader, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Register ChartJS modules
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No active session found.");

        const response = await fetch('/.netlify/functions/get-admin-metrics', {
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aggregating Admin Intelligence...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-4 text-red-700">
        <AlertCircle />
        <p className="font-semibold">Access Denied: {error}</p>
      </div>
    </div>
  );

  // Prepare Chart Data from API response
  const latencyChartData = {
    labels: ['T-5h', 'T-4h', 'T-3h', 'T-2h', 'T-1h', 'Now'],
    datasets: [{
      label: 'Latency (ms)',
      data: metrics.latency,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
    }]
  };

  const securityData = {
    labels: ['Blocked IPs', 'Failed Auth', 'WAF Alerts'],
    datasets: [{
      data: [metrics.securityEvents.blockedIps, metrics.securityEvents.failedAuth, metrics.securityEvents.wafAlerts],
      backgroundColor: ['#ef4444', '#f59e0b', '#6366f1'],
      borderWidth: 0,
    }]
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Central</h1>
          <p className="text-slate-500 font-medium italic">Live Infrastructure Telemetry</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Last Pulse</p>
          <p className="text-xs font-mono text-slate-600">{new Date(metrics.timestamp).toLocaleTimeString()}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">API Latency (p95)</h3>
          <Line data={latencyChartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Security Events (24h)</h3>
          <div className="max-h-[250px] flex justify-center">
            <Doughnut data={securityData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-slate-900 rounded-2xl p-8 text-white flex justify-between items-center border border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Infrastructure Status
          </h2>
          <p className="opacity-60 text-sm">Primary: {metrics.systemStatus.primaryRegion} | DR: {metrics.systemStatus.drRegion}</p>
        </div>
        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg font-mono text-sm">
          SYNC: {metrics.systemStatus.drStatus}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
