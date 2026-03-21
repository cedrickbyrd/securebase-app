// Demo data utilities for demo mode

export const isDemoMode = () => {
  return localStorage.getItem('demo_mode') === 'true';
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
      status: 'open'
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
