/**
 * Admin Service - Phase 5
 * 
 * API client for Executive/Admin Dashboard
 * Fetches platform-wide metrics from CloudWatch and custom metrics tables
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

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
      const response = await fetch(`/admin/metrics?timeRange=${timeRange}`, {
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
      // Only use mock data if explicitly enabled
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockPlatformMetrics(timeRange);
      }
      throw error; // Surface real errors in production
    }
  }

  /**
   * Get customer overview metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getCustomerMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`/admin/customers?timeRange=${timeRange}`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockCustomerMetrics();
      }
      throw error;
    }
  }

  /**
   * Get API performance metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getAPIMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`/admin/api-performance?timeRange=${timeRange}`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockAPIMetrics();
      }
      throw error;
    }
  }

  /**
   * Get infrastructure health metrics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getInfrastructureMetrics(timeRange = '24h') {
    try {
      const response = await fetch(`/admin/infrastructure?timeRange=${timeRange}`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockInfrastructureMetrics();
      }
      throw error;
    }
  }

  /**
   * Get security alerts and compliance metrics
   * @returns {Promise<Object>}
   */
  async getSecurityMetrics() {
    try {
      const response = await fetch(`/admin/security`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockSecurityMetrics();
      }
      throw error;
    }
  }

  /**
   * Get cost analytics
   * @param {string} timeRange 
   * @returns {Promise<Object>}
   */
  async getCostMetrics(timeRange = '30d') {
    try {
      const response = await fetch(`/admin/costs?timeRange=${timeRange}`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockCostMetrics();
      }
      throw error;
    }
  }

  /**
   * Get recent deployments
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getRecentDeployments(limit = 10) {
    try {
      const response = await fetch(`/admin/deployments?limit=${limit}`, {
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
      if (import.meta.env.VITE_USE_MOCK_API === 'true') {
        return this.getMockDeployments();
      }
      throw error;
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
    // Handle Netlify function response shape (Phase 5.1 interim)
    if (data.platform) {
      return {
        totalCustomers: data.platform.totalCustomers ?? 0,
        activeUsers: data.platform.activeUsers ?? 0,
        mrr: data.platform.mrr ?? 0,
        apiCallsToday: data.platform.apiCallsToday ?? 0,
        uptimePercent: data.platform.uptimePercent ?? 0,
        latency: data.latency ?? { p50: 0, p95: 0, p99: 0 },
        security: data.security ?? {},
        infrastructure: data.infrastructure ?? {},
        costs: data.costs ?? {},
        deployments: data.deployments ?? {},
        timestamp: data.timestamp
      };
    }
    // Handle AWS Lambda / CloudWatch response shape (Phase 5.1 production)
    return {
      totalCustomers: data.totalCustomers ?? data.customerCount ?? 0,
      activeUsers: data.activeUsers ?? 0,
      mrr: data.mrr ?? data.monthlyRevenue ?? 0,
      apiCallsToday: data.apiCallsToday ?? data.requestCount ?? 0,
      uptimePercent: data.uptimePercent ?? data.uptime ?? 0,
      latency: data.latency ?? { p50: 0, p95: 0, p99: 0 },
      security: data.security ?? data.securityMetrics ?? {},
      infrastructure: data.infrastructure ?? data.infraMetrics ?? {},
      costs: data.costs ?? data.costMetrics ?? {},
      deployments: data.deployments ?? data.deploymentMetrics ?? {},
      timestamp: data.timestamp
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
