import api from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const mockServicesByCost = [
  { name: 'Aurora PostgreSQL', cost: 6240 },
  { name: 'Lambda', cost: 2810 },
  { name: 'API Gateway', cost: 1495 },
  { name: 'CloudFront', cost: 920 },
  { name: 'S3', cost: 740 },
];

// ── Mock data: alerting dashboard (Phase 6 / Track 3) ─────────────────────────

const _generateMockHistory = () => {
  const history = [];
  const severities = ['P1', 'P2', 'P3'];
  const alarmNames = [
    'securebase-prod-auth_v2-error-rate',
    'securebase-prod-apigw-5xx-rate',
    'securebase-prod-aurora-cpu-high',
    'securebase-prod-lambda-invocations-spike',
    'securebase-prod-guardduty-high-critical-findings',
    'securebase-prod-compliance-drift-detected',
  ];
  for (let d = 29; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400000);
    const count = Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const sev = severities[Math.floor(Math.random() * severities.length)];
      const name = alarmNames[Math.floor(Math.random() * alarmNames.length)];
      const triggeredAt = new Date(date.getTime() + Math.random() * 86400000).toISOString();
      history.push({
        alarm_name: name,
        triggered_at: triggeredAt,
        severity: sev,
        state: Math.random() > 0.2 ? 'OK' : 'ALARM',
        reason: 'Threshold crossed during load test',
        region: 'us-east-1',
        account: '123456789012',
        resolved_at: Math.random() > 0.2 ? new Date(Date.parse(triggeredAt) + 600000).toISOString() : null,
        mttr_seconds: Math.random() > 0.2 ? Math.floor(Math.random() * 1800) + 120 : null,
        mtta_seconds: Math.random() > 0.2 ? Math.floor(Math.random() * 300) + 30 : null,
      });
    }
  }
  return history;
};

const mockAlarmHistory = _generateMockHistory();

const mockAlarmSummary = {
  active_alarms: { P1: 0, P2: 1, P3: 2, total: 3 },
  alarms: [
    {
      alarm_name: 'securebase-prod-apigw-5xx-rate',
      triggered_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      severity: 'P2',
      state: 'ALARM',
      reason: 'Threshold Crossed: 3 datapoints [0.72, 0.85, 0.91] > 0.5.',
      region: 'us-east-1',
      account: '123456789012',
      resolved_at: null,
      mttr_seconds: null,
      mtta_seconds: null,
    },
    {
      alarm_name: 'securebase-prod-lambda-invocations-spike',
      triggered_at: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      severity: 'P3',
      state: 'ALARM',
      reason: 'Anomaly detected: invocations exceeded upper band.',
      region: 'us-east-1',
      account: '123456789012',
      resolved_at: null,
      mttr_seconds: null,
      mtta_seconds: null,
    },
    {
      alarm_name: 'securebase-prod-compliance-drift-detected',
      triggered_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      severity: 'P3',
      state: 'ALARM',
      reason: 'ComplianceDriftCount threshold crossed (1 event in 5 min).',
      region: 'us-east-1',
      account: '123456789012',
      resolved_at: null,
      mttr_seconds: null,
      mtta_seconds: null,
    },
  ],
  retrieved_at: new Date().toISOString(),
};

const mockMttaMetrics = {
  mean_mtta_seconds: 187,
  mean_mttr_seconds: 542,
  sample_count: 14,
};

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
      Object.entries(params).filter(([, value]) => value != null && value !== '')
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

  async getAlarmSummary() {
    if (USE_MOCK) return clone(mockAlarmSummary);
    return api.get('/admin/alarms/summary');
  }

  async getAlarmHistory(days = 30) {
    if (USE_MOCK) return clone(mockAlarmHistory);
    return api.get(`/admin/alarms/history?days=${days}`);
  }

  async getMttaMttrMetrics() {
    if (USE_MOCK) return clone(mockMttaMetrics);
    return api.get('/admin/alarms/mtta-mttr');
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
