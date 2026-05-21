import api from './api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

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

const mockServicesByCost = [
  { name: 'Aurora Serverless v2', cost: 4820 },
  { name: 'Lambda', cost: 2310 },
  { name: 'API Gateway', cost: 1540 },
  { name: 'S3', cost: 890 },
  { name: 'CloudFront', cost: 640 },
];

// ── Mock data: cross-tenant compliance scores (Phase 6.2 / Track 4) ──────────

const mockComplianceScores = {
  generated_at: new Date().toISOString(),
  tenants: [
    {
      tenant_id: 'tenant-uuid-001',
      tenant_display_name: 'Customer #1',
      SOC2:    { score: 96, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
      HIPAA:   { score: 98, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
      FedRAMP: { score: 92, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
    },
    {
      tenant_id: 'tenant-uuid-002',
      tenant_display_name: 'Customer #2',
      SOC2:    { score: 93, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
      HIPAA:   { score: 68, status: 'At Risk',  last_calculated: '2026-05-17T02:06:00+00:00' },
      FedRAMP: { score: 91, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
    },
    {
      tenant_id: 'tenant-uuid-003',
      tenant_display_name: 'Customer #3',
      SOC2:    { score: 54, status: 'Critical', last_calculated: '2026-05-17T02:06:00+00:00' },
      HIPAA:   { score: 94, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
      FedRAMP: { score: 95, status: 'Passing',  last_calculated: '2026-05-17T02:06:00+00:00' },
    },
  ],
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

// ── Mock data: vault (Phase 6.1 / Track 4) ────────────────────────────────────

const mockVaultData = {
  totalPackages: 47,
  totalSizeBytes: 831000000,
  packagerSuccessRate24h: 98.3,
  lastPackage: {
    tenantId: 'blue-cross',
    tenantName: 'Blue Cross Healthcare',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  tenants: [
    {
      tenantId: 'blue-cross',
      tenantName: 'Blue Cross Healthcare',
      packageCount: 14,
      lastGenerated: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      totalSizeBytes: 280000000,
      frameworks: ['HIPAA', 'SOC2'],
      packages: [
        { id: 'pkg-bc-1', packageName: 'hipaa-2026-04-30', framework: 'HIPAA', sizeBytes: 42000000, status: 'complete', createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
        { id: 'pkg-bc-2', packageName: 'soc2-2026-04-30', framework: 'SOC2', sizeBytes: 38000000, status: 'complete', createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString() },
      ],
    },
    {
      tenantId: 'goldman-fin',
      tenantName: 'Goldman Financial',
      packageCount: 18,
      lastGenerated: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      totalSizeBytes: 360000000,
      frameworks: ['SOC2', 'FedRAMP'],
      packages: [
        { id: 'pkg-gf-1', packageName: 'soc2-2026-04-30', framework: 'SOC2', sizeBytes: 55000000, status: 'complete', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
        { id: 'pkg-gf-2', packageName: 'fedramp-2026-04-30', framework: 'FedRAMP', sizeBytes: 61000000, status: 'complete', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
      ],
    },
    {
      tenantId: 'acme-gov',
      tenantName: 'Acme Government Solutions',
      packageCount: 15,
      lastGenerated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      totalSizeBytes: 191000000,
      frameworks: ['FedRAMP', 'HIPAA'],
      packages: [
        { id: 'pkg-ag-1', packageName: 'fedramp-2026-04-30', framework: 'FedRAMP', sizeBytes: 48000000, status: 'complete', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

class AdminService {
  constructor() {
    this.metricsCache = null;
    this.cacheTimestamp = 0;
    this.cacheTtlMs = 60000;
    this.inFlightMetricsRequest = null;
  }

  async getMetricsSnapshot(forceRefresh = false) {
    if (this.inFlightMetricsRequest) {
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

  async getCostManagement(params = {}) {
    if (USE_MOCK) return clone(mockData.costs);
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value != null && value !== '')
    );
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/admin/costs${suffix}`);
  }

  async getOperationsStatus(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.operations || {};
  }

  async getRecentAlerts(forceRefresh = false) {
    const data = await this.getMetricsSnapshot(forceRefresh);
    return data.alerts || [];
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

  // ── Phase 6.2 / Track 4: Cross-tenant Compliance Scores ──────────────────

  async getComplianceScores() {
    if (USE_MOCK) return clone(mockComplianceScores);
    return api.get('/admin/compliance/scores');
  }

  // ── Phase 6.1 / Track 4: Vault Visibility ─────────────────────────────────

  async getVaultSummary() {
    if (USE_MOCK) return clone(mockVaultData);
    const data = await api.get('/admin/evidence?limit=1000');
    const packages = data.packages || [];

    // Aggregate per-tenant from the flat package list
    const tenantMap = new Map();
    let totalSizeBytes = 0;
    let lastPackage = null;

    for (const pkg of packages) {
      const tid = pkg.tenant_id || pkg.tenantId || 'unknown';
      const tName = pkg.tenant_name || pkg.tenantName || tid;
      if (!tenantMap.has(tid)) {
        tenantMap.set(tid, {
          tenantId: tid,
          tenantName: tName,
          packageCount: 0,
          lastGenerated: null,
          totalSizeBytes: 0,
          frameworks: new Set(),
          packages: [],
        });
      }
      const tenant = tenantMap.get(tid);
      tenant.packageCount += 1;
      tenant.totalSizeBytes += pkg.size_bytes || 0;
      tenant.frameworks.add(pkg.framework);
      tenant.packages.push(pkg);
      if (!tenant.lastGenerated || pkg.created_at > tenant.lastGenerated) {
        tenant.lastGenerated = pkg.created_at;
      }
      totalSizeBytes += pkg.size_bytes || 0;
      if (!lastPackage || pkg.created_at > lastPackage.createdAt) {
        lastPackage = { tenantId: tid, tenantName: tName, createdAt: pkg.created_at };
      }
    }

    const tenants = Array.from(tenantMap.values()).map((t) => ({
      ...t,
      frameworks: Array.from(t.frameworks),
    }));
    tenants.sort((a, b) => (b.lastGenerated || '').localeCompare(a.lastGenerated || ''));

    return {
      totalPackages: packages.length,
      totalSizeBytes,
      packagerSuccessRate24h: data.packagerSuccessRate24h ?? null,
      lastPackage,
      tenants,
    };
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
    ] = await Promise.all([
      this.getSystemOverview(),
      this.getInfrastructureHealth(),
      this.getSecurityMetrics(),
      this.getCustomerAnalytics(),
      this.getCostManagement(),
      this.getOperationsStatus(),
      this.getRecentAlerts(),
    ]);

    return {
      overview,
      infrastructure,
      security,
      customers,
      costs,
      operations,
      alerts,
    };
  }
}

export const adminService = new AdminService();
export default adminService;
