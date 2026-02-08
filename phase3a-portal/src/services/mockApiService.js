// Mock API Service that returns data without making network calls
const mockData = {
  metrics: {
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
      total_amount: 1250.00, 
      status: 'paid', 
      created_at: '2026-01-15',
      due_date: '2026-02-15',
      period_start: '2026-01-01',
      period_end: '2026-01-31'
    },
    { 
      id: 'inv_002', 
      invoice_number: 'INV-2026-002',
      total_amount: 890.50, 
      status: 'pending', 
      created_at: '2026-02-01',
      due_date: '2026-03-01',
      period_start: '2026-02-01',
      period_end: '2026-02-28'
    }
  ],
  apiKeys: [
    {
      id: 'key_001',
      name: 'Production API Key',
      key: 'sk_live_demo_***',
      created_at: '2026-01-10',
      last_used: '2026-02-05',
      status: 'active'
    }
  ],
  compliance: {
    status: 'Compliant',
    overall_status: 'passing',
    pciCompliant: true,
    soc2Certified: true,
    gdprCompliant: true,
    hipaaCompliant: true,
    last_assessment: '2026-02-01',
    frameworks: [
      { id: 'hipaa', name: 'HIPAA', status: 'passing', controls_passed: 45, controls_total: 45 },
      { id: 'soc2', name: 'SOC 2 Type II', status: 'passing', controls_passed: 67, controls_total: 67 },
      { id: 'pci', name: 'PCI DSS', status: 'passing', controls_passed: 35, controls_total: 35 },
      { id: 'gdpr', name: 'GDPR', status: 'passing', controls_passed: 28, controls_total: 28 }
    ]
  },
  complianceFindings: [
    {
      id: 'finding_001',
      framework: 'HIPAA',
      severity: 'low',
      control_id: 'HIPAA-164.312(a)(1)',
      title: 'Access Control Review',
      description: 'Periodic review of access controls recommended',
      status: 'acknowledged',
      created_at: '2026-01-15'
    }
  ],
  tickets: [
    { 
      id: 'tick_001', 
      subject: 'API Rate Limit Question', 
      status: 'open', 
      created_at: '2026-02-05',
      priority: 'medium',
      description: 'Need clarification on rate limits for production tier'
    },
    { 
      id: 'tick_002', 
      subject: 'Billing Question', 
      status: 'closed', 
      created_at: '2026-01-20',
      priority: 'low',
      description: 'Question about invoice details'
    }
  ]
};

class MockApiService {
  async delay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getMetrics() {
    await this.delay();
    return { data: mockData.metrics };
  }

  async getInvoices() {
    await this.delay();
    return { data: mockData.invoices };
  }

  async getApiKeys() {
    await this.delay();
    return { data: mockData.apiKeys };
  }

  async getComplianceStatus() {
    await this.delay();
    return { data: mockData.compliance };
  }

  async getComplianceFindings() {
    await this.delay();
    return { data: mockData.complianceFindings };
  }

  async downloadComplianceReport() {
    await this.delay();
    // Simulate downloading a PDF report
    console.log('📄 Mock: Compliance report download initiated');
    const blob = new Blob(['Mock Compliance Report - SecureBase\n\nAll frameworks: PASSING'], 
      { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    return { data: { success: true, message: 'Report downloaded' } };
  }

  async getTickets(params = {}) {
    await this.delay();
    let tickets = mockData.tickets;
    
    // Filter by status if provided
    if (params.status) {
      tickets = tickets.filter(t => t.status === params.status);
    }
    
    return { data: tickets };
  }

  async getSupportTickets(params = {}) {
    return this.getTickets(params);
  }

  async createTicket(ticketData) {
    await this.delay();
    return { data: { id: 'tick_new', ...ticketData, status: 'open', created_at: new Date().toISOString() } };
  }

  async authenticate(apiKey) {
    await this.delay();
    if (apiKey.startsWith('sb_')) {
      return { token: 'mock-token', user: { id: 'user-1', name: 'Demo User' } };
    }
    throw new Error('Invalid API key');
  }

  async getDashboardData() {
    await this.delay();
    return { data: mockData };
  }

  async getUserProfile() {
    await this.delay();
    return { data: { id: 'user-1', name: 'Demo User', email: 'demo@securebase.io' } };
  }
}

export const mockApiService = new MockApiService();
export default mockApiService;
