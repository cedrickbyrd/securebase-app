// Demo data utilities for demo mode

export const isDemoMode = () => {
  return (
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    localStorage.getItem('demo_mode') === 'true' ||
    new URLSearchParams(window.location.search).get('demo') === 'true'
  );
};

export const getDemoUser = () => {
  const userStr = localStorage.getItem('demo_user');
  return userStr ? JSON.parse(userStr) : null;
};

export const mockComplianceData = {
  overallScore: 94,
  totalControls: 209,
  passedControls: 197,
  failedControls: 12,
  criticalFindings: 0,
  highFindings: 0,
  mediumFindings: 12,
  categories: [
    { name: 'Security', total: 50, passed: 48, percentage: 96, status: 'passing' },
    { name: 'Availability', total: 42, passed: 39, percentage: 93, status: 'passing' },
    { name: 'Processing Integrity', total: 37, passed: 35, percentage: 95, status: 'passing' },
    { name: 'Confidentiality', total: 43, passed: 42, percentage: 98, status: 'passing' },
    { name: 'Privacy', total: 37, passed: 33, percentage: 89, status: 'warning' }
  ],
  findings: [
    { 
      id: 1, 
      severity: 'medium', 
      title: 'Enable MFA for 3 additional IAM users', 
      description: 'Multi-factor authentication should be enabled for all users',
      date: '2026-03-19',
      status: 'open'
    },
    { 
      id: 2, 
      severity: 'medium', 
      title: 'Rotate access keys older than 90 days', 
      description: '4 access keys have not been rotated in over 90 days',
      date: '2026-03-18',
      status: 'open'
    },
    { 
      id: 3, 
      severity: 'low', 
      title: 'Update security group descriptions', 
      description: '8 security groups are missing descriptions',
      date: '2026-03-17',
      status: 'resolved'
    }
  ]
};

export const mockAlertData = {
  alerts: [
    {
      id: 1,
      type: 'warning',
      title: 'Configuration drift detected',
      message: 'CloudFormation stack has drifted from expected state',
      timestamp: '2026-03-20T10:30:00Z',
      severity: 'medium',
      read: false
    },
    {
      id: 2,
      type: 'info',
      title: 'New compliance report available',
      message: 'Your monthly SOC 2 compliance report is ready',
      timestamp: '2026-03-19T15:00:00Z',
      severity: 'low',
      read: false
    },
    {
      id: 3,
      type: 'success',
      title: 'Security patch applied',
      message: 'All EC2 instances successfully patched',
      timestamp: '2026-03-18T09:00:00Z',
      severity: 'low',
      read: true
    }
  ]
};

export const mockEnvironmentData = [
  {
    id: 'env-prod',
    name: 'Production',
    region: 'us-east-1',
    status: 'active',
    resources: 47,
    complianceScore: 98,
    lastDeployed: '2 hours ago'
  },
  {
    id: 'env-staging',
    name: 'Staging',
    region: 'us-east-1',
    status: 'active',
    resources: 42,
    complianceScore: 95,
    lastDeployed: '1 day ago'
  },
  {
    id: 'env-dev',
    name: 'Development',
    region: 'us-west-2',
    status: 'active',
    resources: 38,
    complianceScore: 91,
    lastDeployed: '3 hours ago'
  }
];

// Texas DOB compliance mock data for fintech_pro / fintech_elite customers
export const mockTexasComplianceData = {
  customerId: 'demo-customer-fintech-pro',
  generatedAt: new Date().toISOString(),
  overallStatus: 'passing',
  totalControls: 5,
  passingControls: 5,
  controls: [
    {
      id: 'TX-MT-R1',
      name: 'Transaction Recordkeeping',
      regulationRef: '7 TAC §33.35; Fin. Code §151.307',
      status: 'passing',
      lastAssessedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: {
        transactionCount90d: 2847,
        complianceRate: 98.2,
        missingFields: 51,
        totalRecords: 2847
      },
      summary: '2,847 transactions collected (last 90 days). 100% have customer ID, timestamp, receipt number. 98.2% compliance rate.'
    },
    {
      id: 'TX-MT-R2a',
      name: 'Currency Transaction Reports (CTR)',
      regulationRef: '31 CFR §1022.310',
      status: 'passing',
      lastAssessedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: {
        ctrsFiledCount: 47,
        missingCtrs: 0,
        avgDaysToFile: 1.8,
        filedOnTime: 47
      },
      summary: '47 CTRs filed (last 90 days). 100% filed within regulatory deadline (15 days).'
    },
    {
      id: 'TX-MT-R2b',
      name: 'Suspicious Activity Reports (SAR)',
      regulationRef: '31 CFR §1022.320',
      status: 'passing',
      lastAssessedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: {
        sarsFiledCount: 3,
        openAlerts: 2,
        avgDaysToDisposition: 12.4,
        dispositionRate: 100
      },
      summary: '3 SARs filed. 2 open AML alerts under review. 100% filed within regulatory deadlines.'
    },
    {
      id: 'TX-MT-R3',
      name: 'Customer Identification Program (CIP)',
      regulationRef: '31 CFR §1022.210; 7 TAC §33.3',
      status: 'passing',
      lastAssessedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: {
        totalCustomers: 523,
        photoIdOnFile: 518,
        addressVerified: 511,
        photoIdRate: 99.1,
        addressRate: 97.8
      },
      summary: '523 customers verified. 99.1% have photo ID on file. 97.8% have address verification.'
    },
    {
      id: 'TX-MT-R4',
      name: 'Digital Asset Segregation',
      regulationRef: 'TX HB 1666; Fin. Code §152',
      status: 'passing',
      lastAssessedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: {
        totalWallets: 12,
        segregatedWallets: 12,
        totalValueUsd: 12300000,
        permissibleRate: 100
      },
      summary: '$12.3M in permissible investments across 12 wallets. 100% meet state segregation requirements.'
    }
  ],
  evidenceVault: {
    transactionDatabase: { controls: 2, status: 'passing', lastUpdated: new Date(Date.now() - 3600000).toISOString() },
    amlSystem: { controls: 2, status: 'passing', lastUpdated: new Date(Date.now() - 3600000).toISOString() },
    cipRecords: { controls: 1, status: 'passing', lastUpdated: new Date(Date.now() - 3600000).toISOString() }
  }
};

// Sample transactions for TX-MT-R1 display
export const mockFintechTransactions = {
  total: 2847,
  transactions: [
    {
      id: 'tx-001',
      timestamp: '2026-03-21T14:32:00Z',
      customer_name: 'Maria Rodriguez',
      amount: 450.00,
      payment_method: 'debit_card',
      transaction_type: 'remittance',
      status: 'completed',
      receipt_number: 'RCP-2026-032100145'
    },
    {
      id: 'tx-002',
      timestamp: '2026-03-21T13:15:00Z',
      customer_name: 'James Chen',
      amount: 12500.00,
      payment_method: 'wire_transfer',
      transaction_type: 'wire',
      status: 'completed',
      receipt_number: 'RCP-2026-032100132'
    },
    {
      id: 'tx-003',
      timestamp: '2026-03-21T11:48:00Z',
      customer_name: 'Sarah Johnson',
      amount: 200.00,
      payment_method: 'cash',
      transaction_type: 'money_order',
      status: 'completed',
      receipt_number: 'RCP-2026-032100118'
    },
    {
      id: 'tx-004',
      timestamp: '2026-03-21T10:22:00Z',
      customer_name: 'David Patel',
      amount: 875.50,
      payment_method: 'debit_card',
      transaction_type: 'remittance',
      status: 'completed',
      receipt_number: 'RCP-2026-032100107'
    },
    {
      id: 'tx-005',
      timestamp: '2026-03-21T09:05:00Z',
      customer_name: 'Ana Gutierrez',
      amount: 9900.00,
      payment_method: 'cash',
      transaction_type: 'cash',
      status: 'completed',
      receipt_number: 'RCP-2026-032100093'
    },
    {
      id: 'tx-006',
      timestamp: '2026-03-20T16:45:00Z',
      customer_name: 'Michael Brown',
      amount: 3200.00,
      payment_method: 'debit_card',
      transaction_type: 'remittance',
      status: 'completed',
      receipt_number: 'RCP-2026-032000289'
    },
    {
      id: 'tx-007',
      timestamp: '2026-03-20T15:30:00Z',
      customer_name: 'Lisa Thompson',
      amount: 15000.00,
      payment_method: 'wire_transfer',
      transaction_type: 'wire',
      status: 'completed',
      receipt_number: 'RCP-2026-032000275'
    },
    {
      id: 'tx-008',
      timestamp: '2026-03-20T14:12:00Z',
      customer_name: 'Carlos Mendez',
      amount: 550.25,
      payment_method: 'debit_card',
      transaction_type: 'remittance',
      status: 'completed',
      receipt_number: 'RCP-2026-032000263'
    }
  ]
};
