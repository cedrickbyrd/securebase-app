/**
 * Customer Tier Configuration
 * 
 * Defines which API methods and features each customer tier has access to.
 * This enables tier-based feature gating and compliance requirements.
 * 
 * Pricing:
 * - Standard: $2K/mo (50% off = $4K/mo full price)
 * - FinTech: $8K/mo (50% off = $16K/mo full price)
 * - Healthcare: $15K/mo (50% off = $30K/mo full price)
 * - Government: $25K/mo (50% off = $50K/mo full price)
 */

export const CUSTOMER_TIERS = {
  STANDARD: 'standard',
  FINTECH: 'fintech',
  HEALTHCARE: 'healthcare',
  GOVERNMENT: 'government'
};

export const TIER_CONFIG = {
  [CUSTOMER_TIERS.STANDARD]: {
    name: 'Standard',
    pricing: {
      monthly: 4000, // Full price in cents
      pilot: 2000    // 50% off pilot pricing
    },
    features: {
      // Core metrics (Phase 1 & 2)
      infrastructureMetrics: true,
      databaseMetrics: true,
      lambdaMetrics: true,
      costMetrics: true,
      scalingMetrics: true,
      cacheMetrics: true,
      errorMetrics: true,
      deploymentMetrics: true,
      
      // Phase 3
      securityMetrics: false,
      storageMetrics: true,
      queueMetrics: true,
      mlMetrics: false,
      videoMetrics: false,
      
      // Compliance (Phase 4)
      soc2Compliance: true,
      hipaaCompliance: false,
      pciDssCompliance: false,
      iso27001Compliance: false,
      encryptionStatus: false
    },
    limits: {
      environments: 3,
      users: 5,
      apiCallsPerHour: 1000,
      dataRetentionDays: 30,
      complianceReportsPerMonth: 1,
      customDashboards: 1,
      alertRules: 10
    },
    support: {
      sla: 'business-hours',
      responseTime: '24 hours',
      dedicatedSlack: false,
      onCallSupport: false
    }
  },

  [CUSTOMER_TIERS.FINTECH]: {
    name: 'FinTech',
    pricing: {
      monthly: 16000,
      pilot: 8000
    },
    features: {
      infrastructureMetrics: true,
      databaseMetrics: true,
      lambdaMetrics: true,
      costMetrics: true,
      scalingMetrics: true,
      cacheMetrics: true,
      errorMetrics: true,
      deploymentMetrics: true,
      securityMetrics: true,
      storageMetrics: true,
      queueMetrics: true,
      mlMetrics: true,
      videoMetrics: false,
      soc2Compliance: true,
      hipaaCompliance: false,
      pciDssCompliance: true,
      iso27001Compliance: true,
      encryptionStatus: true
    },
    limits: {
      environments: 5,
      users: 15,
      apiCallsPerHour: 5000,
      dataRetentionDays: 90,
      complianceReportsPerMonth: 4,
      customDashboards: 5,
      alertRules: 50
    },
    support: {
      sla: '24x7',
      responseTime: '4 hours',
      dedicatedSlack: true,
      onCallSupport: true
    }
  },

  [CUSTOMER_TIERS.HEALTHCARE]: {
    name: 'Healthcare',
    pricing: {
      monthly: 30000,
      pilot: 15000
    },
    features: {
      infrastructureMetrics: true,
      databaseMetrics: true,
      lambdaMetrics: true,
      costMetrics: true,
      scalingMetrics: true,
      cacheMetrics: true,
      errorMetrics: true,
      deploymentMetrics: true,
      securityMetrics: true,
      storageMetrics: true,
      queueMetrics: true,
      mlMetrics: true,
      videoMetrics: true,
      soc2Compliance: true,
      hipaaCompliance: true,
      pciDssCompliance: true,
      iso27001Compliance: true,
      encryptionStatus: true
    },
    limits: {
      environments: 10,
      users: 25,
      apiCallsPerHour: 10000,
      dataRetentionDays: 2555,
      complianceReportsPerMonth: 12,
      customDashboards: 10,
      alertRules: 100
    },
    support: {
      sla: '24x7 priority',
      responseTime: '1 hour',
      dedicatedSlack: true,
      onCallSupport: true
    }
  },

  [CUSTOMER_TIERS.GOVERNMENT]: {
    name: 'Government',
    pricing: {
      monthly: 50000,
      pilot: 25000
    },
    features: {
      infrastructureMetrics: true,
      databaseMetrics: true,
      lambdaMetrics: true,
      costMetrics: true,
      scalingMetrics: true,
      cacheMetrics: true,
      errorMetrics: true,
      deploymentMetrics: true,
      securityMetrics: true,
      storageMetrics: true,
      queueMetrics: true,
      mlMetrics: true,
      videoMetrics: true,
      soc2Compliance: true,
      hipaaCompliance: true,
      pciDssCompliance: true,
      iso27001Compliance: true,
      encryptionStatus: true
    },
    limits: {
      environments: 20,
      users: 50,
      apiCallsPerHour: 20000,
      dataRetentionDays: 3650,
      complianceReportsPerMonth: 24,
      customDashboards: 20,
      alertRules: 200
    },
    support: {
      sla: '24x7 dedicated',
      responseTime: '30 minutes',
      dedicatedSlack: true,
      onCallSupport: true
    }
  }
};

export function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG[CUSTOMER_TIERS.STANDARD];
}

export function hasFeatureAccess(tier, featureName) {
  const config = getTierConfig(tier);
  return config.features[featureName] === true;
}

export function getAvailableComplianceFrameworks(tier) {
  const config = getTierConfig(tier);
  const frameworks = [];
  
  if (config.features.soc2Compliance) frameworks.push('soc2');
  if (config.features.hipaaCompliance) frameworks.push('hipaa');
  if (config.features.pciDssCompliance) frameworks.push('pci-dss');
  if (config.features.iso27001Compliance) frameworks.push('iso-27001');
  
  return frameworks;
}

export function getAvailableAPIMethods(tier) {
  const config = getTierConfig(tier);
  const methods = [];
  
  if (config.features.infrastructureMetrics) methods.push('getInfrastructureMetrics');
  if (config.features.databaseMetrics) methods.push('getDatabaseMetrics');
  if (config.features.lambdaMetrics) methods.push('getLambdaMetrics');
  if (config.features.costMetrics) methods.push('getCostMetrics');
  if (config.features.scalingMetrics) methods.push('getScalingMetrics');
  if (config.features.cacheMetrics) methods.push('getCacheMetrics');
  if (config.features.errorMetrics) methods.push('getErrorMetrics');
  if (config.features.deploymentMetrics) methods.push('getDeploymentMetrics');
  if (config.features.securityMetrics) methods.push('getSecurityMetrics');
  if (config.features.storageMetrics) methods.push('getStorageMetrics');
  if (config.features.queueMetrics) methods.push('getQueueMetrics');
  if (config.features.mlMetrics) methods.push('getMLMetrics');
  if (config.features.videoMetrics) methods.push('getVideoMetrics');
  if (config.features.soc2Compliance) methods.push('getSOC2Compliance');
  if (config.features.hipaaCompliance) methods.push('getHIPAACompliance');
  if (config.features.pciDssCompliance) methods.push('getPCIDSSCompliance');
  if (config.features.iso27001Compliance) methods.push('getISO27001Compliance');
  if (config.features.encryptionStatus) methods.push('getEncryptionStatus');
  
  return methods;
}

export function getMonthlyRevenue(tier, isPilot = false) {
  const config = getTierConfig(tier);
  return isPilot ? config.pricing.pilot : config.pricing.monthly;
}

export default {
  CUSTOMER_TIERS,
  TIER_CONFIG,
  getTierConfig,
  hasFeatureAccess,
  getAvailableComplianceFrameworks,
  getAvailableAPIMethods,
  getMonthlyRevenue
};
