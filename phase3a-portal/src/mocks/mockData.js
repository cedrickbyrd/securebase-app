/**
 * Mock Data for Demo Mode
 * Safe to commit - contains only fictional demo data
 */

export const mockCustomer = {
  id: "demo-customer-001",
  name: "Demo Healthcare Corp",
  email: "demo@securebase.io",
  tier: "healthcare",
  framework: "hipaa",
  status: "trial",
  trial_ends: "2026-03-15",
  created_at: "2026-01-01T00:00:00Z",
  subscription_status: "active"
};

export const mockInvoices = [
  {
    id: "inv_2026_02",
    invoice_number: "INV-2026-0002",
    month: "February 2026",
    total_amount: 15000,
    status: "paid",
    due_date: "2026-03-01",
    paid_date: "2026-02-28",
    created_at: "2026-02-01T00:00:00Z",
    billing_period_start: "2026-02-01",
    billing_period_end: "2026-02-28",
    line_items: [
      { 
        description: "HIPAA Compliance Platform", 
        amount: 12000, 
        quantity: 1,
        unit_price: 12000
      },
      { 
        description: "Priority Support", 
        amount: 3000, 
        quantity: 1,
        unit_price: 3000
      }
    ],
    pdf_url: "#",
    currency: "USD"
  },
  {
    id: "inv_2026_01",
    invoice_number: "INV-2026-0001",
    month: "January 2026",
    total_amount: 15000,
    status: "paid",
    due_date: "2026-02-01",
    paid_date: "2026-01-30",
    created_at: "2026-01-01T00:00:00Z",
    billing_period_start: "2026-01-01",
    billing_period_end: "2026-01-31",
    line_items: [
      { 
        description: "HIPAA Compliance Platform", 
        amount: 12000, 
        quantity: 1,
        unit_price: 12000
      },
      { 
        description: "Priority Support", 
        amount: 3000, 
        quantity: 1,
        unit_price: 3000
      }
    ],
    pdf_url: "#",
    currency: "USD"
  },
  {
    id: "inv_2025_12",
    invoice_number: "INV-2025-0012",
    month: "December 2025",
    total_amount: 14892,
    status: "paid",
    due_date: "2026-01-01",
    paid_date: "2025-12-28",
    created_at: "2025-12-01T00:00:00Z",
    billing_period_start: "2025-12-01",
    billing_period_end: "2025-12-31",
    line_items: [
      { 
        description: "HIPAA Compliance Platform", 
        amount: 12000, 
        quantity: 1,
        unit_price: 12000
      },
      { 
        description: "Priority Support", 
        amount: 2892, 
        quantity: 1,
        unit_price: 2892
      }
    ],
    pdf_url: "#",
    currency: "USD"
  }
];

export const mockMetrics = {
  monthly_cost: 15234,
  cost_trend: "+2.3%",
  cost_change: 342,
  compliance_score: 98,
  compliance_trend: "+1",
  active_alerts: 2,
  alerts_trend: "-3",
  uptime_percentage: 99.97,
  uptime_trend: "+0.02%",
  api_calls_month: 1245678,
  api_calls_trend: "+15.2%",
  api_calls_limit: 5000000,
  cost_breakdown: {
    compliance: 12000,
    support: 3000,
    infrastructure: 234
  },
  cost_history: [
    { month: "Sep", cost: 14234, date: "2025-09-01" },
    { month: "Oct", cost: 14567, date: "2025-10-01" },
    { month: "Nov", cost: 14789, date: "2025-11-01" },
    { month: "Dec", cost: 14892, date: "2025-12-01" },
    { month: "Jan", cost: 15000, date: "2026-01-01" },
    { month: "Feb", cost: 15234, date: "2026-02-01" }
  ],
  resource_usage: {
    compute: 67,
    storage: 45,
    network: 82
  }
};

export const mockApiKeys = [
  {
    id: "sk_demo_prod_abc123",
    name: "Production API Key",
    created: "2026-01-15T10:30:00Z",
    created_at: "2026-01-15T10:30:00Z",
    last_used: "2026-02-03T14:22:00Z",
    status: "active",
    masked_key: "sk_demo_***...***abc123",
    key_prefix: "sk_demo_prod",
    permissions: ["read", "write"],
    usage_count: 45678,
    environment: "production"
  },
  {
    id: "sk_demo_test_xyz789",
    name: "Testing API Key",
    created: "2026-01-20T08:15:00Z",
    created_at: "2026-01-20T08:15:00Z",
    last_used: "2026-02-01T16:45:00Z",
    status: "active",
    masked_key: "sk_demo_***...***xyz789",
    key_prefix: "sk_demo_test",
    permissions: ["read"],
    usage_count: 12345,
    environment: "testing"
  }
];

export const mockCompliance = {
  score: 98,
  frameworks: [
    {
      id: "framework_hipaa",
      name: "HIPAA",
      description: "Health Insurance Portability and Accountability Act",
      status: "passing",
      passing_controls: 45,
      total_controls: 45
    },
    {
      id: "framework_cis",
      name: "CIS AWS Foundations",
      description: "Center for Internet Security AWS Foundations Benchmark",
      status: "passing",
      passing_controls: 38,
      total_controls: 39
    },
    {
      id: "framework_pci",
      name: "PCI-DSS",
      description: "Payment Card Industry Data Security Standard",
      status: "warning",
      passing_controls: 32,
      total_controls: 35
    }
  ],
  last_scan: "2026-02-03T10:30:00Z",
  next_scan: "2026-02-04T10:30:00Z",
  findings: {
    critical: 0,
    high: 0,
    medium: 2,
    low: 5,
    info: 12
  },
  alerts: [
    {
      id: "alert_001",
      severity: "medium",
      title: "S3 Bucket Encryption Review",
      description: "2 buckets require encryption validation",
      date: "2026-01-28T09:15:00Z",
      resource: "s3://demo-bucket-1",
      resource_type: "AWS::S3::Bucket",
      recommendation: "Enable AES-256 encryption",
      status: "open",
      framework_control: "HIPAA 164.312(a)(2)(iv)"
    },
    {
      id: "alert_002",
      severity: "low",
      title: "IAM Policy Update Available",
      description: "New CIS benchmark version released",
      date: "2026-01-25T11:22:00Z",
      resource: "IAM Policy: AdminAccess",
      resource_type: "AWS::IAM::Policy",
      recommendation: "Review and update to CIS 1.5.0",
      status: "open",
      framework_control: "CIS AWS 1.16"
    }
  ],
  controls: [
    { 
      id: "ctrl_001",
      name: "Data Encryption", 
      status: "passing", 
      coverage: "100%",
      description: "All data at rest and in transit is encrypted",
      last_check: "2026-02-03T10:30:00Z"
    },
    { 
      id: "ctrl_002",
      name: "Access Control", 
      status: "passing", 
      coverage: "98%",
      description: "IAM policies and MFA enforcement",
      last_check: "2026-02-03T10:30:00Z"
    },
    { 
      id: "ctrl_003",
      name: "Audit Logging", 
      status: "warning", 
      coverage: "95%",
      description: "CloudTrail and application logging",
      last_check: "2026-02-03T10:30:00Z"
    },
    { 
      id: "ctrl_004",
      name: "Network Security", 
      status: "passing", 
      coverage: "100%",
      description: "VPC isolation, security groups, NACLs",
      last_check: "2026-02-03T10:30:00Z"
    }
  ],
  trends: {
    score_history: [
      { date: "2026-01-01", score: 95 },
      { date: "2026-01-15", score: 96 },
      { date: "2026-02-01", score: 97 },
      { date: "2026-02-03", score: 98 }
    ]
  }
};

export const mockSupportTickets = [
  {
    id: "ticket_001",
    subject: "AWS Account Access Issue",
    status: "open",
    priority: "high",
    created_at: "2026-02-02T14:30:00Z",
    updated_at: "2026-02-03T10:15:00Z",
    customer_id: "demo-customer-001",
    description: "Unable to access newly provisioned AWS account",
    assigned_to: "Support Agent - Demo",
    comments: [
      {
        id: "comment_001",
        author: "demo@securebase.io",
        text: "We can't seem to access the account that was just created.",
        created_at: "2026-02-02T14:30:00Z"
      },
      {
        id: "comment_002",
        author: "support@securebase.io",
        text: "Thanks for reaching out. We're looking into this now.",
        created_at: "2026-02-02T15:45:00Z"
      }
    ]
  },
  {
    id: "ticket_002",
    subject: "Billing Question",
    status: "resolved",
    priority: "low",
    created_at: "2026-01-28T09:00:00Z",
    updated_at: "2026-01-29T16:30:00Z",
    resolved_at: "2026-01-29T16:30:00Z",
    customer_id: "demo-customer-001",
    description: "Question about invoice line items",
    assigned_to: "Billing Team - Demo",
    comments: [
      {
        id: "comment_003",
        author: "demo@securebase.io",
        text: "Can you explain the infrastructure costs on my last invoice?",
        created_at: "2026-01-28T09:00:00Z"
      },
      {
        id: "comment_004",
        author: "billing@securebase.io",
        text: "Those are AWS pass-through costs for your dedicated resources.",
        created_at: "2026-01-29T16:30:00Z"
      }
    ]
  }
];

export const mockNotifications = [
  {
    id: "notif_001",
    type: "alert",
    severity: "medium",
    title: "Compliance Alert: S3 Bucket Encryption",
    message: "2 S3 buckets require encryption validation",
    read: false,
    created_at: "2026-02-03T09:30:00Z",
    link: "/compliance"
  },
  {
    id: "notif_002",
    type: "info",
    severity: "low",
    title: "Monthly Invoice Available",
    message: "Your February 2026 invoice is ready for review",
    read: false,
    created_at: "2026-02-01T08:00:00Z",
    link: "/invoices"
  },
  {
    id: "notif_003",
    type: "success",
    severity: "info",
    title: "Compliance Scan Complete",
    message: "Your compliance score improved to 98%",
    read: true,
    created_at: "2026-01-30T10:30:00Z",
    link: "/compliance"
  }
];

export const mockCostForecast = {
  forecast_period: "90 days",
  generated_at: "2026-02-03T10:00:00Z",
  current_monthly_cost: 15234,
  forecasted_costs: [
    { month: "Feb 2026", cost: 15234, confidence: "high" },
    { month: "Mar 2026", cost: 15678, confidence: "high" },
    { month: "Apr 2026", cost: 16012, confidence: "medium" },
    { month: "May 2026", cost: 16345, confidence: "medium" }
  ],
  recommendations: [
    {
      id: "rec_001",
      title: "Right-size EC2 Instances",
      potential_savings: 450,
      effort: "low",
      impact: "medium"
    },
    {
      id: "rec_002",
      title: "Enable S3 Intelligent Tiering",
      potential_savings: 230,
      effort: "low",
      impact: "low"
    }
  ],
  trends: {
    growth_rate: 2.8,
    seasonal_variance: 5.2
  }
};

export const mockWebhooks = [
  {
    id: "webhook_001",
    url: "https://demo.example.com/webhooks/securebase",
    events: ["invoice.created", "compliance.alert"],
    status: "active",
    created_at: "2026-01-15T10:00:00Z",
    last_triggered: "2026-02-01T08:00:00Z",
    success_rate: 99.8
  }
];
