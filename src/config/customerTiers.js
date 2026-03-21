/**
 * Customer Tier Configuration
 * 
 * Defines which sreService methods and dashboard features
 * are available for each pricing tier.
 * 
 * Tiers:
 * - Standard ($2K/mo): B2B SaaS, basic compliance
 * - FinTech ($8K/mo): Payment processing, PCI-DSS, security
 * - Healthcare ($15K/mo): HIPAA, PHI protection, encryption audit
 */

export const TIERS = {
  STANDARD: 'standard',
  FINTECH: 'fintech',
  HEALTHCARE: 'healthcare',
};

export const tierConfig = {
  [TIERS.STANDARD]: {
    name: 'Standard',
    price: 2000, // monthly in USD
    description: 'B2B SaaS compliance and monitoring',
    sreServiceMethods: [
      'getInfrastructureMetrics',
      'getDeploymentMetrics',
      'getScalingMetrics',
      'getDatabaseMetrics',
      'getCacheMetrics',
      'getErrorMetrics',
      'getLambdaMetrics',
      'getCostMetrics',
      'getComplianceScore',
      'getStorageMetrics',
    ],
    complianceFrameworks: ['soc2'],
    dashboardPanels: [
      'infrastructureHealth',
      'deploymentPipeline',
      'autoScaling',
      'databasePerformance',
      'cachePerformance',
      'errorRates',
      'lambdaMetrics',
      'costAnalysis',
      'complianceOverview',
    ],
    features: {
      realTimeMonitoring: true,
      customDashboards: false,
      ssoSaml: false,
      apiRateLimit: 1000,       // requests per hour
      dataRetentionDays: 90,
      alertChannels: ['email'],
      reportFormats: ['pdf'],
      supportLevel: 'standard', // email support, 24h SLA
    },
    integrations: [],
  },

  [TIERS.FINTECH]: {
    name: 'FinTech',
    price: 8000,
    description: 'Payment processing, PCI-DSS, real-time security',
    sreServiceMethods: [
      'getInfrastructureMetrics',
      'getDeploymentMetrics',
      'getScalingMetrics',
      'getDatabaseMetrics',
      'getCacheMetrics',
      'getErrorMetrics',
      'getLambdaMetrics',
      'getCostMetrics',
      'getComplianceScore',
      'getSecurityMetrics',
      'getQueueMetrics',
      'getPCIDSSCompliance',
    ],
    complianceFrameworks: ['soc2', 'pci-dss'],
    dashboardPanels: [
      'infrastructureHealth',
      'deploymentPipeline',
      'autoScaling',
      'databasePerformance',
      'cachePerformance',
      'errorRates',
      'lambdaMetrics',
      'costAnalysis',
      'complianceOverview',
      'securityMonitoring',
      'transactionMonitoring',
      'queueMetrics',
    ],
    features: {
      realTimeMonitoring: true,
      customDashboards: true,
      ssoSaml: true,
      apiRateLimit: 5000,
      dataRetentionDays: 365,
      alertChannels: ['email', 'slack', 'pagerduty'],
      reportFormats: ['pdf', 'csv'],
      supportLevel: 'priority', // 4h SLA, dedicated Slack channel
      subMinuteAlerting: true,
    },
    integrations: ['pagerduty', 'datadog', 'slack'],
  },

  [TIERS.HEALTHCARE]: {
    name: 'Healthcare',
    price: 15000,
    description: 'HIPAA compliance, PHI protection, encryption audit',
    sreServiceMethods: [
      'getInfrastructureMetrics',
      'getDeploymentMetrics',
      'getScalingMetrics',
      'getDatabaseMetrics',
      'getCacheMetrics',
      'getErrorMetrics',
      'getLambdaMetrics',
      'getCostMetrics',
      'getComplianceScore',
      'getSecurityMetrics',
      'getStorageMetrics',
      'getEncryptionStatus',
      'getHIPAACompliance',
      'getVideoMetrics',
    ],
    complianceFrameworks: ['soc2', 'hipaa'],
    dashboardPanels: [
      'infrastructureHealth',
      'deploymentPipeline',
      'autoScaling',
      'databasePerformance',
      'cachePerformance',
      'errorRates',
      'lambdaMetrics',
      'costAnalysis',
      'complianceOverview',
      'securityMonitoring',
      'encryptionAudit',
      'hipaaCompliance',
      'phiAccessLog',
      'storageMetrics',
    ],
    features: {
      realTimeMonitoring: true,
      customDashboards: true,
      ssoSaml: true,
      apiRateLimit: 10000,
      dataRetentionDays: 2555, // 7 years for HIPAA
      alertChannels: ['email', 'slack', 'pagerduty', 'sms'],
      reportFormats: ['pdf', 'csv', 'json'],
      supportLevel: 'enterprise', // 1h SLA, dedicated account manager
      hipaaAuditLog: true,
      phiAccessTracking: true,
      encryptionMonitoring: true,
      baaManagement: true,
    },
    integrations: ['pagerduty', 'splunk', 'slack', 'ehr'],
  },
};

/**
 * Pilot customer definitions
 * Maps each pilot customer to their tier and custom config
 */
export const pilotCustomers = [
  {
    id: 'trellis-ai',
    name: 'Trellis AI',
    industry: 'Healthcare Tech',
    tier: TIERS.HEALTHCARE,
    awsSpend: 45000,
    teamSize: 75,
    environments: 4,
    customRequirements: ['hipaa-reports', 'phi-audit-logs', 'pagerduty-integration'],
  },
  {
    id: 'finoptix',
    name: 'FinOptix',
    industry: 'FinTech',
    tier: TIERS.FINTECH,
    awsSpend: 22000,
    teamSize: 45,
    environments: 3,
    customRequirements: ['sub-minute-alerting', 'pci-dss-reports', 'datadog-integration'],
  },
  {
    id: 'datavault-pro',
    name: 'DataVault Pro',
    industry: 'B2B SaaS',
    tier: TIERS.STANDARD,
    awsSpend: 8000,
    teamSize: 25,
    environments: 3,
    customRequirements: ['monthly-compliance-reports', 'cost-forecasting'],
  },
  {
    id: 'streamflow-analytics',
    name: 'StreamFlow Analytics',
    industry: 'Data Analytics',
    tier: TIERS.STANDARD,
    awsSpend: 12000,
    teamSize: 30,
    environments: 3,
    customRequirements: ['cost-allocation', 'etl-monitoring'],
  },
  {
    id: 'securecomm',
    name: 'SecureComm',
    industry: 'Enterprise Communications',
    tier: TIERS.FINTECH,
    awsSpend: 18000,
    teamSize: 55,
    environments: 4,
    customRequirements: ['24x7-monitoring', 'dr-automation', 'splunk-integration'],
  },
  {
    id: 'healthsync',
    name: 'HealthSync',
    industry: 'Healthcare',
    tier: TIERS.HEALTHCARE,
    awsSpend: 32000,
    teamSize: 60,
    environments: 4,
    customRequirements: ['hipaa-reports', 'video-monitoring', 'ehr-integration'],
  },
  {
    id: 'paysafe-solutions',
    name: 'PaySafe Solutions',
    industry: 'FinTech',
    tier: TIERS.FINTECH,
    awsSpend: 25000,
    teamSize: 50,
    environments: 3,
    customRequirements: ['fraud-detection', 'pci-dss-reports', 'sub-second-alerting'],
  },
  {
    id: 'clouddocs',
    name: 'CloudDocs',
    industry: 'B2B SaaS',
    tier: TIERS.STANDARD,
    awsSpend: 9000,
    teamSize: 28,
    environments: 3,
    customRequirements: ['weekly-uptime-reports', 'slack-integration'],
  },
  {
    id: 'ai-insights',
    name: 'AI Insights Corp',
    industry: 'AI/ML SaaS',
    tier: TIERS.STANDARD,
    awsSpend: 15000,
    teamSize: 35,
    environments: 3,
    customRequirements: ['ml-cost-allocation', 'mlflow-integration'],
  },
  {
    id: 'retailflow',
    name: 'RetailFlow',
    industry: 'E-commerce',
    tier: TIERS.STANDARD,
    awsSpend: 11000,
    teamSize: 32,
    environments: 3,
    customRequirements: ['inventory-tracking', 'black-friday-reports'],
  },
];

/**
 * Helper: Get tier config for a customer
 */
export const getTierForCustomer = (customerId) => {
  const customer = pilotCustomers.find(c => c.id === customerId);
  if (!customer) return null;
  return tierConfig[customer.tier];
};

/**
 * Helper: Check if a customer has access to a specific sreService method
 */
export const hasMethodAccess = (customerId, methodName) => {
  const tier = getTierForCustomer(customerId);
  if (!tier) return false;
  return tier.sreServiceMethods.includes(methodName);
};

/**
 * Helper: Check if a customer has access to a dashboard panel
 */
export const hasPanelAccess = (customerId, panelName) => {
  const tier = getTierForCustomer(customerId);
  if (!tier) return false;
  return tier.dashboardPanels.includes(panelName);
};

/**
 * Helper: Get all available compliance frameworks for a customer
 */
export const getComplianceFrameworks = (customerId) => {
  const tier = getTierForCustomer(customerId);
  if (!tier) return [];
  return tier.complianceFrameworks;
};

export default tierConfig;
