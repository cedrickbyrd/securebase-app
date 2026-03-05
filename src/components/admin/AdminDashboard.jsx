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
import { Loader, AlertCircle, Bell } from 'lucide-react'; // Added Bell icon
import { supabase } from '../../lib/supabase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendingAlert, setSendingAlert] = useState(false);

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

  // --- Phase 5.2 Alert Trigger ---
  const triggerTestAlert = async () => {
    setSendingAlert(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/.netlify/functions/post-security-alert', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: "WAF_THREAT_DETECTED",
          severity: "HIGH",
          message: "Manual test alert triggered from Admin Dashboard for cedrickjbyrd@me.com"
        })
      });
      if (response.ok) alert("🚀 Slack Alert Sent!");
    } catch (err) {
      console.error("Alert failed:", err);
    } finally {
      setSendingAlert(false);
    }
  };

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
    <div className="p-8 bg-slate-50 min-h-screen font-sans animate-in fade-in duration-500">
      <header className="mb-10 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Central</h1>
          <p className="text-slate-500 font-medium italic">Live Infrastructure Telemetry</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button 
            onClick={triggerTestAlert}
            disabled={sendingAlert}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all disabled:opacity-50"
          >
            {sendingAlert ? <Loader className="animate-spin w-3 h-3" /> : <Bell size={12} />}
            Test Alert Pipe
          </button>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Last Pulse</p>
            <p className="text-xs font-mono text-slate-600">{new Date(metrics.timestamp).toLocaleTimeString()}</p>
          </div>
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

      <div className="mt-8 bg-slate-900 rounded-2xl p-8 text-white flex justify-between items-center border border-slate-800 shadow-xl shadow-slate-200">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
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
