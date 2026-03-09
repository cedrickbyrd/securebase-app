import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const SecurityOverview = ({ trafficData }) => {
  const data = {
    labels: ['Accepted Traffic', 'Rejected Traffic'],
    datasets: [
      {
        label: 'VPC Flow Log Distribution',
        data: trafficData || [85, 15], // Default mock data for initial eval
        backgroundColor: [
          'rgba(34, 197, 94, 0.6)', // Tailwind Green-500 equivalent
          'rgba(239, 68, 68, 0.6)',  // Tailwind Red-500 equivalent
        ],
        borderColor: ['#22c55e', '#ef4444'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="p-6 bg-slate-900 rounded-xl shadow-lg max-w-md">
      <h3 className="text-white text-lg font-bold mb-4">Traffic Analysis</h3>
      <Doughnut data={data} options={{ responsive: true }} />
    </div>
  );
};

export default SecurityOverview;
