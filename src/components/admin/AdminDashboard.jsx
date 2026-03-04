import React from 'react';
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

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const AdminDashboard = () => {
  // Mock Data for Phase 5 Platform Health
  const systemHealthData = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      {
        label: 'API Latency (ms)',
        data: [110, 145, 120, 190, 155, 130],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const securityThreatData = {
    labels: ['Blocked IPs', 'Failed Auth', 'WAF Alerts'],
    datasets: [
      {
        data: [320, 85, 42],
        backgroundColor: ['#ef4444', '#f59e0b', '#6366f1'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Central</h1>
        <p className="text-slate-500 font-medium">Phase 5: Real-time Infrastructure Observability</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Performance */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">System Latency (p95)</h3>
          <Line data={systemHealthData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>

        {/* Security Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Security Events (24h)</h3>
          <div className="max-h-[250px] flex justify-center">
            <Doughnut data={securityThreatData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-600 rounded-2xl p-8 text-white flex justify-between items-center shadow-lg shadow-blue-200">
        <div>
          <h2 className="text-xl font-bold">VPC Readiness Check</h2>
          <p className="opacity-80">Secondary region (us-west-2) is healthy and in-sync.</p>
        </div>
        <div className="px-4 py-2 bg-white/20 rounded-lg font-mono text-sm">
          STATUS: ACTIVE
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
// --- END OF FILE ---
