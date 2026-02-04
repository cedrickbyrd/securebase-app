/**
 * Mock Data for Demo Mode
 * Safe to commit - contains only fictional demo data
 * Aligned with DEMO_ENVIRONMENT.md specifications
 */

// Primary customer for single-customer views
export const mockCustomer = {
  id: "demo-customer-001",
  name: "HealthCorp Medical Systems",
  email: "admin@healthcorp.example.com",
  tier: "healthcare",
  framework: "hipaa",
  status: "active",
  monthly_price: 15000,
  accounts: 45,
  created_at: "2025-11-01T00:00:00Z",
  subscription_status: "active"
};

// All 5 demo customers (for multi-customer admin views)
export const mockCustomers = [
  {
    id: "demo-customer-001",
    name: "HealthCorp Medical Systems",
    email: "admin@healthcorp.example.com",
    tier: "healthcare",
    framework: "HIPAA",
    status: "active",
    monthly_price: 15000,
    accounts: 45,
    created_at: "2025-11-01T00:00:00Z"
  },
  {
    id: "demo-customer-002",
    name: "FinTechAI Analytics",
    email: "admin@fintechai.example.com",
    tier: "fintech",
    framework: "SOC 2 Type II",
    status: "active",
    monthly_price: 8000,
    accounts: 28,
    created_at: "2025-12-01T00:00:00Z"
  },
  {
    id: "demo-customer-003",
    name: "StartupMVP Inc",
    email: "admin@startupmvp.example.com",
    tier: "standard",
    framework: "CIS Foundations",
    status: "active",
    monthly_price: 2000,
    accounts: 5,
    created_at: "2026-01-01T00:00:00Z"
  },
  {
    id: "demo-customer-004",
    name: "GovContractor Defense Solutions",
    email: "admin@govcontractor.example.com",
    tier: "government",
    framework: "FedRAMP Low",
    status: "active",
    monthly_price: 25000,
    accounts: 120,
    created_at: "2025-10-01T00:00:00Z"
  },
  {
    id: "demo-customer-005",
    name: "SaaSPlatform Cloud Services",
    email: "admin@saasplatform.example.com",
    tier: "fintech",
    framework: "SOC 2 Type II",
    status: "active",
    monthly_price: 8000,
    accounts: 35,
    created_at: "2025-11-01T00:00:00Z"
  }
];

// Generate 30+ invoices across all 5 customers over 6 months
const generateInvoices = () => {
  const invoices = [];
  const customers = [
    { id: "demo-customer-001", name: "HealthCorp Medical Systems", amount: 15000 },
    { id: "demo-customer-002", name: "FinTechAI Analytics", amount: 8000 },
    { id: "demo-customer-003", name: "StartupMVP Inc", amount: 2000 },
    { id: "demo-customer-004", name: "GovContractor Defense Solutions", amount: 25000 },
    { id: "demo-customer-005", name: "SaaSPlatform Cloud Services", amount: 8000 }
  ];
  
  const months = [
    { year: 2026, month: 2, name: "February", days: 28 },
    { year: 2026, month: 1, name: "January", days: 31 },
    { year: 2025, month: 12, name: "December", days: 31 },
    { year: 2025, month: 11, name: "November", days: 30 },
    { year: 2025, month: 10, name: "October", days: 31 },
    { year: 2025, month: 9, name: "September", days: 30 }
  ];
  
  const statuses = ["paid", "paid", "paid", "paid", "issued", "overdue", "draft"];
  
  // Small dollar variance added to each invoice to make amounts more realistic
  const INVOICE_VARIANCE = 10;
  
  let invoiceCounter = 1;
  
  months.forEach(({ year, month, name: monthName, days }) => {
    customers.forEach((customer, custIdx) => {
      const status = statuses[invoiceCounter % statuses.length];
      const dueDay = 15 + (invoiceCounter % 15);
      const dueMonth = month === 12 ? 1 : month + 1;
      const dueYear = month === 12 ? year + 1 : year;
      
      // Calculate paid date ensuring it doesn't exceed days in the month
      const paidDay = Math.min(28 - (custIdx * 2), days);
      
      invoices.push({
        id: `inv_${year}_${String(month).padStart(2, '0')}_${customer.id}`,
        invoice_number: `INV-${year}-${String(invoiceCounter).padStart(4, '0')}`,
        customer_id: customer.id,
        customer_name: customer.name,
        month: `${monthName} ${year}`,
        total_amount: customer.amount + (invoiceCounter * INVOICE_VARIANCE),
        status: status,
        due_date: `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`,
        paid_date: status === "paid" ? `${year}-${String(month).padStart(2, '0')}-${String(paidDay).padStart(2, '0')}` : null,
        created_at: `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`,
        billing_period_start: `${year}-${String(month).padStart(2, '0')}-01`,
        billing_period_end: `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
        line_items: [
          { 
            description: "Base Platform Fee", 
            amount: Math.floor(customer.amount * 0.8), 
            quantity: 1,
            unit_price: Math.floor(customer.amount * 0.8)
          },
          { 
            description: "Support & Maintenance", 
            amount: Math.floor(customer.amount * 0.2), 
            quantity: 1,
            unit_price: Math.floor(customer.amount * 0.2)
          }
        ],
        pdf_url: "#",
        currency: "USD"
      });
      
      invoiceCounter++;
    });
  });
  
  return invoices;
};

export const mockInvoices = generateInvoices();

export const mockMetrics = {
  // Total across all 5 customers: $15k + $8k + $2k + $25k + $8k = $58k
  monthly_cost: 58240,
  cost_trend: "+2.3%",
  cost_change: 1312,
  compliance_score: 92,
  compliance_trend: "+1",
  active_alerts: 3,
  alerts_trend: "-2",
  uptime_percentage: 99.87,
  uptime_trend: "+0.02%",
  api_calls_month: 3450000,
  api_calls_trend: "+15.2%",
  api_calls_limit: 10000000,
  // Dashboard usage metrics - combined across all customers
  total_customers: 5,
  account_count: 233,  // 45 + 28 + 5 + 120 + 35
  cloudtrail_events: 8245678,
  log_storage_gb: 1256.7,
  data_transfer_gb: 589.3,
  cost_breakdown: {
    compliance: 46400,    // Base platform fees
    support: 11600,       // Support fees
    infrastructure: 240   // Pass-through costs
  },
  cost_history: [
    { month: "Sep", cost: 56980, date: "2025-09-01" },
    { month: "Oct", cost: 57210, date: "2025-10-01" },
    { month: "Nov", cost: 57540, date: "2025-11-01" },
    { month: "Dec", cost: 57820, date: "2025-12-01" },
    { month: "Jan", cost: 58000, date: "2026-01-01" },
    { month: "Feb", cost: 58240, date: "2026-02-01" }
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
    scopes: ["read", "write"],
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
    scopes: ["read"],
    usage_count: 12345,
    environment: "testing"
  }
];

export const mockCompliance = {
  status: "passing",
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

// Mock team/user data for Team Management (Phase 4)
export const mockTeamUsers = [
  {
    id: "user_001",
    name: "Demo Admin",
    email: "admin@healthcorp.example.com",
    role: "admin",
    status: "active",
    created_at: "2025-11-01T00:00:00Z",
    last_login: "2026-02-04T08:30:00Z",
    permissions: ["read", "write", "admin"]
  },
  {
    id: "user_002",
    name: "Demo Manager",
    email: "manager@healthcorp.example.com",
    role: "manager",
    status: "active",
    created_at: "2025-12-15T00:00:00Z",
    last_login: "2026-02-03T14:22:00Z",
    permissions: ["read", "write"]
  },
  {
    id: "user_003",
    name: "Demo Viewer",
    email: "viewer@healthcorp.example.com",
    role: "viewer",
    status: "active",
    created_at: "2026-01-10T00:00:00Z",
    last_login: "2026-02-02T10:15:00Z",
    permissions: ["read"]
  }
];

export const mockRoles = [
  {
    id: "role_admin",
    name: "Administrator",
    description: "Full access to all features",
    permissions: ["read", "write", "admin", "delete"]
  },
  {
    id: "role_manager",
    name: "Manager",
    description: "Can manage users and view reports",
    permissions: ["read", "write", "manage_users"]
  },
  {
    id: "role_viewer",
    name: "Viewer",
    description: "Read-only access",
    permissions: ["read"]
  }
];
