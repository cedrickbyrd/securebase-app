/**
 * SRE Dashboard Component with Analytics
 * 
 * Tracks the high-engagement SRE features you mentioned
 * (15.67 views per active user)
 */

import React, { useState, useEffect } from 'react';
import { ComplianceEvents } from '../utils/analytics';
import { 
  usePageTracking, 
  useSectionTracking, 
  useDebouncedTracking,
  useFeatureTracking 
} from '../hooks/useAnalytics';

const SREDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [filters, setFilters] = useState({
    region: 'all',
    service: 'all',
    severity: 'all'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('uptime');
  const [timeRange, setTimeRange] = useState('24h');
  
  // Track page view
  usePageTracking('SRE Dashboard', { feature: 'sre_monitoring' });
  
  // Track time spent in dashboard
  const dashboardRef = useSectionTracking('sre_dashboard');
  
  // Track advanced filter usage (first-time only)
  const trackAdvancedFilters = useFeatureTracking('advanced_filters');
  
  // Debounced search tracking
  const trackSearch = useDebouncedTracking((query, count) => {
    ComplianceEvents.dashboardSearchUsed(query, count, 'sre_dashboard');
  }, 500);
  
  // Load alerts on mount
  useEffect(() => {
    loadAlerts();
  }, []);
  
  const loadAlerts = async () => {
    // Your API call here
    // const response = await fetch('/api/alerts');
    // const data = await response.json();
    
    // Mock data
    const mockAlerts = [
      { id: 'alert_1', type: 'security', severity: 'critical', message: 'Unencrypted S3 bucket detected' },
      { id: 'alert_2', type: 'performance', severity: 'high', message: 'API latency exceeds threshold' },
      { id: 'alert_3', type: 'availability', severity: 'medium', message: 'Service degradation in us-west-2' }
    ];
    
    setAlerts(mockAlerts);
  };
  
  const handleAlertClick = (alert) => {
    // Track alert view
    ComplianceEvents.alertViewed(alert.id, alert.type, alert.severity);
    
    // Your navigation or modal logic
    console.log('Viewing alert:', alert);
  };
  
  const handleAlertAcknowledge = (alertId) => {
    const responseTime = Math.floor(Math.random() * 300); // Mock response time
    
    // Track acknowledgment
    ComplianceEvents.alertAcknowledged(alertId, responseTime);
    
    // Your API call to acknowledge
    console.log('Acknowledged alert:', alertId);
  };
  
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    
    // Track filter usage
    trackAdvancedFilters(); // First-time feature usage
    
    // Track the specific filter
    ComplianceEvents.infrastructureFiltered(filterType, value, alerts.length);
    
    // Apply filter to results
    applyFilters({ ...filters, [filterType]: value });
  };
  
  const applyFilters = (currentFilters) => {
    // Your filter logic here
    console.log('Applying filters:', currentFilters);
  };
  
  const handleSearch = (query) => {
    setSearchQuery(query);
    
    // Simulate search results
    const results = alerts.filter(alert => 
      alert.message.toLowerCase().includes(query.toLowerCase())
    );
    
    // Track search with debouncing
    if (query.length > 2) {
      trackSearch(query, results.length);
    }
  };
  
  const handleMetricChange = (metricType) => {
    setSelectedMetric(metricType);
    
    // Track metric visualization
    ComplianceEvents.metricViewed(metricType, timeRange);
  };
  
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    
    // Track time range change
    ComplianceEvents.filterApplied('time_range', range, 'sre_dashboard');
    
    // Re-track metric with new time range
    ComplianceEvents.metricViewed(selectedMetric, range);
  };
  
  const handleExportData = (format) => {
    // Track data export
    ComplianceEvents.dataExported('sre_metrics', format, alerts.length);
    
    // Your export logic
    console.log(`Exporting ${alerts.length} records as ${format}`);
  };
  
  return (
    <div ref={dashboardRef} className="sre-dashboard">
      <header>
        <h1>SRE Dashboard</h1>
        
        <div className="search-bar">
          <input 
            type="text"
            placeholder="Search infrastructure..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </header>
      
      <div className="filters">
        <select 
          value={filters.region}
          onChange={(e) => handleFilterChange('region', e.target.value)}
        >
          <option value="all">All Regions</option>
          <option value="us-east-1">US East 1</option>
          <option value="us-west-2">US West 2</option>
          <option value="eu-west-1">EU West 1</option>
        </select>
        
        <select 
          value={filters.service}
          onChange={(e) => handleFilterChange('service', e.target.value)}
        >
          <option value="all">All Services</option>
          <option value="ec2">EC2</option>
          <option value="s3">S3</option>
          <option value="rds">RDS</option>
          <option value="lambda">Lambda</option>
        </select>
        
        <select 
          value={filters.severity}
          onChange={(e) => handleFilterChange('severity', e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      
      <div className="metrics-section">
        <div className="metric-selector">
          <button 
            onClick={() => handleMetricChange('uptime')}
            className={selectedMetric === 'uptime' ? 'active' : ''}
          >
            Uptime
          </button>
          <button 
            onClick={() => handleMetricChange('latency')}
            className={selectedMetric === 'latency' ? 'active' : ''}
          >
            Latency
          </button>
          <button 
            onClick={() => handleMetricChange('error_rate')}
            className={selectedMetric === 'error_rate' ? 'active' : ''}
          >
            Error Rate
          </button>
          <button 
            onClick={() => handleMetricChange('compliance_drift')}
            className={selectedMetric === 'compliance_drift' ? 'active' : ''}
          >
            Compliance Drift
          </button>
        </div>
        
        <div className="time-range-selector">
          {['1h', '24h', '7d', '30d'].map(range => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={timeRange === range ? 'active' : ''}
            >
              {range}
            </button>
          ))}
        </div>
        
        <div className="metric-chart">
          {/* Your chart component here */}
          <p>Viewing {selectedMetric} over {timeRange}</p>
        </div>
      </div>
      
      <div className="alerts-section">
        <div className="section-header">
          <h2>Active Alerts ({alerts.length})</h2>
          <div className="export-actions">
            <button onClick={() => handleExportData('csv')}>Export CSV</button>
            <button onClick={() => handleExportData('json')}>Export JSON</button>
          </div>
        </div>
        
        <div className="alerts-list">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.severity}`}>
              <div className="alert-content" onClick={() => handleAlertClick(alert)}>
                <span className="alert-type">{alert.type}</span>
                <span className="alert-severity">{alert.severity}</span>
                <span className="alert-message">{alert.message}</span>
              </div>
              <button 
                onClick={() => handleAlertAcknowledge(alert.id)}
                className="btn-acknowledge"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SREDashboard;
