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
 * - Fintech Pro: $7.5K/mo — Texas DOB examiner evidence automation for licensed MTs
 * - Fintech Elite: $12K/mo — Multi-state (TX + NY DFS, CA DFPI) + digital asset DASP coverage
 */

export const CUSTOMER_TIERS = {
  STANDARD: 'standard',
  FINTECH: 'fintech',
  FINTECH_PRO: 'fintech_pro',
  FINTECH_ELITE: 'fintech_elite',
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

  [CUSTOMER_TIERS.FINTECH_PRO]: {
    name: 'Fintech Pro',
    description: 'Texas DOB examiner evidence automation for licensed money transmitters',
    pricing: {
      monthly: 7500,
      pilot: 5000      // beta pricing for design partners
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
      mlMetrics: false,
      videoMetrics: false,
      soc2Compliance: true,
      hipaaCompliance: false,
      pciDssCompliance: true,
      iso27001Compliance: true,
      encryptionStatus: true,
      // Texas regulatory compliance (new)
      texasCompliance: true,
      texasTransactionRecordkeeping: true,   // TX-MT-R1
      texasCTRFiling: true,                  // TX-MT-R2a
      texasSARFiling: true,                  // TX-MT-R2b
      texasCIPVerification: true,            // TX-MT-R3
      texasDigitalAssetSegregation: true,    // TX-MT-R4
      texasExaminerPortal: true,             // React examiner evidence export
      texasMultiStateCompliance: false,      // NY DFS, CA DFPI (Elite only)
      texasDASPLicense: false
    },
    limits: {
      environments: 5,
      users: 20,
      apiCallsPerHour: 5000,
      dataRetentionDays: 1825,              // 5 years (7 TAC §33.35 requirement)
      complianceReportsPerMonth: 12,
      customDashboards: 5,
      alertRules: 50,
      examinerExportsPerMonth: 4
    },
    support: {
      sla: '24x7',
      responseTime: '4 hours',
      dedicatedSlack: true,
      onCallSupport: true,
      complianceHotline: true
    },
    regulatoryInfo: {
      primaryRegulator: 'Texas Department of Banking (DOB)',
      licenseType: 'Money Transmitter License (MTL)',
      frameworks: ['7 TAC §33', '31 CFR §1022', 'TX HB 1666'],
      controls: ['TX-MT-R1', 'TX-MT-R2a', 'TX-MT-R2b', 'TX-MT-R3', 'TX-MT-R4']
    }
  },

  [CUSTOMER_TIERS.FINTECH_ELITE]: {
    name: 'Fintech Elite',
    description: 'Multi-state compliance automation + digital asset DASP coverage',
    pricing: {
      monthly: 12000,
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
      encryptionStatus: true,
      // Texas regulatory compliance (full suite)
      texasCompliance: true,
      texasTransactionRecordkeeping: true,   // TX-MT-R1
      texasCTRFiling: true,                  // TX-MT-R2a
      texasSARFiling: true,                  // TX-MT-R2b
      texasCIPVerification: true,            // TX-MT-R3
      texasDigitalAssetSegregation: true,    // TX-MT-R4
      texasExaminerPortal: true,
      texasMultiStateCompliance: true,       // NY DFS, CA DFPI, FL OFR
      texasDASPLicense: true                 // TX-DASP-R1
    },
    limits: {
      environments: 10,
      users: 30,
      apiCallsPerHour: 10000,
      dataRetentionDays: 1825,              // 5 years
      complianceReportsPerMonth: 24,
      customDashboards: 10,
      alertRules: 100,
      examinerExportsPerMonth: 12,
      statesSupported: 4                    // TX + NY + CA + FL
    },
    support: {
      sla: '24x7 priority',
      responseTime: '1 hour',
      dedicatedSlack: true,
      onCallSupport: true,
      complianceHotline: true,
      dedicatedSuccessManager: true
    },
    regulatoryInfo: {
      primaryRegulator: 'Texas Department of Banking (DOB)',
      additionalRegulators: ['NY DFS', 'CA DFPI', 'FL OFR'],
      licenseType: 'Money Transmitter License (MTL) + DASP',
      frameworks: ['7 TAC §33', '31 CFR §1022', 'TX HB 1666', 'TX Fin. Code §152'],
      controls: ['TX-MT-R1', 'TX-MT-R2a', 'TX-MT-R2b', 'TX-MT-R3', 'TX-MT-R4', 'TX-DASP-R1']
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
  if (config.features.texasCompliance) frameworks.push('texas-dob');
  if (config.features.texasDASPLicense) frameworks.push('texas-dasp');
  if (config.features.texasMultiStateCompliance) frameworks.push('multi-state-mt');
  
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
  if (config.features.texasCompliance) methods.push('getTexasComplianceStatus');
  if (config.features.texasTransactionRecordkeeping) methods.push('getTexasTransactionRecords');
  if (config.features.texasCTRFiling) methods.push('getTexasCTRFilings');
  if (config.features.texasSARFiling) methods.push('getTexasSARFilings');
  if (config.features.texasCIPVerification) methods.push('getTexasCIPRecords');
  if (config.features.texasDigitalAssetSegregation) methods.push('getTexasDigitalAssets');
  if (config.features.texasExaminerPortal) methods.push('generateTexasExaminerExport');
  if (config.features.texasMultiStateCompliance) methods.push('getMultiStateComplianceStatus');
  if (config.features.texasDASPLicense) methods.push('getTexasDASPCompliance');
  
  return methods;
}

export function getMonthlyRevenue(tier, isPilot = false) {
  const config = getTierConfig(tier);
  return isPilot ? config.pricing.pilot : config.pricing.monthly;
}

export function hasTexasComplianceAccess(tier) {
  const config = getTierConfig(tier);
  return config.features.texasCompliance === true;
}

export function getTexasControls(tier) {
  const config = getTierConfig(tier);
  return config.regulatoryInfo?.controls || [];
}

export default {
  CUSTOMER_TIERS,
  TIER_CONFIG,
  getTierConfig,
  hasFeatureAccess,
  getAvailableComplianceFrameworks,
  getAvailableAPIMethods,
  getMonthlyRevenue,
  hasTexasComplianceAccess,
  getTexasControls
};
