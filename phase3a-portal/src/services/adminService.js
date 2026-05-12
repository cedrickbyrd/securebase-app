import api from './api';

class AdminService {
  constructor() {
    this.metricsCache = null;
    this.cacheTimestamp = 0;
    this.cacheTtlMs = 30000;
    this.inFlightMetricsRequest = null;
  }

  async getMetricsSnapshot(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.metricsCache && (now - this.cacheTimestamp) < this.cacheTtlMs) {
      return this.metricsCache;
    }

    if (!forceRefresh && this.inFlightMetricsRequest) {
      return this.inFlightMetricsRequest;
    }

    this.inFlightMetricsRequest = api.get('/admin/metrics')
      .then((payload) => {
        this.metricsCache = payload || {};
        this.cacheTimestamp = Date.now();
        return this.metricsCache;
      })
      .finally(() => {
        this.inFlightMetricsRequest = null;
      });

    return this.inFlightMetricsRequest;
  }

  async getSystemOverview(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.overview || {};
  }

  async getInfrastructureHealth(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.infrastructure || {};
  }

  async getSecurityMetrics(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.security || {};
  }

  async getCustomerAnalytics(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.customers || {};
  }

  async getCostManagement(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.costs || {};
  }

  async getOperationsStatus(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.operations || {};
  }

  async getRecentAlerts(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.alerts || [];
  }

  async getSystemHealth(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.health || { services: [], lastUpdated: null };
  }
}

export const adminService = new AdminService();
export default adminService;
