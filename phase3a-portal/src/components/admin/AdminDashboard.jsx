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
import { Line, Bar, Doughnut } from 'react-chartjs-2';

/**
 * IMPORTANT: To install dependencies for this component, use:
 * npm install react-chartjs-2 chart.js --save --legacy-peer-deps
 */

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
  // 1. Mock Data for Platform Health (Phase 5.1 Metrics)
  const systemHealthData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'API Latency (ms)',
        data: [120, 135, 125, 150, 140, 110, 115],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const securityThreatData = {
    labels: ['Blocked IPs', 'Failed Auth', 'WAF Alerts'],
    datasets: [
      {
        data: [450, 120, 85],
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6'],
        hoverOffset: 4,
      },
    ],
  };

  return (
    <div className="admin-dashboard p-6 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">SecureBase Admin Central</h1>
        <p className="text-gray-600">Phase 5: Observability & Platform Health Monitor</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* API Performance Chart */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4">System Latency (p95)</h3>
          <Line data={systemHealthData} options={{ responsive: true }} />
        </div>

        {/* Security Distribution */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4">Security Events (Last 24h)</h3>
          <div className="max-h-[300px] flex justify-center">
            <Doughnut data={securityThreatData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Infrastructure Status */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-semibold mb-4">Instance Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Primary (us-east-1)</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">HEALTHY</span>
            </div>
            <div className="flex justify-between items-center">
              <span>DR Standby (us-west-2)</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">SYNCING</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">Uptime SLA: 99.95%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
