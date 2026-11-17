/**
 * SecureBase Sales Strategy & Go-To-Market Playbook Data (2026-2029)
 * Entity: TxImhotep LLC (Mexia & Dallas, TX)
 * Executive Sponsor: Cedrick Jurone Byrd, Founder & Principal Cloud Architect
 * Capitalized Software IP (ASC 350-40): $42,760 (252 engineering hours)
 */

export interface EnterpriseTier {
  id: string;
  name: string;
  targetMarket: string;
  annualArr: string;
  monthlyPricing?: string;
  keyInclusions: string[];
  statutoryFocus: string;
  badge?: string;
}

export const ENTERPRISE_TIERS: EnterpriseTier[] = [
  {
    id: 'commercial-banking',
    name: 'Commercial Banking & FFIEC Tier',
    targetMarket: 'Texas Regional & Community Banks (TBA Members)',
    annualArr: '$24,000 – $48,000',
    monthlyPricing: '$2,000 – $4,000 / mo',
    statutoryFocus: 'FFIEC IT Examination Handbook §II.A–E, Business Continuity §II.B, FDIC 12 CFR Part 364',
    keyInclusions: [
      'Automated FFIEC CAT / IT Handbook mapping',
      '50+ pre-built AWS Config guardrails & landing zones',
      'Amazon S3 Object Lock 7-Year WORM storage',
      'One-click FDIC examination audit snapshot generation',
      'Pre-hardened Terraform modules for active/DR (us-east-1/us-west-2)'
    ],
    badge: 'Texas Banking Focus'
  },
  {
    id: 'healthcare-hipaa',
    name: 'Healthcare & HIPAA Tier',
    targetMarket: 'Regional Hospital Networks, Covered Entities & Health Data Networks (500+ TX Hospitals)',
    annualArr: '$180,000',
    monthlyPricing: '$15,000 / mo',
    statutoryFocus: 'HIPAA Security Rule 45 CFR § 164.312 Technical Safeguards & HHS OCR Evidentiary Shield',
    keyInclusions: [
      'Automated CMEK encryption at rest (KMS HSM)',
      'TLS 1.3 in-transit validation & public ingress blocking',
      '7-Year WORM compliance vaults for patient telemetry',
      'BAA automation & Vendor Risk Management (VRM)',
      'HHS OCR post-breach investigation defense binder'
    ],
    badge: 'Enterprise Healthcare'
  },
  {
    id: 'govcloud-standard',
    name: 'AWS GovCloud Standard Tier',
    targetMarket: 'Federal Contractors & Defense Industrial Base (SAM.gov)',
    annualArr: '$36,000',
    monthlyPricing: '$3,000 / mo',
    statutoryFocus: 'NIST SP 800-171 & CMMC 2.0 Level 2 Certification',
    keyInclusions: [
      'AWS GovCloud (aws-us-gov) boundary guardrails',
      'Automated baseline CMMC 2.0 scoring & gap analysis',
      'Least-privilege RBAC auditing & OIDC federation',
      'Pre-packaged FedRAMP Moderate evidence bundles'
    ]
  },
  {
    id: 'govcloud-enterprise',
    name: 'AWS GovCloud Enterprise Tier',
    targetMarket: 'DoD Supply Chain / Mission Systems (IL4 / IL5)',
    annualArr: '$84,000',
    monthlyPricing: '$7,000 / mo',
    statutoryFocus: 'FedRAMP High / DoD Cloud Computing SRG IL4/IL5 & NIST SP 800-53 Rev. 5',
    keyInclusions: [
      'FedRAMP High NIST SP 800-53 Rev. 5 control matrices',
      'DoD CC SRG IL4/IL5 sovereign boundary enforcement',
      'Zero third-party telemetry egress (strict in-tenant)',
      'Cryptographic HMAC-SHA256 evidence anchoring'
    ],
    badge: 'Defense High-Impact'
  },
  {
    id: 'global-sovereign',
    name: 'Global Sovereign Tier (Euro / Asia)',
    targetMarket: 'Global Sovereign Enclaves & Cross-Border Enterprises',
    annualArr: '$96,000 – $150,000',
    monthlyPricing: '$8,000 – $12,500 / mo',
    statutoryFocus: 'DORA, SecNumCloud 3.2, BSI C5 (Euro) & Japan ISMAP, Australia IRAP, Singapore MAS TRM (Asia)',
    keyInclusions: [
      'SecureBase-Euro & SecureBase-Asia sovereign landing zones',
      'Cross-border telemetry sovereignty isolation',
      'Multi-region statutory crosswalks & local KMS HSM keys'
    ]
  },
  {
    id: 'multi-cloud-governance',
    name: 'Enterprise Multi-Cloud Governance Tier',
    targetMarket: 'Hybrid Enterprise Multi-Cloud Estates',
    annualArr: '$60,000 – $120,000',
    monthlyPricing: '$5,000 – $10,000 / mo',
    statutoryFocus: 'Unified Multi-Cloud Governance across AWS, GCP, and Microsoft Azure',
    keyInclusions: [
      'AWS landing zones + Azure Key Vault CMEK & Entra ID WIF',
      'GCP Cloud Asset Inventory & Security Command Center (SCC) via WIF',
      'Unified multi-cloud compliance scorecards & aggregated WORM vault'
    ]
  }
];

export interface StakeholderPersona {
  role: string;
  title: string;
  decisionCriteria: string;
  valueProposition: string;
  proofPoints: string[];
}

export const STAKEHOLDER_PERSONAS: StakeholderPersona[] = [
  {
    role: 'CISO',
    title: 'Chief Information Security Officer',
    decisionCriteria: 'Automated drift detection, least-privilege IAM, zero alert fatigue, sovereign in-tenant control.',
    valueProposition: 'Continuous real-time posture scoring with 50+ pre-built AWS Config guardrails and zero third-party telemetry egress.',
    proofPoints: [
      'Zero third-party SaaS proxying of customer data',
      'Real-time drift detection reconciled in sub-200ms',
      'Automated pull-request gate blocks violations before deployment'
    ]
  },
  {
    role: 'CRO',
    title: 'Chief Risk Officer / Compliance Committee',
    decisionCriteria: 'Defensible audit trails, OCC/FDIC/OCR examination readiness, board-consumable risk metrics.',
    valueProposition: 'Amazon S3 Object Lock 7-year WORM storage and KMS cryptographic signatures transform screenshots into legally binding evidence.',
    proofPoints: [
      'Reduces manual exam prep from 6–12 weeks to 1-click binder export',
      'FFIEC IT Handbook & HIPAA §164.312 crosswalk verification',
      'Immutable SHA-256 digital digests with non-repudiation'
    ]
  },
  {
    role: 'CTO',
    title: 'Chief Technology Officer / VP Infrastructure',
    decisionCriteria: 'Seamless IaC deployment, zero operational downtime, multi-region disaster recovery.',
    valueProposition: 'Pre-hardened Terraform modules deploying across active/DR regions (us-east-1/us-west-2) with RTO < 15 minutes.',
    proofPoints: [
      'Production-grade syntactically valid OpenTofu / Terraform HCL',
      'Non-destructive patches preserve volume state and routes',
      'Keyless Workload Identity Federation (WIF) eliminates static secrets'
    ]
  },
  {
    role: 'CFO',
    title: 'Chief Financial Officer / Head of Procurement',
    decisionCriteria: 'Fast ROI, minimal operational overhead, frictionless procurement via existing cloud commitments.',
    valueProposition: '80% audit prep reduction with direct procurement via AWS Marketplace EDP commitment drawdown and net-positive pilot credits.',
    proofPoints: [
      'AWS-Subsidized Flywheel: $4,000 Pilot paired with $5,000 AWS WAR Credit delivers Net +$1,000',
      'AWS Marketplace Product ID: prod-p7z4iqf7gg6dk bypasses vendor onboarding',
      'Single-page direct order form with ACH/Wire invoicing option'
    ]
  },
  {
    role: 'DevOps',
    title: 'Cloud Architects & DevOps Engineers',
    decisionCriteria: 'Shift-left verification directly in IDEs and CI/CD pipelines without interrupting workflow.',
    valueProposition: 'securebase-mcp operates keylessly via JSON-RPC 2.0 STDIO inside Cursor and VS Code, validating plans in seconds.',
    proofPoints: [
      'validate_terraform_plan runs locally in < 30 seconds',
      'Auto-generates clean HCL drift patches without data egress',
      'GitHub Marketplace Action integrates in 60 seconds'
    ]
  }
];

export interface FinancialProFormaYear {
  year: string;
  fiscal: string;
  saasRevenue: number;
  consultingRevenue: number;
  totalRevenue: number;
  cloudHostingOpEx: number;
  salesMarketingOpEx: number;
  adminLegalOpEx: number;
  leadershipOpEx: number;
  totalOpEx: number;
  ebitda: number;
  ebitdaMargin: number;
}

export const FINANCIAL_PRO_FORMA: FinancialProFormaYear[] = [
  {
    year: 'Year 1',
    fiscal: '2026–2027',
    saasRevenue: 120000,
    consultingRevenue: 48000,
    totalRevenue: 168000,
    cloudHostingOpEx: 14400,
    salesMarketingOpEx: 6000,
    adminLegalOpEx: 12000,
    leadershipOpEx: 48000,
    totalOpEx: 80400,
    ebitda: 87600,
    ebitdaMargin: 52.1
  },
  {
    year: 'Year 2',
    fiscal: '2027–2028',
    saasRevenue: 180000,
    consultingRevenue: 60000,
    totalRevenue: 240000,
    cloudHostingOpEx: 24000,
    salesMarketingOpEx: 15000,
    adminLegalOpEx: 15000,
    leadershipOpEx: 72000,
    totalOpEx: 126000,
    ebitda: 114000,
    ebitdaMargin: 47.5
  },
  {
    year: 'Year 3',
    fiscal: '2028–2029',
    saasRevenue: 432000,
    consultingRevenue: 96000,
    totalRevenue: 528000,
    cloudHostingOpEx: 48000,
    salesMarketingOpEx: 30000,
    adminLegalOpEx: 24000,
    leadershipOpEx: 120000,
    totalOpEx: 222000,
    ebitda: 306000,
    ebitdaMargin: 58.0
  }
];

export interface ExecutionPhase {
  phase: string;
  timeframe: string;
  title: string;
  focus: string;
  milestones: string[];
}

export const MASTER_EXECUTION_PLAN: ExecutionPhase[] = [
  {
    phase: 'Phase 1',
    timeframe: 'Days 1–60',
    title: 'Lighthouse MAP & Introductory Pilot',
    focus: 'Independent Bank Group (Opp O22568413) & Incommons Bank',
    milestones: [
      'Close Independent Bank Group via AWS Partner Central with Sapna Schwinberg',
      'Deploy 30-Day Paid Sandbox Pilot ($4,000) via AWS Marketplace Private Offer',
      'Apply $5,000 AWS Well-Architected Review (WAR) promotional funding credit',
      'Initiate Hometown Champion Incommons Bank community banking pilot'
    ]
  },
  {
    phase: 'Phase 2',
    timeframe: 'Days 61–120',
    title: 'Agile Bank Scaling & Texas Healthcare Outreach Wave',
    focus: 'Frost Bank, Comerica, Prosperity Bank, and Cook Children\'s',
    milestones: [
      'Standardize community bank landing zones across 11 Tier-2 regional targets',
      'Launch Cook Children\'s Health Care System HIPAA §164.312 outreach sequence',
      'Distribute securebase-mcp developer toolchain for pre-flight plan validation',
      'Reach $15,000 MRR target run rate'
    ]
  },
  {
    phase: 'Phase 3',
    timeframe: 'Days 121–210',
    title: 'Dallas Treasury Hub Expansion & Federal Ingress',
    focus: 'Texas Capital Bank, IBC Bank, and SAM.gov DoD Contractors',
    milestones: [
      'Engage Texas Capital Bank for Dallas treasury security dominance',
      'Launch AWS GovCloud standard baseline for CMMC 2.0 federal contractors',
      'Reach 12 closed commercial accounts with $48,000 MRR ($576,000 CARR)'
    ]
  }
];

export interface CompetitiveComparison {
  dimension: string;
  securebase: string;
  traditionalCspm: string;
  manualGrc: string;
}

export const COMPETITIVE_MATRIX: CompetitiveComparison[] = [
  {
    dimension: 'Evaluation Velocity',
    securebase: 'Pre-flight AST in < 30s before deployment (Shift-Left)',
    traditionalCspm: 'Post-deployment polling every 12–24h',
    manualGrc: 'Annual or quarterly manual spreadsheet audits'
  },
  {
    dimension: 'Data Custody & Telemetry',
    securebase: 'Zero data custody: in-tenant evaluation, zero egress',
    traditionalCspm: 'Full infrastructure metadata egressed to multi-tenant SaaS',
    manualGrc: 'Manual screenshot uploads and email attachments'
  },
  {
    dimension: 'Remediation Capability',
    securebase: 'Autonomous, syntactically verified HCL/OpenTofu PR patches',
    traditionalCspm: 'Read-only alerts or destructive generic auto-fixes',
    manualGrc: 'Manual JIRA ticketing assigned to overwhelmed DevOps'
  },
  {
    dimension: 'Audit Defense Evidence',
    securebase: 'Cryptographic SHA-256 digests in 7-Year WORM S3/GCS Object Lock',
    traditionalCspm: 'Ephemeral SaaS dashboard snapshots without non-repudiation',
    manualGrc: 'PDFs and Word docs stored in shared company drives'
  },
  {
    dimension: 'Procurement Friction',
    securebase: 'AWS Marketplace EDP drawdown (prod-p7z4iqf7gg6dk) + $5k WAR credit',
    traditionalCspm: '3–6 month vendor risk and legal review cycle',
    manualGrc: 'Enterprise consulting RFPs and retainer negotiations'
  }
];

export const EXECUTIVE_IP_SUMMARY = {
  entity: 'TxImhotep LLC',
  headquarters: 'Mexia & Dallas, Texas',
  founder: 'Cedrick Jurone Byrd',
  title: 'Founder & Principal Cloud Architect',
  email: 'cedrickjbyrd@gmail.com',
  asc350Valuation: '$42,760',
  engineeringHours: '252 Hours',
  gcpProject: 'SecureBase-GCP [594006980795]',
  awsMarketplaceProductId: 'prod-p7z4iqf7gg6dk',
  awsPartnerSeller: 'Sapna Schwinberg (sapsch@amazon.com)',
  awsOpportunityId: 'O22568413',
  patentableCore: 'Autonomous pre-flight AST policy enforcement with cryptographic WORM evidence binding'
};

export const AWS_FLYWHEEL_CONFIG = {
  pilotCost: 4000,
  warCredit: 5000,
  netGain: 1000,
  deliveryDays: 30,
  marketplaceListing: 'prod-p7z4iqf7gg6dk',
  guarantee: '100% money-back or full credit toward annual subscription'
};

// ==============================================================================
// Tri-Cloud Marketplace Integration Matrix (Specification v3.0 - Nov 10, 2026)
// Scope: AWS Marketplace, Google Cloud Marketplace & Microsoft Azure Marketplace
// Parity: AWS EDP, Google Cloud EDP, and Microsoft MACC Commitments
// ==============================================================================

export interface TriCloudTier {
  id: string;
  name: string;
  rateAndTerms: string;
  annualValue: number;
  commitmentBurnEligibility: string;
  regulatoryScope: string;
  boardSafe: boolean;
  supportedClouds: ('AWS' | 'GCP' | 'Azure')[];
  keyInclusions: string[];
}

export const TRI_CLOUD_TIERS: TriCloudTier[] = [
  {
    id: 'wedge',
    name: 'Banking Assessment Wedge',
    rateAndTerms: '$3,500 flat fee',
    annualValue: 3500,
    commitmentBurnEligibility: 'Direct Invoice / 100% credited to annual subscription',
    regulatoryScope: '30-Day FFIEC AIO readiness scan, executive gap analysis matrix, examiner-preview packet.',
    boardSafe: true,
    supportedClouds: ['AWS', 'GCP', 'Azure'],
    keyInclusions: [
      '30-Day in-tenant FFIEC AIO readiness evaluation',
      'Executive gap analysis matrix with risk heat map',
      'Examiner preview packet for FDIC & OCC review',
      '100% fee credited toward annual subscription commitment'
    ]
  },
  {
    id: 'regional-banking',
    name: 'Regional Banking Foundation',
    rateAndTerms: '$8,000 / mo ($96K/yr)',
    annualValue: 96000,
    commitmentBurnEligibility: 'AWS EDP / Google EDP / Microsoft MACC',
    regulatoryScope: 'FFIEC AIO/InfoSec, FDIC, OCC, GLBA; sub-3s drift detection; 7-year locked hardware WORM storage.',
    boardSafe: true,
    supportedClouds: ['AWS', 'GCP', 'Azure'],
    keyInclusions: [
      'Continuous in-tenant FFIEC AIO, InfoSec & GLBA 501B examination',
      'Sub-3s drift detection with autonomous OpenTofu remediation',
      '7-year hardware-locked WORM vault (S3 / GCS / Azure Blob)',
      '100% drawdown against AWS EDP, Google EDP, and Microsoft MACC commitments',
      'Under $100K board threshold — rapid CIO/CISO procurement'
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Life Sciences',
    rateAndTerms: '$15,000 / mo ($180K/yr)',
    annualValue: 180000,
    commitmentBurnEligibility: 'AWS EDP / Google EDP / Microsoft MACC',
    regulatoryScope: 'HIPAA § 164.312, HITECH, automated CMEK encryption with 90-day key rotation, 6-year WORM logs.',
    boardSafe: false,
    supportedClouds: ['AWS', 'GCP', 'Azure'],
    keyInclusions: [
      'Comprehensive HIPAA § 164.312 & HITECH technical safeguards',
      'Automated CMEK envelope encryption with 90-day hardware key rotation',
      '6-year immutable WORM patient telemetry audit logs',
      'HHS OCR post-breach investigation defense binder generation',
      'Dedicated health data security architect with 15-minute response SLA'
    ]
  },
  {
    id: 'sovereign-enterprise',
    name: 'Sovereign Bank Enterprise',
    rateAndTerms: '$15,000 / mo ($180K/yr)',
    annualValue: 180000,
    commitmentBurnEligibility: 'AWS EDP / Google EDP / Microsoft MACC',
    regulatoryScope: 'Tri-Cloud posture (AWS + GCP + Azure), custom Rego policy packs, designated architect, 99.99% SLA.',
    boardSafe: false,
    supportedClouds: ['AWS', 'GCP', 'Azure'],
    keyInclusions: [
      'Unified Tri-Cloud posture across AWS, Google Cloud, and Microsoft Azure',
      'Custom OPA Rego policy modules tailored to custom banking charters',
      'Designated Principal Cloud Architect (Cedrick Byrd / TxImhotep LLC)',
      '99.99% sovereign boundary uptime SLA with zero-data-custody guarantee'
    ]
  }
];

export interface CloudLifecycleMatrixRow {
  dimension: string;
  aws: string;
  gcp: string;
  azure: string;
}

export const TRI_CLOUD_INGESTION_MATRIX: CloudLifecycleMatrixRow[] = [
  {
    dimension: 'Ingestion Transport',
    aws: 'Amazon SNS / SQS Topic Subscription',
    gcp: 'Cloud Pub/Sub Push Subscription',
    azure: 'Marketplace Operations API v2 Webhooks'
  },
  {
    dimension: 'Authentication Handshake',
    aws: 'AWS Signature Version 4 (SigV4)',
    gcp: 'Google OIDC Bearer Token (JWKS aud)',
    azure: 'Microsoft Entra ID Bearer JWT validation'
  },
  {
    dimension: 'Entitlement Activation',
    aws: 'ResolveCustomer & SNS subscription token',
    gcp: 'providers.entitlements.approve API call',
    azure: 'Resolve Token + /subscriptions/{id}/activate'
  },
  {
    dimension: 'Usage Metering Engine',
    aws: 'Marketplace Metering Service (BatchMeterUsage)',
    gcp: 'Google Service Control API (services.report)',
    azure: 'Azure Metering API (POST /api/usageEvents)'
  },
  {
    dimension: 'Daily Split-Brain Cron',
    aws: '01:30 UTC: SQS drainage & license verify',
    gcp: '02:00 UTC: providers.entitlements.list',
    azure: '02:30 UTC: GET /api/saas/subscriptions'
  }
];

export const TRI_CLOUD_FEDERATION_MATRIX: CloudLifecycleMatrixRow[] = [
  {
    dimension: 'Trust Mechanism',
    aws: 'IAM OIDC Identity Provider Federation',
    gcp: 'Workload Identity Pool & Provider Mapping',
    azure: 'Entra ID Federated Identity Credentials'
  },
  {
    dimension: 'Telemetry Role Scopes',
    aws: 'arn:aws:iam::aws:policy/SecurityAudit',
    gcp: 'roles/cloudasset.viewer, securitycenter.adminViewer',
    azure: 'Reader, Security Reader (Defender for Cloud)'
  },
  {
    dimension: 'Data-Plane Restrictions',
    aws: 'No S3 object get; no KMS decrypt; no EC2 login',
    gcp: 'No GCS object get; no BigQuery data read',
    azure: 'No Blob Data Reader; no Key Vault decrypt'
  },
  {
    dimension: 'Session Lifespan',
    aws: 'AWS STS AssumeRoleWithWebIdentity (15–60m)',
    gcp: 'Google STS generateAccessToken (15–60m)',
    azure: 'Entra ID OAuth 2.0 Client Assertion (60m max)'
  },
  {
    dimension: 'WORM Evidence Vault',
    aws: 'AWS S3 Object Lock (Compliance Mode)',
    gcp: 'GCS Bucket Retention Policy (Locked WORM)',
    azure: 'Azure Blob Immutable Storage (Legal/Time Hold)'
  }
];

export const TRI_CLOUD_SPEC_DETAILS = {
  platform: 'SecureBase',
  parityScope: 'AWS, Google Cloud & Microsoft Azure',
  date: 'November 10, 2026',
  documentStatus: 'Complete Architectural Baseline',
  revision: 'Tri-Cloud Unified Specification v3.0',
  awsListing: 'prod-p7z4iqf7gg6dk',
  gcpProject: 'securebase-gcp-dev (#594006980795)',
  azureOffer: 'securebase-saas-enterprise',
  oidcIssuer: 'https://api.securebase.tximhotep.com'
};

// Aliases for GCP-specific components backwards compatibility
export interface GcpMarketplaceTier {
  sku: string;
  name: string;
  pricePoint: string;
  annualEquivalent: string;
  billingMode: 'Direct Marketplace / Invoiced' | 'Private Offer / Google EDP Burn' | 'Private Offer Only';
  operationalScope: string;
  entitlementId: string;
  procurementAction: string;
  enforcementDetails: string;
  boardThresholdSafe: boolean;
  features: string[];
}

export const GCP_MARKETPLACE_TIERS: GcpMarketplaceTier[] = [
  {
    sku: 'securebase-assessment-wedge',
    name: 'Banking Assessment Wedge',
    pricePoint: '$3,500 one-time',
    annualEquivalent: '$3,500 one-time (100% credited toward annual)',
    billingMode: 'Direct Marketplace / Invoiced',
    operationalScope: '30-Day FFIEC AIO readiness scan, executive gap analysis matrix, examiner preview packet. 100% credited toward annual.',
    entitlementId: 'securebase-assessment-wedge',
    procurementAction: 'Instant activation via direct marketplace checkout',
    enforcementDetails: 'Read-only pre-flight AST scan across in-tenant GCP/AWS infrastructure; generates FDIC/OCC examiner preview binder.',
    boardThresholdSafe: true,
    features: [
      '30-Day in-tenant FFIEC AIO readiness evaluation',
      'Executive gap analysis matrix with risk heat map',
      'Examiner preview packet for FDIC & OCC review',
      '100% fee credited toward annual subscription commitment'
    ]
  },
  {
    sku: 'securebase-banking-foundation',
    name: 'Regional Banking Foundation',
    pricePoint: '$8,000 / month',
    annualEquivalent: '$96,000 / year (Strictly under $100K board approval threshold)',
    billingMode: 'Private Offer / Google EDP Burn',
    operationalScope: 'Continuous in-tenant FFIEC AIO examination, automated 7-year GCS/S3 WORM evidence vault, sub-3s drift detection.',
    entitlementId: 'securebase-banking-foundation',
    procurementAction: 'Auto-approve via providers.entitlements.approve',
    enforcementDetails: 'Enforces FFIEC AIO & GLBA 501B baseline; configures GCS 7-year hardware-locked WORM bucket; establishes WIF pool.',
    boardThresholdSafe: true,
    features: [
      'Continuous in-tenant FFIEC AIO & GLBA 501B baseline examination',
      'Automated 7-year Google Cloud Storage hardware-locked WORM evidence vault',
      'Sub-3s drift detection with autonomous OpenTofu remediation patches',
      'Draws down directly against customer Google Cloud EDP commitment',
      'Priced at $96k/yr — circumvents tedious $100k+ Board of Directors approval'
    ]
  },
  {
    sku: 'securebase-healthcare-enterprise',
    name: 'Healthcare & Life Sciences',
    pricePoint: '$15,000 / month',
    annualEquivalent: '$180,000 / year',
    billingMode: 'Private Offer / Google EDP Burn',
    operationalScope: 'HIPAA § 164.312, HITECH, automated CMEK envelope encryption, 90-day rotation, 6-year WORM logs, dedicated support SLA.',
    entitlementId: 'securebase-healthcare-enterprise',
    procurementAction: 'Auto-approve via providers.entitlements.approve',
    enforcementDetails: 'Activates HIPAA § 164.312 safeguards, Cloud KMS CMEK envelope encryption, and 6-year retention policies.',
    boardThresholdSafe: false,
    features: [
      'Comprehensive HIPAA Security Rule § 164.312 technical safeguards',
      'Cloud KMS CMEK envelope encryption with automated 90-day key rotation',
      '6-year immutable WORM patient telemetry logs (GCS Object Retention Lock)',
      'HHS OCR post-breach investigation defense binder generation',
      'Dedicated health data security architect with 15-minute response SLA'
    ]
  },
  {
    sku: 'securebase-sovereign-enterprise',
    name: 'Sovereign Bank Enterprise',
    pricePoint: '$15,000 / month',
    annualEquivalent: '$180,000 / year',
    billingMode: 'Private Offer Only',
    operationalScope: 'Tri-cloud (AWS + GCP + Azure) governance, custom Rego policy packs, designated Principal Architect, 99.99% uptime SLA.',
    entitlementId: 'securebase-sovereign-enterprise',
    procurementAction: 'Custom private offer activation',
    enforcementDetails: 'Initializes multi-cloud federation across AWS, GCP, and Azure; binds customer Rego policy modules.',
    boardThresholdSafe: false,
    features: [
      'Unified Tri-Cloud Governance across Google Cloud, AWS, and Microsoft Azure',
      'Custom OPA Rego policy modules tailored to custom banking charters',
      'Designated Principal Cloud Architect (Cedrick Byrd / TxImhotep LLC)',
      '99.99% sovereign boundary uptime SLA with zero-data-custody guarantee'
    ]
  }
];

export const GCP_SPECIFICATION_DETAILS = {
  platform: 'SecureBase',
  projectId: 'securebase-gcp-dev',
  projectNumber: '594006980795',
  date: 'November 10, 2026',
  revision: 'v2.3',
  pubsubTopic: 'projects/securebase-gcp-dev/topics/marketplace-entitlements',
  pubsubSubscription: 'projects/securebase-gcp-dev/subscriptions/entitlement-webhook-push',
  oidcIssuer: 'https://api.securebase.tximhotep.com',
  wifPool: 'projects/594006980795/locations/global/workloadIdentityPools/securebase-pool',
  wifProvider: 'projects/594006980795/locations/global/workloadIdentityPools/securebase-pool/providers/securebase-oidc',
  stsEndpoint: 'https://sts.googleapis.com/v1/token',
  serviceControlService: 'securebase.tximhotep.com',
  procurementProvider: 'providers/tximhotep-public',
  allowedScopes: [
    'roles/cloudasset.viewer',
    'roles/securitycenter.adminViewer',
    'roles/monitoring.viewer'
  ]
};

