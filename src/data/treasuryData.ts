/**
 * TxImhotep Treasury GuardRails Architecture & Engine Data
 * Entity: TxImhotep LLC
 * Banking Partner: Texas Capital Bank (TCB)
 * Engine: tximhotep-engine v3.1 / v1.2.0
 * Policy Schema: https://tximhotep.io/schemas/v1.2.0/policy.json
 */

export interface TreasuryPolicyRule {
  id: string;
  name: string;
  scope: string;
  condition: string;
  actionOnBreach: string;
  enforcementRail: string;
  description: string;
}

export const TREASURY_POLICY_RULES: TreasuryPolicyRule[] = [
  {
    id: 'POL-001',
    name: 'ECR Fee Neutrality Rule',
    scope: 'Treasury Yield & Fee Neutrality',
    condition: 'dda_peg >= 35000 AND ecr_coverage >= 100%',
    actionOnBreach: 'Auto Sweep Rebalance from MMA to DDA',
    enforcementRail: 'TCB Analyzed Sweep Desk',
    description: 'Requires DDA Balance >= $35,000 to maintain ECR allowance >= monthly bank fees.'
  },
  {
    id: 'POL-002',
    name: 'Minimum Yield Reserve Floor',
    scope: 'Minimum MMA Reserve Floor',
    condition: 'mma_balance >= 25000',
    actionOnBreach: 'Block Outbound Capital Disbursements',
    enforcementRail: 'TCB Executive Money Market',
    description: 'Requires Executive MMA Balance >= $25,000; alerts if liquidity sweep drops below floor.'
  },
  {
    id: 'POL-003',
    name: 'Cloud Sandbox & USPTO Cap',
    scope: 'Cloud & USPTO Patent Sandbox',
    condition: 'cloud_spend_monthly <= 3500',
    actionOnBreach: 'Revoke IAM Provisioning & Lock Virtual Cards',
    enforcementRail: 'Ramp API & AWS IAM Middleware',
    description: 'Max $3,500/mo for AWS GovCloud / GCP / Azure development and USPTO patent automation.'
  },
  {
    id: 'POL-004',
    name: 'Contractor Payroll Ceiling',
    scope: 'Contractor Payroll & Admin Cap',
    condition: 'payroll_monthly <= 20000',
    actionOnBreach: 'Trigger Dual-Admin Hard Approval Gate',
    enforcementRail: 'TCB ACH Batch Rail & Mercury API',
    description: 'Max $20,000/mo for engineering and administrative contractors.'
  },
  {
    id: 'POL-005',
    name: 'Tax & Compliance Reserve Isolation',
    scope: 'Tax & Statutory Reserve',
    condition: 'tax_reserve_account.debits == 0',
    actionOnBreach: 'Reject Non-Tax Authority Wire Requests',
    enforcementRail: 'TCB Isolated Sub-DDA',
    description: 'Guarantees quarterly franchise and federal tax reserves remain ring-fenced from operational draws.'
  },
  {
    id: 'POL-006',
    name: 'Emergency Liquidity Drawdown Gate',
    scope: 'Core Treasury Vault',
    condition: 'drawdown_request > 10000',
    actionOnBreach: 'Require Multi-Factor Board Quorum Sign-off',
    enforcementRail: 'tximhotep-engine Core Vault',
    description: 'Protects principal treasury reserves against unauthorized wire requests exceeding $10,000.'
  }
];

export interface FintechComparisonDimension {
  criteria: string;
  subtext: string;
  mercury: {
    title: string;
    description: string;
    isAdvantage?: boolean;
    badge?: string;
  };
  ramp: {
    title: string;
    description: string;
    isAdvantage?: boolean;
    badge?: string;
  };
}

export const FINTECH_COMPARISON_MATRIX: FintechComparisonDimension[] = [
  {
    criteria: 'Core Architectural Domain',
    subtext: 'Primary engineering focus',
    mercury: {
      title: 'Treasury & Bank Liquidity',
      description: 'Multi-vault checking, high-yield sweeps, and FDIC extended insurance up to $5M.'
    },
    ramp: {
      title: 'Corporate Card & Expense Control',
      description: 'Granular virtual card limits, automated receipt matching, and vendor locking.'
    }
  },
  {
    criteria: 'Treasury Yield & Sweeps',
    subtext: 'Yield generation capabilities',
    mercury: {
      title: 'Automated Treasury Yield (5.0%+)',
      description: 'Direct sweep into Vanguard/BlackRock money market funds with daily liquidity.',
      isAdvantage: true,
      badge: 'Treasury Choice'
    },
    ramp: {
      title: '1.5% Card Cashback Rebate',
      description: 'Rebate-focused on card spend rather than primary treasury liquidity sweeps.'
    }
  },
  {
    criteria: 'Spend Policy Guardrails',
    subtext: 'Card & vendor limits enforcement',
    mercury: {
      title: 'Standard User & Debit Caps',
      description: 'Basic monthly limit parameters on issued debit cards.'
    },
    ramp: {
      title: 'Granular Vendor-Level Lock',
      description: 'Single-vendor virtual cards with exact spending caps and automatic charge blocking.',
      isAdvantage: true,
      badge: 'Guardrail Choice'
    }
  },
  {
    criteria: 'Programmatic APIs',
    subtext: 'Developer & CI/CD integrations',
    mercury: {
      title: 'First-Class REST Treasury API',
      description: 'Programmatic ACH/wire origination, sub-account creation, and transaction webhooks.',
      isAdvantage: true
    },
    ramp: {
      title: 'ERP & Accounting APIs',
      description: 'Deep integration with NetSuite, QuickBooks, and Workday for automated expense coding.'
    }
  },
  {
    criteria: 'Dual-Control Authorizations',
    subtext: 'Governance & operational security',
    mercury: {
      title: 'Multi-Admin Wire Approvals',
      description: 'Enforces dual sign-off on outgoing wire transactions exceeding configured thresholds.'
    },
    ramp: {
      title: 'Multi-Level Approval Chains',
      description: 'Manager & CFO approval routing based on department, amount, or merchant category.',
      isAdvantage: true
    }
  },
  {
    criteria: 'Multi-Cloud / Terraform Integration',
    subtext: 'DevOps infrastructure synergy',
    mercury: {
      title: 'Custom Provider via Token API',
      description: 'Automates treasury sub-account creation during environment provisioning via token API.'
    },
    ramp: {
      title: 'SCIM / Okta Provisioning',
      description: 'Auto-issues developer sandbox virtual cards alongside cloud IAM credentials.'
    }
  }
];

export const DEFAULT_TREASURY_CONFIG = {
  bankingPartner: 'Texas Capital Bank (TCB)',
  totalLiquidity: 115000,
  ddaTargetPeg: 35000,
  cloudSpend: 2800,
  cloudSpendCap: 3500,
  payrollSpend: 16500,
  payrollSpendCap: 20000,
  mmaFloor: 25000,
  ecrRate: 2.50, // % ECR
  mmaYield: 4.65, // % APY
  baseAccountFee: 25,
  wireFee: 15,
  wireCount: 4,
  achBatchFee: 10,
  achBatchCount: 4,
  tokenFee: 10
};
