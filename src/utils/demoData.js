/**
 * Demo mock data for demo.securebase.tximhotep.com
 * All mock data is centralized here and only accessed via demoAwareApiService
 * when isDemoMode() returns true. Never used in production code paths.
 */

export const DEMO_CUSTOMER = {
  id: 'a0000000-0000-0000-0000-000000000001',
  email: 'demo@securebase.tximhotep.com',
  org: 'Acme Corporation',
  password: 'SecureBaseDemo2026!',
};

export const mockDashboardData = {
  environments: [
    { id: 1, name: 'Production', status: 'healthy', region: 'us-east-1', accounts: 12, lastDeployment: '2h ago' },
    { id: 2, name: 'Staging', status: 'warning', region: 'us-east-1', accounts: 4, lastDeployment: '45m ago' },
    { id: 3, name: 'Development', status: 'healthy', region: 'us-west-2', accounts: 8, lastDeployment: '10m ago' },
  ],
  complianceScore: 94,
  monthlyCost: 8247,
  activeAlerts: 3,
  infrastructure: {
    cpu: { current: 58.4, average: 52.1, max: 73.2 },
    memory: { current: 64.2, average: 61.5, max: 78.9 },
    disk: { current: 41.7, average: 39.2, max: 55.1 },
    network: { in: 1.24, out: 0.87 },
  },
  deployments: {
    successRate: 98.2,
    averageDuration: 4.3,
    inProgress: 1,
    recent: [
      { id: 'd1', service: 'auth-service', version: 'v2.4.1', status: 'success', duration: 3.8, time: '2h ago' },
      { id: 'd2', service: 'api-gateway', version: 'v1.9.0', status: 'success', duration: 5.1, time: '5h ago' },
      { id: 'd3', service: 'billing-worker', version: 'v1.2.3', status: 'in_progress', duration: null, time: 'now' },
    ],
  },
  lambda: {
    coldStarts: { count: 23, percentage: 2.1 },
    duration: { p50: 145, p95: 420, p99: 890 },
    throttles: { count: 0, rate: 0 },
    concurrency: { current: 47, max: 1000, utilization: 4.7 },
  },
  cost: {
    total: 8247,
    trend: { direction: 'up', percentage: 3.2 },
    forecast: 8650,
    byService: [
      { service: 'EC2', cost: 2840, percentage: 34.5, trend: 'up' },
      { service: 'Aurora RDS', cost: 1920, percentage: 23.3, trend: 'stable' },
      { service: 'Lambda', cost: 840, percentage: 10.2, trend: 'down' },
      { service: 'S3', cost: 620, percentage: 7.5, trend: 'stable' },
      { service: 'CloudFront', cost: 480, percentage: 5.8, trend: 'up' },
      { service: 'Other', cost: 1547, percentage: 18.7, trend: 'stable' },
    ],
  },
};

export const mockComplianceData = {
  framework: 'SOC 2 Type II',
  totalControls: 209,
  passed: 197,
  failed: 0,
  findings: 12,
  findingSeverity: 'medium',
  lastAssessment: '2026-03-15',
  nextAssessment: '2026-06-15',
  trustServiceCriteria: {
    security: { score: 98, controls: 60, passed: 59, label: 'Security' },
    availability: { score: 95, controls: 42, passed: 40, label: 'Availability' },
    processingIntegrity: { score: 92, controls: 35, passed: 32, label: 'Processing Integrity' },
    confidentiality: { score: 96, controls: 40, passed: 38, label: 'Confidentiality' },
    privacy: { score: 90, controls: 32, passed: 28, label: 'Privacy' },
  },
  recentFindings: [
    { id: 'f1', control: 'CC6.1', title: 'MFA not enforced on 2 non-privileged accounts', severity: 'medium', status: 'open', age: '3 days' },
    { id: 'f2', control: 'A1.2', title: 'Backup retention policy not documented', severity: 'low', status: 'in_remediation', age: '7 days' },
    { id: 'f3', control: 'CC7.2', title: 'Log retention below 90-day minimum for dev environment', severity: 'medium', status: 'open', age: '1 day' },
    { id: 'f4', control: 'PI1.4', title: 'Input validation missing on 1 internal API endpoint', severity: 'medium', status: 'open', age: '5 days' },
    { id: 'f5', control: 'C1.1', title: 'Data classification tags missing on 3 S3 buckets', severity: 'low', status: 'in_remediation', age: '10 days' },
  ],
};

export const mockAlertData = [
  {
    id: 1,
    severity: 'critical',
    title: 'High CPU Usage - Production',
    description: 'Production EC2 cluster averaging 89% CPU utilization for the past 15 minutes.',
    service: 'EC2 / Auto Scaling Group',
    environment: 'Production',
    timestamp: '2026-03-21T00:45:00Z',
    status: 'active',
    assignee: null,
  },
  {
    id: 2,
    severity: 'warning',
    title: 'Certificate Expiring Soon',
    description: 'TLS certificate for api.securebase.tximhotep.com expires in 14 days.',
    service: 'ACM / Certificate Manager',
    environment: 'Production',
    timestamp: '2026-03-21T00:30:00Z',
    status: 'active',
    assignee: null,
  },
  {
    id: 3,
    severity: 'info',
    title: 'Scheduled Maintenance Window',
    description: 'Aurora cluster maintenance window starts at 03:00 UTC. Expected downtime: < 5 minutes.',
    service: 'Aurora RDS',
    environment: 'All Environments',
    timestamp: '2026-03-21T00:00:00Z',
    status: 'acknowledged',
    assignee: 'demo@securebase.tximhotep.com',
  },
];

export const mockEnvironmentData = [
  { id: 1, name: 'Production', status: 'healthy', region: 'us-east-1', accounts: 12, complianceScore: 96, cost: 5840 },
  { id: 2, name: 'Staging', status: 'warning', region: 'us-east-1', accounts: 4, complianceScore: 88, cost: 1420 },
  { id: 3, name: 'Development', status: 'healthy', region: 'us-west-2', accounts: 8, complianceScore: 91, cost: 987 },
];
