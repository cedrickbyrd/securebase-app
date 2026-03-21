import React, { useEffect, useState } from 'react';
import Chart from 'chart.js/auto';

const SREDashboard = () => {
    const [metrics, setMetrics] = useState({});

    // Fetch metrics from an API endpoint
    const fetchMetrics = async () => {
        try {
            const response = await fetch('/api/metrics'); // Replace with your API endpoint
            const data = await response.json();
            setMetrics(data);
        } catch (error) {
            console.error('Error fetching metrics:', error);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const intervalId = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="sb-SREDashboard">
            <h1>Infrastructure Dashboard</h1>
            <div className="sb-SREDashboard__grid">
                <div className="sb-MetricCard">
                    <h2>Infrastructure Health</h2>
                    <p>{metrics.infraHealth}</p>
                    <Chart data={metrics.infraHealthChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Deployment Stats</h2>
                    <p>{metrics.deploymentStats}</p>
                    <Chart data={metrics.deploymentStatsChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Auto-Scaling</h2>
                    <p>{metrics.autoScaling}</p>
                    <Chart data={metrics.autoScalingChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Database Metrics</h2>
                    <p>{metrics.databaseMetrics}</p>
                    <Chart data={metrics.databaseMetricsChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Cache Performance</h2>
                    <p>{metrics.cachePerformance}</p>
                    <Chart data={metrics.cachePerformanceChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Error Tracking</h2>
                    <p>{metrics.errorTracking}</p>
                    <Chart data={metrics.errorTrackingChartData} />
                </div>
                <div className="sb-MetricCard">
                    <h2>Lambda Metrics</h2>
                    <p>{metrics.lambdaMetrics}</p>
                    <Chart data={metrics.lambdaMetricsChartData} />
                </div>
            </div>
        </div>
    );
};

export default SREDashboard;