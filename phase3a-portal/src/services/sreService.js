/**
 * SRE Service - Phase 5 Component 3
 * 
 * API client for SRE/Operations Dashboard
 * Fetches infrastructure metrics, deployment status, alerts, and operational data
 * from CloudWatch, X-Ray, and custom metrics endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.example.com';

class SREService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Authentication
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAuthToken()}`
    };
  }

  /**
   * Infrastructure Health Metrics
   */
  async getInfrastructureMetrics(timeRange = '1h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/infrastructure?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching infrastructure metrics:', error);
      return this.getMockInfrastructureMetrics();
    }
  }

  /**
   * Deployment Pipeline Metrics
   */
  async getDeploymentMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/deployments?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching deployment metrics:', error);
      return this.getMockDeploymentMetrics();
    }
  }

  /**
   * Auto-Scaling Metrics
   */
  async getScalingMetrics() {
    try {
      const response = await fetch(`${this.baseUrl}/sre/scaling`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching scaling metrics:', error);
      return this.getMockScalingMetrics();
    }
  }

  /**
   * Database Performance Metrics
   */
  async getDatabaseMetrics(timeRange = '1h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/database?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching database metrics:', error);
      return this.getMockDatabaseMetrics();
    }
  }

  /**
   * Cache Performance Metrics
   */
  async getCacheMetrics(timeRange = '1h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/cache?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching cache metrics:', error);
      return this.getMockCacheMetrics();
    }
  }

  /**
   * Error Rate Metrics
   */
  async getErrorMetrics(timeRange = '1h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/errors?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching error metrics:', error);
      return this.getMockErrorMetrics();
    }
  }

  /**
   * Lambda Performance Metrics
   */
  async getLambdaMetrics(timeRange = '1h') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/lambda?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching lambda metrics:', error);
      return this.getMockLambdaMetrics();
    }
  }

  /**
   * Cost Metrics
   */
  async getCostMetrics(timeRange = '30d') {
    try {
      const response = await fetch(`${this.baseUrl}/sre/costs?timeRange=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching cost metrics:', error);
      return this.getMockCostMetrics();
    }
  }

  /**
   * Alert Management
   */
  async getAlerts(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(`${this.baseUrl}/sre/alerts?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return this.getMockAlerts();
    }
  }

  async acknowledgeAlert(alertId) {
    try {
      const response = await fetch(`${this.baseUrl}/sre/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          acknowledgedBy: 'current.user@example.com',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  async resolveAlert(alertId, resolution = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/sre/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          resolvedBy: 'current.user@example.com',
          timestamp: new Date().toISOString(),
          ...resolution
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  async escalateAlert(alertId) {
    try {
      const response = await fetch(`${this.baseUrl}/sre/alerts/${alertId}/escalate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          escalatedBy: 'current.user@example.com',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error escalating alert:', error);
      throw error;
    }
  }

  /**
   * CloudWatch Integration
   */
  async getCloudWatchDashboard(dashboardName) {
    try {
      const response = await fetch(`${this.baseUrl}/sre/cloudwatch/dashboard/${dashboardName}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching CloudWatch dashboard:', error);
      return null;
    }
  }

  /**
   * Mock Data Functions (for development/testing)
   */
  getMockInfrastructureMetrics() {
    return {
      cpu: { current: 58.4, average: 52.1, max: 73.2, trend: [] },
      memory: { current: 64.2, average: 61.5, max: 78.9, trend: [] },
      disk: { current: 42.1, average: 38.7, max: 55.3, trend: [] },
      network: { in: 125.4, out: 87.3, trend: [] }
    };
  }

  getMockDeploymentMetrics() {
    return {
      recent: [],
      successRate: 95.2,
      averageDuration: 234,
      inProgress: 1
    };
  }

  getMockScalingMetrics() {
    return {
      lambda: { current: 42, desired: 50, max: 100, utilization: 84.0 },
      ecs: { current: 8, desired: 10, max: 20, utilization: 80.0 },
      apiGateway: { requests: 15420, throttles: 23 }
    };
  }

  getMockDatabaseMetrics() {
    return {
      aurora: {
        queryLatency: { p50: 12.4, p95: 48.7, p99: 125.3 },
        connections: { current: 47, max: 100, utilization: 47.0 },
        iops: { read: 1240, write: 380 },
        replicationLag: 0.8
      },
      dynamodb: {
        readCapacity: { consumed: 245, provisioned: 500 },
        writeCapacity: { consumed: 87, provisioned: 200 },
        throttles: { read: 0, write: 2 },
        latency: { get: 4.2, put: 5.8, query: 12.3 }
      }
    };
  }

  getMockCacheMetrics() {
    return {
      redis: {
        hitRate: 94.7,
        hits: 48230,
        misses: 2670,
        evictions: 145,
        connections: 24,
        memoryUsage: 67.3
      }
    };
  }

  getMockErrorMetrics() {
    return {
      byService: [
        { service: 'api-gateway', errors: 23, rate: 0.15 },
        { service: 'lambda-auth', errors: 8, rate: 0.05 },
        { service: 'lambda-billing', errors: 45, rate: 1.2 },
        { service: 'dynamodb', errors: 2, rate: 0.01 },
        { service: 'aurora', errors: 0, rate: 0.0 }
      ],
      total: 78,
      rate: 0.42,
      trend: []
    };
  }

  getMockLambdaMetrics() {
    return {
      coldStarts: { count: 127, percentage: 3.8, avgDuration: 847 },
      duration: { p50: 145, p95: 387, p99: 892, max: 1245 },
      throttles: { count: 12, rate: 0.36 },
      concurrency: { current: 42, max: 100, utilization: 42.0 },
      errors: { count: 34, rate: 1.02 },
      byFunction: []
    };
  }

  getMockCostMetrics() {
    return {
      byService: [
        { service: 'Lambda', cost: 124.50, percentage: 28.5, trend: 'up' },
        { service: 'Aurora', cost: 187.30, percentage: 42.8, trend: 'stable' },
        { service: 'DynamoDB', cost: 45.80, percentage: 10.5, trend: 'down' },
        { service: 'ElastiCache', cost: 52.40, percentage: 12.0, trend: 'up' },
        { service: 'API Gateway', cost: 18.20, percentage: 4.2, trend: 'stable' },
        { service: 'CloudWatch', cost: 8.90, percentage: 2.0, trend: 'up' }
      ],
      total: 437.10,
      trend: { direction: 'up', percentage: 8.3 },
      forecast: 473.40
    };
  }

  getMockAlerts() {
    return {
      alerts: [],
      total: 0
    };
  }
}

// Export singleton instance
export const sreService = new SREService();
