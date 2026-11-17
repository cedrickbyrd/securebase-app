/**
 * SecureBase UTM Campaign Attribution & Institutional Personalization Engine
 * Ingests outreach profiles from Texas Banking & Healthcare outreach tracker
 * Developed by TxImhotep LLC
 */

export interface InstitutionalProfile {
  id: string;
  name: string;
  vertical: 'Banking' | 'Healthcare' | 'FinTech' | 'Defense';
  primaryFramework: 'FFIEC' | 'HIPAA' | 'NIST80053';
  utmSource: string;
  utmCampaign: string;
  keyStatute: string;
  targetTier: 'Tier 1' | 'Tier 2' | 'Credit Union' | 'Health System' | 'Defense';
  welcomeMessage: string;
  badgeText: string;
}

export const INSTITUTIONAL_PROFILES: InstitutionalProfile[] = [
  {
    id: 'cookchildrens',
    name: "Cook Children's Health Care System",
    vertical: 'Healthcare',
    primaryFramework: 'HIPAA',
    utmSource: 'cookchildrens',
    utmCampaign: 'hipaa_sovereign_baseline',
    keyStatute: '45 CFR § 164.312 Technical Safeguards (ePHI At-Rest & In-Transit)',
    targetTier: 'Health System',
    welcomeMessage: 'Tailored Sovereign Compliance Control Plane for Fort Worth Pediatric Healthcare Enclaves',
    badgeText: 'HIPAA §164.312 Active'
  },
  {
    id: 'texas_regional_bank',
    name: 'Texas Regional Banking & Financial Institutions',
    vertical: 'Banking',
    primaryFramework: 'FFIEC',
    utmSource: 'texas_regional_bank',
    utmCampaign: 'ffiec_cat_readiness',
    keyStatute: 'FFIEC IT Examination Booklets §II.A–E & FDIC 12 CFR Part 364',
    targetTier: 'Tier 1',
    welcomeMessage: 'Continuous Core Banking Ledger & WORM Storage Governance for Texas Financial Institutions',
    badgeText: 'FFIEC CAT Compliant'
  },
  {
    id: 'austin_fintech',
    name: 'Austin FinTech & Core Transaction Enclaves',
    vertical: 'FinTech',
    primaryFramework: 'FFIEC',
    utmSource: 'austin_fintech',
    utmCampaign: 'soc2_type2_pipeline',
    keyStatute: 'AICPA SOC 2 Type II (CC6.1, CC6.6, CC6.8) & FFIEC Appendix A',
    targetTier: 'Tier 1',
    welcomeMessage: 'High-Velocity Shift-Left IaC Governance & Tokenization Boundary Enforcement',
    badgeText: 'SOC 2 + FFIEC'
  },
  {
    id: 'defense_scada',
    name: 'Defense SCADA & Critical Infrastructure',
    vertical: 'Defense',
    primaryFramework: 'NIST80053',
    utmSource: 'defense_scada',
    utmCampaign: 'fedramp_high_enclave',
    keyStatute: 'NIST SP 800-53 Rev. 5 & FedRAMP High Boundary Protection',
    targetTier: 'Defense',
    welcomeMessage: 'Sovereign Multi-Cloud Enclave Protection with Zero Third-Party Telemetry Egress',
    badgeText: 'FedRAMP High / NIST'
  }
];

export interface CommercialPipelineData {
  totalTargets: number;
  tier1Count: number;
  tier2Count: number;
  creditUnionCount: number;
  averageMonthlyContract: string;
  contractRange: string;
  sixMonthTargetAccounts: number;
  targetMrr: string;
  targetCarr: string;
  entryWedge: {
    programName: string;
    singleCloudPrice: string;
    multiCloudPrice: string;
    durationDays: number;
    incentive: string;
  };
  pipelineStatus: {
    contacted: number;
    inPipeline: number;
    prospective: number;
    notContacted: number;
  };
  ga4Attribution: {
    activeUsersOnCompliance: string;
    totalPlatformEvents: number;
    verifiedEmailAttribution: string;
    activeGeographies: string[];
    utmStandard: string;
  };
  activeChannels: {
    directOutreach: string;
    awsCoSell: string;
    ecosystem: string;
  };
}

export const TEXAS_PIPELINE_DATA: CommercialPipelineData = {
  totalTargets: 28,
  tier1Count: 13,
  tier2Count: 11,
  creditUnionCount: 4,
  averageMonthlyContract: '$4,000',
  contractRange: '$2,500 - $10,000/mo',
  sixMonthTargetAccounts: 12,
  targetMrr: '$48,000',
  targetCarr: '$576,000',
  entryWedge: {
    programName: '3-Day Rapid Cloud Readiness Audit',
    singleCloudPrice: '$3,500',
    multiCloudPrice: '$5,000',
    durationDays: 3,
    incentive: '100% credited toward annual enterprise subscription'
  },
  pipelineStatus: {
    contacted: 4,
    inPipeline: 3,
    prospective: 5,
    notContacted: 15
  },
  ga4Attribution: {
    activeUsersOnCompliance: '8 Unique Users (88.9% of traffic)',
    totalPlatformEvents: 43,
    verifiedEmailAttribution: '2 Sessions (outreach/email and bhgefbdu/email)',
    activeGeographies: [
      'DFW (Duncanville)',
      'Silicon Valley (San Jose)',
      'Midwest (Council Bluffs)',
      'Southeast (Birmingham)'
    ],
    utmStandard: 'Canonical v2.1 Enforced'
  },
  activeChannels: {
    directOutreach: 'Primary Active Channel: Direct Invoicing (ACH/Wire - 1-Page Order Form)',
    awsCoSell: 'Product ID: prod-p7z4iqf7gg6dk ($4,000 Pilot - Net +$1,000 with AWS WAR Credit)',
    ecosystem: 'TBA Ecosystem Partner Network'
  }
};

/**
 * Detects active profile from URL query parameters or returns default
 */
export function detectInstitutionalProfile(): InstitutionalProfile {
  if (typeof window === 'undefined') return INSTITUTIONAL_PROFILES[0];

  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source')?.toLowerCase();
  const campaign = params.get('utm_campaign')?.toLowerCase();

  if (source || campaign) {
    const matched = INSTITUTIONAL_PROFILES.find(
      p => (source && p.utmSource.toLowerCase().includes(source)) ||
           (campaign && p.utmCampaign.toLowerCase().includes(campaign))
    );
    if (matched) return matched;
  }

  // Default to Texas Regional Bank profile as primary banking TOFU
  return INSTITUTIONAL_PROFILES[1];
}
