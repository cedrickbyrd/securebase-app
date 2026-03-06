import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    monthlyUsage: {
       history: [65, 59, 80, 81, 56, 55, 40], // Fallback/Mock data
       labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    // ... rest of your state
  });

  // FIX: useCallback stabilizes this function identity
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { apiService } = await import('../services/apiService');
      const metrics = await apiService.getMetrics();
      
      setDashboardData(prev => ({
        ...prev,
        monthlyUsage: metrics.data,
      }));
    } catch (err) {
      console.error('Dashboard Error:', err);
    } finally {
      setLoading(false);
    }
  }, []); // Dependencies are empty so it never changes

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]); // Now safe to include in the array

  // Chart Data Configuration
  const chartData = {
    labels: dashboardData.monthlyUsage.labels || ['Jan', 'Feb', 'Mar'],
    datasets: [{
      label: 'CloudTrail Events',
      data: dashboardData.monthlyUsage.history || [0, 0, 0],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      tension: 0.4,
    }]
  };

  // ... inside your return, find the Usage Trends section:
  return (
    // ...
    <div className="sb-UsageTrends">
       <div className="sb-UsageTrends__header">
         <h2 className="sb-UsageTrends__title">Infrastructure Activity</h2>
       </div>
       <div className="sb-UsageTrends__chart">
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} height={200} />
       </div>
    </div>
    // ...
  );
}
