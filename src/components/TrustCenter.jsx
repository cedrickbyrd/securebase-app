import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2'; // Use the React wrapper
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TrustCenter = () => {
    const [metrics, setMetrics] = useState({
        infraHealth: "Verifying...",
        infraHealthChartData: { labels: [], datasets: [] }
    });

    const fetchMetrics = async () => {
        try {
            // Updated to your Netlify function endpoint for Phase 5
            const response = await fetch('/.netlify/functions/get-trust-metrics'); 
            const data = await response.json();
            setMetrics(data);
        } catch (error) {
            console.error('Trust Center Fetch Error:', error);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    return (
        <div className="sb-TrustCenter">
            <header className="sb-TrustCenter__header">
                <h1>Trust Center: Operational Transparency</h1>
                <span className="status-badge">Live System Health: {metrics.infraHealth}</span>
            </header>
            
            <div className="sb-SREDashboard__grid">
                <div className="sb-MetricCard">
                    <h2>Availability & Uptime</h2>
                    {metrics.infraHealthChartData.datasets.length > 0 ? (
                        <Line data={metrics.infraHealthChartData} />
                    ) : (
                        <p>Loading real-time telemetry...</p>
                    )}
                </div>
                {/* Additional cards follow the same pattern */}
            </div>
        </div>
    );
};

export default TrustCenter;
