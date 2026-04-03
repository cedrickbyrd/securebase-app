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

/**
 * Mock SOC 2 audit report in the shape returned by /.netlify/functions/get-audit-report.
 * Used by SecureBaseLandingZone when isDemoMode() is true so the ComplianceScreen
 * renders fully (including any export / PDF buttons) without a real Supabase session.
 */
export const mockAuditReport = {
  audit_metadata: {
    standard: 'SOC 2 Type II',
    status: 'In Compliance',
    run_id: 'demo-run-2026-001',
    generated_at: '2026-03-15T08:00:00.000Z',
  },
  score: 94,
  stats: { passed: 197, warned: 12, failed: 0 },
  controls: [
    { id: 'CC1.1', title: 'Control Environment — Commitment to Competence', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC2.1', title: 'Information & Communication — Internal Communication', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC3.1', title: 'Risk Assessment — Risk Identification', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC4.1', title: 'Monitoring — Ongoing Evaluations', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC5.1', title: 'Control Activities — Policies & Procedures', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC6.1', title: 'Logical Access — Multi-Factor Authentication', status: 'warning', category: 'Security', remediation: 'Enforce MFA on all non-privileged accounts.' },
    { id: 'CC6.2', title: 'Logical Access — Access Provisioning', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC6.3', title: 'Logical Access — Access Removal', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC7.1', title: 'System Operations — Vulnerability Management', status: 'passed', category: 'Security', remediation: null },
    { id: 'CC7.2', title: 'System Operations — Log Retention', status: 'warning', category: 'Security', remediation: 'Increase dev environment log retention to meet 90-day minimum.' },
    { id: 'A1.1', title: 'Availability — Capacity Planning', status: 'passed', category: 'Availability', remediation: null },
    { id: 'A1.2', title: 'Availability — Backup & Recovery', status: 'warning', category: 'Availability', remediation: 'Document backup retention policy.' },
    { id: 'PI1.1', title: 'Processing Integrity — Input Validation', status: 'passed', category: 'Processing Integrity', remediation: null },
    { id: 'PI1.4', title: 'Processing Integrity — Internal API Validation', status: 'warning', category: 'Processing Integrity', remediation: 'Add input validation to remaining internal API endpoint.' },
    { id: 'C1.1', title: 'Confidentiality — Data Classification', status: 'warning', category: 'Confidentiality', remediation: 'Apply classification tags to 3 S3 buckets.' },
    { id: 'C1.2', title: 'Confidentiality — Encryption at Rest', status: 'passed', category: 'Confidentiality', remediation: null },
    { id: 'P1.1', title: 'Privacy — Notice & Communication', status: 'passed', category: 'Privacy', remediation: null },
    { id: 'P2.1', title: 'Privacy — Choice & Consent', status: 'passed', category: 'Privacy', remediation: null },
  ],
};

export const mockComplianceScore = {
  overallScore: 94,
  passedControls: 197,
  totalControls: 209,
  criticalFindings: 0,
  highFindings: 0,
  mediumFindings: 12,
  categories: [
    { name: 'Security', passed: 59, total: 60, percentage: 98 },
    { name: 'Availability', passed: 40, total: 42, percentage: 95 },
    { name: 'Processing Integrity', passed: 32, total: 35, percentage: 91 },
    { name: 'Confidentiality', passed: 38, total: 40, percentage: 95 },
    { name: 'Privacy', passed: 28, total: 32, percentage: 88 },
  ],
};

export const mockFintechComplianceStatus = {
  passingControls: 8,
  totalControls: 8,
  controls: [
    {
      id: '7TAC-33.1',
      name: 'Cybersecurity Program',
      summary: 'Documented cybersecurity program aligned to NIST CSF covering all required domains.',
      lastAssessedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: '7TAC-33.2',
      name: 'Annual Risk Assessment',
      summary: 'Annual risk assessment completed; residual risks documented and accepted by CISO.',
      lastAssessedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: '7TAC-33.3',
      name: 'Incident Response Plan',
      summary: 'IRP tested semi-annually; last tabletop exercise completed Jan 2026.',
      lastAssessedAt: '2026-03-15T10:00:00Z',
    },
    {
      id: '31CFR-1022.1',
      name: 'BSA / AML Controls',
      summary: 'FinCEN CTR and SAR filing procedures in place; automated monitoring active.',
      lastAssessedAt: '2026-02-28T10:00:00Z',
    },
    {
      id: '31CFR-1022.2',
      name: 'Customer Identification Program',
      summary: 'CIP implemented with KYC controls; identity verification vendor integrated.',
      lastAssessedAt: '2026-02-28T10:00:00Z',
    },
    {
      id: 'TXHB1666-1',
      name: 'TX HB 1666 Data Residency',
      summary: 'Customer financial data stored exclusively in us-east-1 and us-west-2 regions.',
      lastAssessedAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'TXHB1666-2',
      name: 'TX HB 1666 Breach Notification',
      summary: '72-hour breach notification workflow configured with automatic DOB alert.',
      lastAssessedAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'TXHB1666-3',
      name: 'TX HB 1666 Examiner Access',
      summary: 'Read-only examiner portal provisioned; audit logs exported to tamper-evident S3.',
      lastAssessedAt: '2026-03-15T10:00:00Z',
    },
  ],
};
