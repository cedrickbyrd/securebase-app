// Mock API Service that returns data without making network calls
const mockData = {
  metrics: {
    monthlyCharge: 1250.00,
    totalRevenue: 45678.90,
    activeCustomers: 12,
    openTickets: 3,
    apiCallsToday: 1543,
    account_count: 5,
    cloudtrail_events: 125847,
    log_storage_gb: 245,
    data_transfer_gb: 89
  },
  invoices: [
    { 
      id: 'inv_001', 
      invoice_number: 'INV-2026-001',
      amount: 1250.00,
      total_amount: 1250.00, 
      status: 'paid', 
      date: '2026-01-14T12:00:00Z',
      created_at: '2026-01-15',
      due_date: '2026-02-15',
      period_start: '2026-01-01',
      period_end: '2026-01-31'
    },
    { 
      id: 'inv_002', 
      invoice_number: 'INV-2026-002',
      amount: 890.50,
      total_amount: 890.50, 
      status: 'pending', 
      date: '2026-02-01T12:00:00Z',
      created_at: '2026-02-01',
      due_date: '2026-03-01',
      period_start: '2026-02-01',
      period_end: '2026-02-28'
    },
    { 
      id: 'inv_003', 
      invoice_number: 'INV-2025-012',
      amount: 1100.00,
      total_amount: 1100.00, 
      status: 'paid', 
      date: '2025-12-14T12:00:00Z',
      created_at: '2025-12-15',
      due_date: '2026-01-15',
      period_start: '2025-12-01',
      period_end: '2025-12-31'
    }
  ],
  apiKeys: [
    { 
      id: 'key_001', 
      name: 'Production API Key',
      key_preview: 'sb_prod_***************xyz',
      status: 'active',
      created_at: '2025-11-01T10:30:00Z',
      last_used: '2026-02-07T14:22:00Z',
      permissions: ['read', 'write']
    },
    { 
      id: 'key_002', 
      name: 'Development Key',
      key_preview: 'sb_dev_***************abc',
      status: 'active',
      created_at: '2025-12-15T09:15:00Z',
      last_used: '2026-02-06T11:45:00Z',
      permissions: ['read']
    },
    { 
      id: 'key_003', 
      name: 'Legacy Key',
      key_preview: 'sb_prod_***************old',
      status: 'inactive',
      created_at: '2025-06-01T08:00:00Z',
      last_used: '2025-10-30T16:00:00Z',
      permissions: ['read', 'write']
    }
  ],
  compliance: {
    status: 'passing',
    overall_status: 'passing',
    last_assessment: '2026-01-31T00:00:00Z',
    passing: 4,
    warning: 0,
    failing: 0,
    frameworks: [
      {
        id: 'soc2',
        name: 'SOC 2 Type II',
        status: 'passing',
        last_check: '2026-01-31T00:00:00Z',
        score: 98
      },
      {
        id: 'hipaa',
        name: 'HIPAA',
        status: 'passing',
        last_check: '2026-01-31T00:00:00Z',
        score: 95
      },
      {
        id: 'pci',
        name: 'PCI DSS',
        status: 'passing',
        last_check: '2026-01-31T00:00:00Z',
        score: 92
      },
      {
        id: 'gdpr',
        name: 'GDPR',
        status: 'passing',
        last_check: '2026-01-31T00:00:00Z',
        score: 97
      }
    ]
  },
  tickets: [
    {
      id: 'ticket_001',
      title: 'CloudTrail not enabled in us-west-2',
      status: 'open',
      priority: 'high',
      created_at: '2026-02-05T10:30:00Z',
      updated_at: '2026-02-07T14:22:00Z'
    },
    {
      id: 'ticket_002',
      title: 'Setup new IAM role for analytics',
      status: 'in_progress',
      priority: 'medium',
      created_at: '2026-02-01T09:15:00Z',
      updated_at: '2026-02-06T11:45:00Z'
    }
  ],
  notifications: [
    {
      id: 'notif_001',
      type: 'security',
      severity: 'warning',
      title: 'CloudTrail Disabled',
      message: 'CloudTrail logging was disabled in us-west-2 region',
      timestamp: '2026-02-08T14:30:00Z',
      read: false,
      actionUrl: '/compliance',
      actionText: 'View Details'
    },
    {
      id: 'notif_002',
      type: 'billing',
      severity: 'info',
      title: 'Invoice Generated',
      message: 'Your February invoice is ready for $1,250.00',
      timestamp: '2026-02-01T09:00:00Z',
      read: false,
      actionUrl: '/invoices',
      actionText: 'View Invoice'
    },
    {
      id: 'notif_003',
      type: 'compliance',
      severity: 'success',
      title: 'SOC 2 Assessment Complete',
      message: 'Your SOC 2 Type II assessment passed with 98% score',
      timestamp: '2026-01-31T16:00:00Z',
      read: true,
      actionUrl: '/compliance',
      actionText: 'View Report'
    },
    {
      id: 'notif_004',
      type: 'system',
      severity: 'info',
      title: 'Scheduled Maintenance',
      message: 'System maintenance scheduled for Feb 15, 2026 at 2:00 AM UTC',
      timestamp: '2026-01-28T10:00:00Z',
      read: true,
      actionUrl: null,
      actionText: null
    },
    {
      id: 'notif_005',
      type: 'security',
      severity: 'error',
      title: 'Failed Login Attempts',
      message: '5 failed login attempts detected from IP 192.168.1.100',
      timestamp: '2026-02-07T22:15:00Z',
      read: false,
      actionUrl: '/settings/security',
      actionText: 'Review Activity'
    }
  ]
};

export const mockApiService = {
  // Authentication
  login: (credentials) => {
    if (credentials.username === 'demo' && credentials.password === 'demo') {
      return Promise.resolve({
        user: { username: 'demo', email: 'demo@securebase.com' },
        token: 'demo-token-12345'
      });
    }
    return Promise.reject(new Error('Invalid credentials'));
  },

  // Metrics
  getMetrics: () => {
    return Promise.resolve(mockData.metrics);
  },

  // Invoices
  getInvoices: () => {
    return Promise.resolve(mockData.invoices);
  },

  // API Keys
  getApiKeys: () => {
    return Promise.resolve(mockData.apiKeys);
  },

  // Compliance
  getComplianceStatus: () => {
    return Promise.resolve(mockData.compliance);
  },

  getComplianceFindings: () => {
    return Promise.resolve([]);
  },

  downloadComplianceReport: () => {
    return Promise.resolve({ message: 'Demo mode: Report download not available' });
  },

  // Support Tickets
  getTickets: () => {
    return Promise.resolve(mockData.tickets);
  },

  // Notifications
  getNotifications: () => {
    return Promise.resolve(mockData.notifications);
  },

  markNotificationAsRead: (id) => {
    const notification = mockData.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
    return Promise.resolve({ success: true, id });
  },

  markAllNotificationsAsRead: () => {
    mockData.notifications.forEach(n => {
      n.read = true;
    });
    return Promise.resolve({ success: true });
  }
};

