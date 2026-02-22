import React, { useState, useEffect, useCallback } from 'react';
import {
  Server, Database, Zap, AlertTriangle,
  CheckCircle, Activity, TrendingUp, Cloud
} from 'lucide-react';

const SystemHealth = ({ timeRange, loading: parentLoading }) => {
  const [healthData, setHealthData] = useState({
    services: [],
    regions: [],
    incidents: []
  });

  // 1. Wrap the logic in useCallback to prevent "cascading renders"
  const fetchHealthData = useCallback(() => {
    // In the future, this is where your fetch('api/health') goes
    setHealthData({
      services: [
        { name: 'API Gateway', status: 'operational', uptime: 99.98, region: 'us-east-1' },
        { name: 'Lambda Functions', status: 'operational', uptime: 99.95, region: 'us-east-1' },
        { name: 'DynamoDB', status: 'operational', uptime: 99.99, region: 'us-east-1' },
        { name: 'Aurora (Primary)', status: 'operational', uptime: 99.97, region: 'us-east-1' },
        { name: 'CloudFront', status: 'operational', uptime: 100.0, region: 'global' },
        { name: 'S3 Buckets', status: 'operational', uptime: 99.99, region: 'us-east-1' },
        { name: 'ElastiCache', status: 'degraded', uptime: 98.50, region: 'us-east-1' },
        { name: 'SQS Queues', status: 'operational', uptime: 99.96, region: 'us-east-1' }
      ],
      regions: [
        { name: 'us-east-1', status: 'healthy', services: 8, latency: 45 },
        { name: 'us-west-2', status: 'healthy', services: 8, latency: 52 }
      ],
      incidents: [
        {
          id: 'INC-001',
          title: 'ElastiCache intermittent connection timeouts',
          severity: 'medium',
          status: 'investigating',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          affectedServices: ['ElastiCache', 'API Gateway']
        }
      ]
    });
  }, []); // Empty dependencies for mock data

  useEffect(() => {
    fetchHealthData();
    
    // 2. Continuous Monitoring: Real SRE dashboards poll for updates
    const interval = setInterval(fetchHealthData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchHealthData, timeRange]);

  // ... (Your existing getStatusColor and getStatusIcon functions remain the same)

  return (
    <div className="space-y-6">
       {/* ... Your existing JSX rendering logic ... */}
       {/* (It looks great as is, no changes needed to the UI code) */}
    </div>
  );
};

export default SystemHealth;import React, { useState, useEffect } from 'react';
import {
  Server, Database, Zap, AlertTriangle,
  CheckCircle, Activity, TrendingUp, Cloud
} from 'lucide-react';

/**
 * SystemHealth Component - Phase 5
 * 
 * Displays real-time system health metrics with visual indicators
 * Integrates with CloudWatch, AWS Health, and custom metrics
 * 
 * Features:
 * - Service status indicators (operational, degraded, down)
 * - Resource utilization (CPU, memory, network)
 * - Health checks across regions
 * - Incident timeline
 */
const SystemHealth = ({ timeRange, loading }) => {
  const [healthData, setHealthData] = useState({
    services: [],
    regions: [],
    incidents: []
  });

  // Mock data for demonstration (replace with real API call)
  useEffect(() => {
    // Simulated health data
    setHealthData({
      services: [
        { name: 'API Gateway', status: 'operational', uptime: 99.98, region: 'us-east-1' },
        { name: 'Lambda Functions', status: 'operational', uptime: 99.95, region: 'us-east-1' },
        { name: 'DynamoDB', status: 'operational', uptime: 99.99, region: 'us-east-1' },
        { name: 'Aurora (Primary)', status: 'operational', uptime: 99.97, region: 'us-east-1' },
        { name: 'CloudFront', status: 'operational', uptime: 100.0, region: 'global' },
        { name: 'S3 Buckets', status: 'operational', uptime: 99.99, region: 'us-east-1' },
        { name: 'ElastiCache', status: 'degraded', uptime: 98.50, region: 'us-east-1' },
        { name: 'SQS Queues', status: 'operational', uptime: 99.96, region: 'us-east-1' }
      ],
      regions: [
        { name: 'us-east-1', status: 'healthy', services: 8, latency: 45 },
        { name: 'us-west-2', status: 'healthy', services: 8, latency: 52 }
      ],
      incidents: [
        {
          id: 'INC-001',
          title: 'ElastiCache intermittent connection timeouts',
          severity: 'medium',
          status: 'investigating',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          affectedServices: ['ElastiCache', 'API Gateway']
        }
      ]
    });
  }, [timeRange]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return CheckCircle;
      case 'degraded':
        return AlertTriangle;
      case 'down':
      case 'unhealthy':
        return AlertTriangle;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Status Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Service Status
        </h2>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {healthData.services.map((service, idx) => {
              const StatusIcon = getStatusIcon(service.status);
              return (
                <div key={idx} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{service.name}</h3>
                    <div className={`p-2 rounded-lg ${getStatusColor(service.status)}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 capitalize">{service.status}</span>
                    <span className="text-xs font-medium text-gray-900">
                      {service.uptime.toFixed(2)}% uptime
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          service.uptime >= 99.9 ? 'bg-green-500' :
                          service.uptime >= 99.0 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${service.uptime}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{service.region}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Regional Health */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Cloud className="w-5 h-5 mr-2" />
          Regional Health
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {healthData.regions.map((region, idx) => {
            const StatusIcon = getStatusIcon(region.status);
            return (
              <div key={idx} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{region.name}</h3>
                    <p className="text-sm text-gray-600">{region.services} services</p>
                  </div>
                  <div className={`p-3 rounded-lg ${getStatusColor(region.status)}`}>
                    <StatusIcon className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{region.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Avg Latency</p>
                    <p className="text-sm font-medium text-gray-900">{region.latency}ms</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Incidents */}
      {healthData.incidents.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
            Active Incidents
          </h2>
          
          <div className="space-y-3">
            {healthData.incidents.map((incident) => {
              const severityColors = {
                critical: 'border-red-500 bg-red-50',
                high: 'border-orange-500 bg-orange-50',
                medium: 'border-yellow-500 bg-yellow-50',
                low: 'border-blue-500 bg-blue-50'
              };
              
              return (
                <div 
                  key={incident.id} 
                  className={`border-l-4 p-4 bg-white rounded-lg shadow ${severityColors[incident.severity]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-mono text-gray-600">{incident.id}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                          incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {incident.status}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">{incident.title}</h3>
                      <p className="text-sm text-gray-600">
                        Affected services: {incident.affectedServices.join(', ')}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Started {new Date(incident.startTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall System Health Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Overall System Health</h2>
            <p className="text-blue-100">
              {healthData.services.filter(s => s.status === 'operational').length} of {healthData.services.length} services operational
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold mb-1">
              {((healthData.services.filter(s => s.status === 'operational').length / healthData.services.length) * 100).toFixed(1)}%
            </div>
            <p className="text-blue-100">Availability</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
