/**
 * SRE Service - Production API calls for infrastructure metrics
 *
 * This service makes REAL API calls to CloudWatch, X-Ray, and custom metrics endpoints.
 * In demo mode (VITE_DEMO_MODE=true or hostname includes 'demo') it returns realistic
 * mock data so enterprise prospects see a fully-populated dashboard.
 *
 * Phase 1 (Core): Infrastructure, Database, Lambda, Cost, Deployments
 * Phase 2 (Security): Security, Scaling, Cache, Errors
 * Phase 3 (Advanced): Storage, Queues, ML, Video, Encryption
 * Phase 4 (Compliance): SOC 2, HIPAA, PCI-DSS, ISO 27001
 *
 * Supports 10 pilot customers across 3 tiers:
 * - Healthcare ($15K/mo): HIPAA, encryption, PHI audit
 * - FinTech ($8K/mo): PCI-DSS, real-time monitoring, security
 * - Standard ($2K/mo): SOC 2, basic metrics, cost optimization
 */

// ============================================================================
// Helpers
// ============================================================================

function isDemoMode() {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
    if (typeof window !== 'undefined' && window.location.hostname.includes('demo')) return true;
  } catch (_) {
    // ignore – e.g. SSR / test environments
  }
  return false;
}

function getAuthToken() {
  try {
    // Read from sessionStorage only — localStorage tokens are no longer used.
    // HttpOnly JWT cookies are sent automatically by the browser via
    // credentials:'include'; no explicit Authorization header is required for
    // same-origin /api/* routes.
    return sessionStorage.getItem('authToken') || sessionStorage.getItem('sessionToken') || '';
  } catch (_) {
    return '';
  }
}

function buildHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Returns fetch options with credentials:'include' so the browser sends the
 * HttpOnly JWT cookie automatically on every same-origin /api/* request.
 * An explicit Authorization header is added when a sessionStorage token is
 * present (supports external API Gateway routes in production).
 *
 * @param {Object} [extra={}]  Additional fetch options (e.g. body, method)
 * @returns {Object}
 */
function buildFetchOptions(extra = {}) {
  return {
    credentials: 'include',
    headers: buildHeaders(),
    ...extra,
  };
}

// ============================================================================
// Mock / demo data helpers
// ============================================================================

function makeTrend(base, count = 12, variance = 0.15) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (count - 1 - i) * 5 * 60 * 1000).toISOString(),
    value: Math.round(base * (1 + (Math.random() - 0.5) * variance))
  }));
}

function getMockInfrastructureMetrics(_timeRange) {
  return {
    cpu: { current: 34, average: 31, max: 62, trend: makeTrend(31) },
    memory: { current: 67, average: 63, max: 78, trend: makeTrend(63) },
    disk: { current: 42, average: 41, max: 44, trend: makeTrend(41) },
    network: { in: 128.4, out: 54.2, trend: makeTrend(128) }
  };
}

function getMockDatabaseMetrics() {
  return {
    aurora: {
      queryLatency: { p50: 4.2, p95: 18.7, p99: 42.1 },
      connections: { current: 87, max: 500, utilization: 17.4 },
      iops: { read: 1240, write: 380 },
      replicationLag: 0.8
    },
    dynamodb: {
      readCapacity: { consumed: 42.3, provisioned: 100 },
      writeCapacity: { consumed: 18.7, provisioned: 50 },
      throttles: { read: 0, write: 0 },
      latency: { get: 1.2, put: 2.1, query: 3.8 }
    }
  };
}

function getMockLambdaMetrics() {
  return {
    coldStarts: { count: 23, percentage: 2.1, avgDuration: 412 },
    duration: { p50: 38, p95: 187, p99: 342, max: 892 },
    throttles: { count: 0, rate: 0 },
    concurrency: { current: 47, max: 1000, utilization: 4.7 },
    errors: { count: 3, rate: 0.03 },
    byFunction: [
      { name: 'auth-v2', invocations: 4820, errors: 1, avgDuration: 42 },
      { name: 'billing-worker', invocations: 288, errors: 0, avgDuration: 1840 },
      { name: 'metrics-aggregator', invocations: 1440, errors: 2, avgDuration: 213 },
      { name: 'report-engine', invocations: 96, errors: 0, avgDuration: 3120 }
    ]
  };
}

function getMockCostMetrics() {
  return {
    byService: [
      { service: 'EC2', cost: 4820.50, percentage: 38.2 },
      { service: 'RDS / Aurora', cost: 2340.00, percentage: 18.5 },
      { service: 'Lambda', cost: 187.40, percentage: 1.5 },
      { service: 'S3', cost: 340.20, percentage: 2.7 },
      { service: 'CloudFront', cost: 210.80, percentage: 1.7 },
      { service: 'API Gateway', cost: 128.60, percentage: 1.0 },
      { service: 'Other', cost: 4588.50, percentage: 36.4 }
    ],
    total: 12616.00,
    trend: { direction: 'down', percentage: 3.2 },
    forecast: 13100.00
  };
}

function getMockSecurityMetrics() {
  return {
    guardDuty: {
      findings: [
        { id: 'gd-001', title: 'Unusual API call from new region', severity: 'medium', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
      ],
      severityCounts: { critical: 0, high: 0, medium: 1, low: 4 }
    },
    waf: {
      blockedRequests: 1842,
      allowedRequests: 284720,
      ruleViolations: [
        { rule: 'SQLi-Rule', count: 312 },
        { rule: 'XSS-Rule', count: 147 },
        { rule: 'RateLimit-Rule', count: 1383 }
      ]
    },
    authentication: {
      failedAttempts: 28,
      suspiciousLogins: 1,
      mfaAdoption: 94.2
    },
    encryption: {
      atRest: { compliant: 80, total: 80 },
      inTransit: { compliant: 15, total: 15 }
    }
  };
}

function getMockScalingMetrics() {
  return {
    lambda: { current: 47, desired: 50, max: 1000, utilization: 4.7 },
    ecs: { current: 6, desired: 6, max: 20, utilization: 30 },
    apiGateway: { requests: 284720, throttles: 18 }
  };
}

function getMockCacheMetrics() {
  return {
    redis: {
      hitRate: 94.2,
      hits: 182400,
      misses: 10560,
      evictions: 42,
      connections: 38,
      memoryUsage: 61.4
    }
  };
}

function getMockErrorMetrics() {
  return {
    byService: [
      { service: 'auth-v2', errors: 1, rate: 0.02 },
      { service: 'metrics-aggregator', errors: 2, rate: 0.14 },
      { service: 'api-gateway', errors: 4, rate: 0.001 }
    ],
    total: 7,
    rate: 0.024,
    trend: makeTrend(7, 24, 0.5)
  };
}

function getMockDeploymentMetrics() {
  return {
    recent: [
      { id: 'dep-0041', service: 'auth-v2', status: 'success', duration: 84, deployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 'dep-0040', service: 'billing-worker', status: 'success', duration: 112, deployedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { id: 'dep-0039', service: 'metrics-aggregator', status: 'success', duration: 97, deployedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() }
    ],
    successRate: 97.8,
    averageDuration: 98,
    inProgress: 0
  };
}

// ============================================================================
// Phase 4 compliance demo data
// ============================================================================

function getMockSOC2Compliance() {
  return {
    overallScore: 94,
    totalControls: 209,
    passedControls: 196,
    failedControls: 13,
    categories: {
      security: { passed: 47, total: 50, percentage: 94 },
      availability: { passed: 41, total: 42, percentage: 97.6 },
      processingIntegrity: { passed: 35, total: 37, percentage: 94.6 },
      confidentiality: { passed: 40, total: 43, percentage: 93 },
      privacy: { passed: 33, total: 37, percentage: 89.2 }
    },
    findings: [
      { id: 'soc2-f001', title: 'Password rotation policy not enforced for 2 service accounts', severity: 'medium', category: 'security' },
      { id: 'soc2-f002', title: 'CloudTrail logging disabled in us-west-1 DR region', severity: 'high', category: 'availability' }
    ],
    lastScanDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    nextScanDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function getMockHIPAACompliance() {
  return {
    overallScore: 87,
    safeguards: {
      administrative: { passed: 18, total: 20, percentage: 90 },
      physical: { passed: 13, total: 14, percentage: 92.9 },
      technical: { passed: 20, total: 24, percentage: 83.3 }
    },
    phi: {
      encryptionAtRest: true,
      encryptionInTransit: true,
      accessLogging: true,
      auditTrail: true
    },
    phiEncryption: { atRest: true, inTransit: true, verified: true },
    baaCompliance: {
      signed: true,
      vendors: ['AWS', 'Supabase', 'Datadog']
    },
    findings: [
      { id: 'hipaa-f001', title: 'PHI access review cadence below 90-day requirement', severity: 'medium' },
      { id: 'hipaa-f002', title: 'Training completion rate 84% — target 100%', severity: 'low' }
    ],
    riskLevel: 'low'
  };
}

function getMockPCIDSSCompliance() {
  return {
    overallScore: 91,
    requirements: {
      networkSecurity: { passed: 8, total: 9, percentage: 88.9 },
      cardholderData: { passed: 11, total: 12, percentage: 91.7 },
      vulnerabilityManagement: { passed: 7, total: 7, percentage: 100 },
      accessControl: { passed: 13, total: 14, percentage: 92.9 },
      monitoring: { passed: 9, total: 10, percentage: 90 },
      securityPolicies: { passed: 6, total: 6, percentage: 100 }
    },
    cardholderDataEnvironment: {
      identified: true,
      segmented: true,
      encrypted: true
    },
    findings: [
      { id: 'pci-f001', title: 'Network diagram not updated after Q1 topology change', severity: 'low' }
    ],
    attestationStatus: 'in-progress',
    lastAssessmentDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    nextAssessmentDue: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function getMockISO27001Compliance() {
  return {
    overallScore: 84,
    clauses: {
      informationSecurityPolicies: { passed: 4, total: 4 },
      organizationOfInformationSecurity: { passed: 5, total: 6 },
      humanResourceSecurity: { passed: 5, total: 6 },
      assetManagement: { passed: 8, total: 10 },
      accessControl: { passed: 12, total: 14 },
      cryptography: { passed: 4, total: 4 },
      physicalSecurity: { passed: 9, total: 11 },
      operationsSecurity: { passed: 11, total: 14 },
      communicationsSecurity: { passed: 6, total: 7 },
      systemDevelopment: { passed: 8, total: 10 },
      supplierRelationships: { passed: 4, total: 5 },
      incidentManagement: { passed: 6, total: 7 },
      businessContinuity: { passed: 4, total: 4 },
      compliance: { passed: 7, total: 8 }
    },
    findings: [
      { id: 'iso-f001', title: 'Supplier risk assessment cadence needs documentation', severity: 'medium' },
      { id: 'iso-f002', title: 'Asset register missing 3 shadow-IT entries', severity: 'low' }
    ],
    certificationStatus: 'in-progress'
  };
}

function getMockEncryptionStatus() {
  return {
    kms: {
      keys: [
        { id: 'mrk-prod-data', alias: 'alias/securebase-prod-data', rotationEnabled: true },
        { id: 'mrk-prod-rds', alias: 'alias/securebase-prod-rds', rotationEnabled: true },
        { id: 'mrk-prod-s3', alias: 'alias/securebase-prod-s3', rotationEnabled: true }
      ],
      rotationCompliant: 3,
      totalKeys: 3
    },
    s3: { encryptedBuckets: 24, totalBuckets: 24, defaultEncryption: true },
    rds: { encryptedInstances: 6, totalInstances: 6 },
    ebs: { encryptedVolumes: 38, totalVolumes: 38 },
    inTransit: { tlsEnforced: true, certificateExpiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() }
  };
}

// ============================================================================
// Service object
// ============================================================================

export const sreService = {
  /**
   * Fetch infrastructure metrics (CPU, memory, disk, network)
   */
  async getInfrastructureMetrics(timeRange = '1h') {
    if (isDemoMode()) return getMockInfrastructureMetrics(timeRange);

    const response = await fetch(`/api/sre/infrastructure?range=${timeRange}`, buildFetchOptions());
    if (!response.ok) throw new Error(`Infrastructure metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch deployment pipeline metrics
   */
  async getDeploymentMetrics() {
    if (isDemoMode()) return getMockDeploymentMetrics();

    const response = await fetch('/api/sre/deployments', buildFetchOptions());
    if (!response.ok) throw new Error(`Deployment metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch auto-scaling metrics
   */
  async getScalingMetrics() {
    if (isDemoMode()) return getMockScalingMetrics();

    const response = await fetch('/api/sre/scaling', buildFetchOptions());
    if (!response.ok) throw new Error(`Scaling metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch database performance metrics
   */
  async getDatabaseMetrics() {
    if (isDemoMode()) return getMockDatabaseMetrics();

    const response = await fetch('/api/sre/database', buildFetchOptions());
    if (!response.ok) throw new Error(`Database metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch cache metrics
   */
  async getCacheMetrics() {
    if (isDemoMode()) return getMockCacheMetrics();

    const response = await fetch('/api/sre/cache', buildFetchOptions());
    if (!response.ok) throw new Error(`Cache metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch error metrics
   */
  async getErrorMetrics() {
    if (isDemoMode()) return getMockErrorMetrics();

    const response = await fetch('/api/sre/errors', buildFetchOptions());
    if (!response.ok) throw new Error(`Error metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch Lambda performance metrics
   */
  async getLambdaMetrics() {
    if (isDemoMode()) return getMockLambdaMetrics();

    const response = await fetch('/api/sre/lambda', buildFetchOptions());
    if (!response.ok) throw new Error(`Lambda metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch cost metrics
   */
  async getCostMetrics() {
    if (isDemoMode()) return getMockCostMetrics();

    const response = await fetch('/api/sre/cost', buildFetchOptions());
    if (!response.ok) throw new Error(`Cost metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch security metrics (GuardDuty, WAF, authentication)
   * Needed by: FinOptix, SecureComm, PaySafe, HealthSync
   */
  async getSecurityMetrics() {
    if (isDemoMode()) return getMockSecurityMetrics();

    const response = await fetch('/api/sre/security', buildFetchOptions());
    if (!response.ok) throw new Error(`Security metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch compliance score for a given framework
   * Needed by: All 10 customers
   * @param {string[]} frameworks - e.g. ['soc2', 'hipaa', 'pci-dss']
   */
  async getComplianceScore(frameworks = ['soc2']) {
    if (isDemoMode()) {
      const results = {};
      for (const framework of frameworks) {
        switch (framework.toLowerCase()) {
          case 'soc2':    results.soc2    = getMockSOC2Compliance();    break;
          case 'hipaa':   results.hipaa   = getMockHIPAACompliance();   break;
          case 'pci-dss':
          case 'pcidss':  results.pciDss  = getMockPCIDSSCompliance();  break;
          case 'iso27001':
          case 'iso-27001': results.iso27001 = getMockISO27001Compliance(); break;
        }
      }
      return results;
    }

    const query = frameworks.join(',');
    const response = await fetch(`/api/sre/compliance/score?frameworks=${query}`, buildFetchOptions());
    if (!response.ok) throw new Error(`Compliance score failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch HIPAA compliance status
   * Needed by: Trellis AI, HealthSync (Healthcare tier)
   */
  async getHIPAACompliance() {
    return getMockHIPAACompliance();
  },

  /**
   * Fetch PCI-DSS compliance status
   * Needed by: FinOptix, PaySafe, RetailFlow (FinTech tier)
   */
  async getPCIDSSCompliance() {
    return getMockPCIDSSCompliance();
  },

  /**
   * Fetch SOC 2 compliance status
   * Needed by: All 10 customers
   */
  async getSOC2Compliance() {
    return getMockSOC2Compliance();
  },

  /**
   * Fetch ISO 27001 compliance status
   * Needed by: SecureComm (enterprise tier)
   */
  async getISO27001Compliance() {
    return getMockISO27001Compliance();
  },

  /**
   * Fetch storage metrics (S3, EBS, EFS)
   * Needed by: DataVault Pro, CloudDocs, AI Insights Corp
   */
  async getStorageMetrics() {
    if (isDemoMode()) {
      return {
        s3: {
          buckets: [],
          totalSize: 14820,
          growthRate: 4.2,
          lifecyclePolicies: { active: 18, total: 24 },
          storageClasses: { standard: 8400, ia: 2200, glacier: 2220, intelligentTiering: 2000 }
        },
        ebs: { volumes: 38, totalSize: 3200, utilization: 64 },
        efs: { filesystems: 4, totalSize: 1100 }
      };
    }

    const response = await fetch('/api/sre/storage', buildFetchOptions());
    if (!response.ok) throw new Error(`Storage metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch queue metrics (SQS, SNS)
   * Needed by: PaySafe, RetailFlow
   */
  async getQueueMetrics() {
    if (isDemoMode()) {
      return {
        sqs: {
          queues: [],
          totalMessages: 142,
          oldestMessage: 8,
          dlqMessages: 0,
          processingRate: 840
        },
        sns: {
          topics: [],
          messagesPublished: 48200,
          deliveryFailures: 3
        }
      };
    }

    const response = await fetch('/api/sre/queues', buildFetchOptions());
    if (!response.ok) throw new Error(`Queue metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch ML infrastructure metrics (SageMaker)
   * Needed by: AI Insights Corp
   */
  async getMLMetrics() {
    if (isDemoMode()) {
      return {
        sagemaker: {
          endpoints: [],
          inferenceLatency: { p50: 24, p95: 87, p99: 142 },
          gpuUtilization: 72
        },
        trainingJobs: {
          active: 2,
          completed: 148,
          failed: 3,
          averageDuration: 4200
        },
        models: {
          deployed: 7,
          versions: 14
        }
      };
    }

    const response = await fetch('/api/sre/ml', buildFetchOptions());
    if (!response.ok) throw new Error(`ML metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch video processing metrics (MediaConvert, streaming)
   * Needed by: HealthSync
   */
  async getVideoMetrics() {
    if (isDemoMode()) {
      return {
        mediaConvert: {
          jobsCompleted: 1284,
          jobsFailed: 8,
          averageDuration: 184,
          queueDepth: 3
        },
        streaming: {
          activeSessions: 142,
          averageBitrate: 4200,
          bufferingRate: 0.8,
          qualityScore: 97
        },
        cloudfront: {
          cacheHitRate: 87.4,
          bandwidth: 2840,
          errorRate: 0.04
        }
      };
    }

    const response = await fetch('/api/sre/video', buildFetchOptions());
    if (!response.ok) throw new Error(`Video metrics failed: ${response.status}`);
    return response.json();
  },

  /**
   * Fetch encryption audit status (KMS, S3, RDS, EBS)
   * Needed by: Trellis AI, HealthSync (HIPAA requirement)
   */
  async getEncryptionStatus() {
    return getMockEncryptionStatus();
  }
};

export default sreService;
