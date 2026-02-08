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
    overall_status: 'passing',
    last_assessment: '2026-01-31T00:00:00Z',
    passing: 4,
    warning: 0,
    failing: 0,
    frameworks: [
      {
        id: 'hipaa',
        name: 'HIPAA',
        status: 'passing',
        controls_passing: 45,
        controls_total: 45,
        last_scan: '2026-01-31'
      },
      {
        id: 'soc2',
        name: 'SOC 2 Type II',
        status: 'passing',
        controls_passing: 64,
        controls_total: 64,
        last_scan: '2026-01-31'
      },
      {
        id: 'pci',
        name: 'PCI DSS',
        status: 'passing',
        controls_passing: 35,
        controls_total: 35,
        last_scan: '2026-01-30'
      },
      {
        id: 'gdpr',
        name: 'GDPR',
        status: 'passing',
        controls_passing: 28,
        controls_total: 28,
        last_scan: '2026-01-31'
      }
    ]
  },
  tickets: [
    {
      id: 'ticket_001',
      subject: 'API rate limit increase request',
      status: 'open',
      priority: 'medium',
      created_at: '2026-02-05T14:30:00Z',
      updated_at: '2026-02-07T09:15:00Z',
      assignee: 'Support Team'
    },
    {
      id: 'ticket_002',
      subject: 'Compliance report download issue',
      status: 'open',
      priority: 'high',
      created_at: '2026-02-06T11:20:00Z',
      updated_at: '2026-02-07T10:45:00Z',
      assignee: 'Engineering Team'
    },
    {
      id: 'ticket_003',
      subject: 'Question about invoice charges',
      status: 'open',
      priority: 'low',
      created_at: '2026-02-07T08:00:00Z',
      updated_at: '2026-02-07T08:00:00Z',
      assignee: 'Billing Team'
    },
    {
      id: 'ticket_004',
      subject: 'API authentication error',
      status: 'closed',
      priority: 'high',
      created_at: '2026-02-01T16:45:00Z',
      updated_at: '2026-02-03T14:30:00Z',
      assignee: 'Support Team',
      resolved_at: '2026-02-03T14:30:00Z'
    }
  ],
  userProfile: {
    id: 'user_demo',
    name: 'Demo User',
    email: 'demo@securebase.io',
    company: 'Demo Healthcare Inc.',
    role: 'Administrator',
    tier: 'Healthcare',
    joined: '2025-11-01'
  }
};

class MockApiService {
  // Helper method to simulate network delay
  delay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async authenticate(apiKey) {
    await this.delay(300);
    
    if (apiKey === 'demo') {
      return {
        success: true,
        token: 'demo-session-token-' + Date.now(),
        session_token: 'demo-session-token-' + Date.now(),
        user: mockData.userProfile
      };
    }
    
    if (apiKey.startsWith('sb_')) {
      return {
        success: true,
        token: 'mock-session-token-' + Date.now(),
        session_token: 'mock-session-token-' + Date.now(),
        user: mockData.userProfile
      };
    }
    
    throw new Error('Invalid API key');
  }

  async getMetrics() {
    await this.delay();
    return mockData.metrics;
  }

  async getDashboardData() {
    await this.delay(400);
    return {
      metrics: mockData.metrics,
      recentActivity: [],
      alerts: []
    };
  }

  async getUserProfile() {
    await this.delay(150);
    return mockData.userProfile;
  }

  async getInvoices() {
    await this.delay();
    return mockData.invoices;
  }

  async getApiKeys() {
    await this.delay();
    return mockData.apiKeys;
  }

  async getComplianceStatus() {
    await this.delay();
    return mockData.compliance;
  }

  async getComplianceFindings() {
    await this.delay(350);
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      findings: []
    };
  }

  async downloadComplianceReport() {
    await this.delay(500);
    const blob = new Blob(['Mock Compliance Report PDF Content'], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Report downloaded' };
  }

  async getTickets(params = {}) {
    await this.delay();
    let tickets = [...mockData.tickets];
    
    if (params.status) {
      tickets = tickets.filter(t => t.status === params.status);
    }
    
    if (params.limit) {
      tickets = tickets.slice(0, params.limit);
    }
    
    return tickets;
  }

  async getSupportTickets(params = {}) {
    return this.getTickets(params);
  }

  async createTicket(ticketData) {
    await this.delay(400);
    const newTicket = {
      id: 'ticket_' + Date.now(),
      ...ticketData,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return newTicket;
  }
}

export const mockApiService = new MockApiService();
export default mockApiService;
