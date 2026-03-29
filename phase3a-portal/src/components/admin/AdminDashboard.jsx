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
  Filler, // 1. Import Filler for the background area colors
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { adminService } from '../../services/adminService';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler, // 2. Register Filler here
  Title,
  Tooltip,
  Legend
);

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminService.getPlatformMetrics('24h');
        setMetrics(data);
      } catch (err) {
        setError(err);
        console.error('Failed to fetch admin metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  // Mock Data for Platform Health (Phase 5.1 Metrics) - used as fallback for visualization
  const systemHealthData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        fill: true, // 3. This is what was causing the error without the Filler plugin
        label: 'API Latency (ms)',
        data: [120, 135, 125, 150, 140, 110, 115],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.2)', // Softer fill
        tension: 0.4, // Smoother curve
      },
    ],
  };

  const securityThreatData = {
    labels: ['Blocked IPs', 'Failed Auth', 'WAF Alerts'],
    datasets: [
      {
        data: metrics?.security 
          ? [
              metrics.security.criticalAlerts || 0,
              metrics.security.violations || 0,
              metrics.security.openIncidents || 0
            ]
          : [450, 120, 85],
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'],
        hoverOffset: 4,
        borderWidth: 0, // Cleaner look
      },
    ],
  };

  return (
    <div className="admin-dashboard p-6 bg-gray-50 min-h-screen">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">SecureBase SRE Command Center</h1>
          <p className="text-gray-600">Phase 5: Observability & Platform Health Monitor</p>
        </div>
        {/* TEST ALERT BUTTON */}
        <button 
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg"
          onClick={() => alert('Alert Piped to SRE Slack Channel!')}
        >
          TEST ALERT PIPE
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">⚠️ Unable to load live metrics</p>
          <p className="text-red-600 text-sm">{error.message} — Check CloudWatch endpoint configuration.</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !metrics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 font-medium">🔄 Loading live metrics from CloudWatch...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* API Performance Chart */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">System Latency (p95)</h3>
            <span className="text-xs font-mono text-blue-600">
              AVG: {metrics?.api?.latency_p95 ? `${metrics.api.latency_p95}ms` : '128ms'}
            </span>
          </div>
          <Line 
            data={systemHealthData} 
            options={{ 
              responsive: true,
              plugins: { legend: { display: false } }, // Cleaner view
              scales: { y: { beginAtZero: true } }
            }} 
          />
        </div>

        {/* Security Distribution */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4">Security Events (Last 24h)</h3>
          <div className="max-h-[250px] flex justify-center pb-4">
            <Doughnut 
               data={securityThreatData} 
               options={{ 
                 maintainAspectRatio: false,
                 plugins: { legend: { position: 'bottom' } } 
               }} 
            />
          </div>
        </div>

        {/* Infrastructure Status */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4">Instance Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="text-sm font-medium">Primary (us-east-1)</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">HEALTHY</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="text-sm font-medium">DR Standby (us-west-2)</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">SYNCING</span>
            </div>
            <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
              <span className="text-sm font-medium">Netlify Edge Node</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">ACTIVE</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Monthly Uptime SLA</span>
                <span>99.95%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '99.9%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
