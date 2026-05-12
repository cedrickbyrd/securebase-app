import api from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const mockServicesByCost = [
  { name: 'Aurora PostgreSQL', cost: 6240 },
  { name: 'Lambda', cost: 2810 },
  { name: 'API Gateway', cost: 1495 },
  { name: 'CloudFront', cost: 920 },
  { name: 'S3', cost: 740 },
];

const mockData = {
  overview: {
    activeTenants: 142,
    totalRevenue: 128400,
    uptimePercentage: 99.96,
    openSupportTickets: 7,
  },
  infrastructure: {
    lambdaInvocations: 3821400,
    apiLatency: { p50: 42, p95: 188, p99: 462 },
    errorRate: 0.14,
    cloudwatchAlarms: 3,
  },
  security: {
    complianceScores: {
      soc2: 98,
      fedramp: 95,
      hipaa: 97,
    },
    failedAuthAttempts: 12,
    securityEvents24h: 4,
  },
  customers: {
    newSignups30d: 24,
    churnRate: 1.4,
    mrrTrend: [112500, 117800, 120200, 124100, 126900, 128400],
    npsScore: 54,
  },
  costs: {
    awsSpendMtd: 12205,
    costPerTenant: 85.95,
    savingsVsOnDemand: 27.1,
    topServicesByCost: mockServicesByCost,
    tenantCostHistory: [
      { tenant_id: 'tenant_a', date: '2026-05-10', totalCost: 325.12 },
      { tenant_id: 'tenant_b', date: '2026-05-10', totalCost: 214.09 },
      { tenant_id: 'tenant_c', date: '2026-05-10', totalCost: 186.77 },
      { tenant_id: 'tenant_a', date: '2026-05-11', totalCost: 331.04 },
      { tenant_id: 'tenant_b', date: '2026-05-11', totalCost: 220.88 },
    ],
  },
  operations: {
    activeDeployments: 2,
    failedPipelines: 1,
    pendingTerraformChanges: 3,
    lambdaColdStarts: 38,
  },
  alerts: [
    {
      id: 'alarm-api-latency',
      severity: 'high',
      summary: 'API latency p95 exceeded 200ms threshold',
      source: 'CloudWatch',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'alarm-auth-failures',
      severity: 'medium',
      summary: 'Elevated authentication failures detected',
      source: 'Security Hub',
      createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    },
  ],
  health: {
    lastUpdated: new Date().toISOString(),
    services: [
      { name: 'API Gateway', status: 'healthy' },
      { name: 'Lambda auth_v2', status: 'healthy' },
      { name: 'Lambda metrics_aggregation', status: 'degraded' },
      { name: 'Lambda tenant_metrics', status: 'healthy' },
      { name: 'Aurora DB', status: 'healthy' },
      { name: 'DynamoDB', status: 'healthy' },
      { name: 'S3', status: 'healthy' },
      { name: 'CloudFront', status: 'down' },
    ],
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

class AdminService {
  async getSystemOverview() {
    if (USE_MOCK) return clone(mockData.overview);
    return api.get('/admin/overview');
  }

  async getInfrastructureHealth() {
    if (USE_MOCK) return clone(mockData.infrastructure);
    return api.get('/admin/infrastructure');
  }

  async getSecurityMetrics() {
    if (USE_MOCK) return clone(mockData.security);
    return api.get('/admin/security');
  }

  async getCustomerAnalytics() {
    if (USE_MOCK) return clone(mockData.customers);
    return api.get('/admin/customers');
  }

  async getCostManagement(params = {}) {
    if (USE_MOCK) return clone(mockData.costs);
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/admin/costs${suffix}`);
  }

  async getOperationsStatus() {
    if (USE_MOCK) return clone(mockData.operations);
    return api.get('/admin/operations');
  }

  async getRecentAlerts() {
    if (USE_MOCK) return clone(mockData.alerts);
    return api.get('/admin/alerts');
  }

  async getSystemHealth() {
    if (USE_MOCK) return clone(mockData.health);
    return api.get('/admin/health');
  }

  async getPlatformMetrics() {
    const [
      overview,
      infrastructure,
      security,
      customers,
      costs,
      operations,
      alerts,
      health,
    ] = await Promise.all([
      this.getSystemOverview(),
      this.getInfrastructureHealth(),
      this.getSecurityMetrics(),
      this.getCustomerAnalytics(),
      this.getCostManagement(),
      this.getOperationsStatus(),
      this.getRecentAlerts(),
      this.getSystemHealth(),
    ]);

    return {
      overview,
      infrastructure,
      security,
      customers,
      costs,
      operations,
      alerts,
      health,
    };
  }
}

export const adminService = new AdminService();
export default adminService;
