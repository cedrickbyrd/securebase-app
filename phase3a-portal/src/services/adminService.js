/**
 * Admin Service - Phase 5
 * 
 * API client for Executive/Admin Dashboard
 * Fetches platform-wide metrics from CloudWatch and custom metrics tables
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.example.com';

class AdminService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get platform-wide metrics for executive dashboard
   * @param {string} timeRange - Time range ('1h', '24h', '7d', '30d')
   * @returns {Promise<Object>} Platform metrics
   */
  async getPlatformMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`${this.baseUrl}/admin/metrics?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.parsePlatformMetrics(data);
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      // Return mock data for development
      return this.getMockPlatformMetrics(timeRange);
    }
  }

  /**
   * Get customer overview metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getCustomerMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`${this.baseUrl}/admin/customers?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching customer metrics:', error);
      return this.getMockCustomerMetrics();
    }
  }

  /**
   * Get API performance metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getAPIMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`${this.baseUrl}/admin/api-performance?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching API metrics:', error);
      return this.getMockAPIMetrics();
    }
  }

  /**
   * Get infrastructure health metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getInfrastructureMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`${this.baseUrl}/admin/infrastructure?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
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
   * Get security alerts and compliance metrics
   * @returns {Promise<Object>}
   */
  async getSecurityMetrics() {
    try {
      const response = await fetch(`${this.baseUrl}/admin/security`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      return this.getMockSecurityMetrics();
    }
  }

  /**
   * Get cost analytics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getCostMetrics(timeRange = '30d') {
    try {
      const response = await fetch(`${this.baseUrl}/admin/costs?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
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
   * Get recent deployments
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getRecentDeployments(limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/admin/deployments?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching deployments:', error);
      return this.getMockDeployments();
    }
  }

  /**
   * Helper: Get auth token from localStorage
   * @returns {string}
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Helper: Parse platform metrics response
   * @param {Object} data 
   * @returns {Object}
   */
  parsePlatformMetrics(data) {
    return {
      customers: data.customers || {},
      api: data.api || {},
      infrastructure: data.infrastructure || {},
      security: data.security || {},
      costs: data.costs || {},
      deployments: data.deployments || {}
    };
  }

  /**
   * Mock data generators for development/testing
   */
  getMockPlatformMetrics(timeRange) {
    return {
      customers: {
        total: 147,
        active: 142,
        churned: 5,
        growth: 12.5,
        mrr: 58400
      },
      api: {
        requests: timeRange === '1h' ? 125000 : timeRange === '24h' ? 2800000 : 19600000,
        latency_p50: 45,
        latency_p95: 285,
        latency_p99: 820,
        errorRate: 0.18,
        successRate: 99.82
      },
      infrastructure: {
        lambdaColdStarts: timeRange === '1h' ? 23 : timeRange === '24h' ? 487 : 3409,
        lambdaErrors: timeRange === '1h' ? 2 : timeRange === '24h' ? 15 : 105,
        dynamodbThrottles: 0,
        auroraConnections: 42,
        cacheHitRate: 78.5
      },
      security: {
        criticalAlerts: 0,
        violations: 3,
        openIncidents: 1,
        complianceScore: 97.2
      },
      costs: {
        current: 8420,
        projected: 12630,
        byService: [
          { name: 'Aurora', cost: 2840 },
          { name: 'Lambda', cost: 1920 },
          { name: 'DynamoDB', cost: 1540 },
          { name: 'API Gateway', cost: 890 },
          { name: 'S3', cost: 650 },
          { name: 'CloudFront', cost: 380 },
          { name: 'ElastiCache', cost: 200 }
        ],
        trend: 8.3
      },
      deployments: {
        recent: [
          {
            service: 'API Gateway',
            version: 'v2.4.1',
            environment: 'production',
            status: 'success',
            deployer: 'alice@securebase.com',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            duration: '2m 34s'
          },
          {
            service: 'Lambda: report-engine',
            version: 'v1.8.0',
            environment: 'production',
            status: 'success',
            deployer: 'bob@securebase.com',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            duration: '1m 12s'
          },
          {
            service: 'Frontend Portal',
            version: 'v3.2.0',
            environment: 'production',
            status: 'success',
            deployer: 'carol@securebase.com',
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            duration: '3m 45s'
          },
          {
            service: 'Analytics Module',
            version: 'v1.0.0',
            environment: 'production',
            status: 'success',
            deployer: 'ai-agent@securebase.com',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            duration: '4m 18s'
          },
          {
            service: 'Database Migration',
            version: 'v20260119',
            environment: 'production',
            status: 'success',
            deployer: 'dave@securebase.com',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            duration: '8m 22s'
          }
        ],
        successRate: 98.5
      }
    };
  }

  getMockCustomerMetrics() {
    return {
      total: 147,
      active: 142,
      churned: 5,
      growth: 12.5,
      mrr: 58400
    };
  }

  getMockAPIMetrics() {
    return {
      requests: 2800000,
      latency_p50: 45,
      latency_p95: 285,
      latency_p99: 820,
      errorRate: 0.18,
      successRate: 99.82
    };
  }

  getMockInfrastructureMetrics() {
    return {
      lambdaColdStarts: 487,
      lambdaErrors: 15,
      dynamodbThrottles: 0,
      auroraConnections: 42,
      cacheHitRate: 78.5
    };
  }

  getMockSecurityMetrics() {
    return {
      criticalAlerts: 0,
      violations: 3,
      openIncidents: 1,
      complianceScore: 97.2
    };
  }

  getMockCostMetrics() {
    return {
      current: 8420,
      projected: 12630,
      byService: [
        { name: 'Aurora', cost: 2840 },
        { name: 'Lambda', cost: 1920 },
        { name: 'DynamoDB', cost: 1540 },
        { name: 'API Gateway', cost: 890 },
        { name: 'S3', cost: 650 }
      ],
      trend: 8.3
    };
  }

  getMockDeployments() {
    return [
      {
        service: 'API Gateway',
        version: 'v2.4.1',
        environment: 'production',
        status: 'success',
        deployer: 'alice@securebase.com',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        duration: '2m 34s'
      }
    ];
  }
}

// Export singleton instance
export const adminService = new AdminService();
export default adminService;
