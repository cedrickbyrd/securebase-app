console.log('🎭 MOCK API LOADED!');
(function(){
  if(!window.location.hostname.includes('demo')&&!window.location.hostname.includes('s3-website')){
    console.log('Not demo mode');
    return;
  }
  
  console.log('✅ Installing mock fetch and Axios interceptor');
  
  // Mock data
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
    complianceFindings: [],
    tickets: [
      { 
        id: 'tick_001', 
        subject: 'API Rate Limit Question', 
        status: 'open', 
        created_at: '2026-02-05',
        priority: 'medium',
        description: 'Need clarification on rate limits for production tier'
      }
    ],
    customers: []
  };
  
  // Intercept Fetch
  window._originalFetch = window.fetch;
  window.fetch = function(url, opts) {
    const u = String(url);
    if(u.includes('.js')||u.includes('.css')||u.includes('.svg')||u.includes('s3-website')||u.includes('amazonaws')){
      return window._originalFetch(url, opts);
    }
    console.log('🎭 Fetch intercepted:', u);
    console.log('  📦 Returning mock data');
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({'content-type':'application/json'}),
      json: () => Promise.resolve({ data: getMockDataForUrl(u) }),
      text: () => Promise.resolve(JSON.stringify({ data: getMockDataForUrl(u) }))
    });
  };
  
  // Intercept Axios (XMLHttpRequest)
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, ...args) {
      this._url = url;
      this._method = method;
      return originalOpen.apply(this, [method, url, ...args]);
    };
    
    xhr.send = function(...args) {
      const url = this._url || '';
      if(url.includes('securebase') || url.includes('api.')) {
        console.log('🎭 XHR intercepted:', this._method, url);
        console.log('  🚫 Will mock this request');
        
        setTimeout(() => {
          const mockResponse = { data: getMockDataForUrl(url) };
          console.log('  📦 Returning mock data:', mockResponse);
          
          Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
          Object.defineProperty(this, 'status', { writable: true, value: 200 });
          Object.defineProperty(this, 'responseText', { writable: true, value: JSON.stringify(mockResponse) });
          Object.defineProperty(this, 'response', { writable: true, value: JSON.stringify(mockResponse) });
          
          if(this.onreadystatechange) this.onreadystatechange();
          if(this.onload) this.onload();
        }, 100);
        return;
      }
      return originalSend.apply(this, args);
    };
    
    return xhr;
  };
  
  function getMockDataForUrl(url) {
    // Handle more specific routes first
    if(url.includes('/metrics')) return mockData.metrics;
    if(url.includes('/invoices')) return mockData.invoices;
    if(url.includes('/api-keys')) return mockData.apiKeys;
    if(url.includes('/compliance/status')) return mockData.compliance;
    if(url.includes('/compliance/findings')) return mockData.complianceFindings;
    if(url.includes('/compliance')) return mockData.compliance;
    if(url.includes('/tickets') || url.includes('/support/tickets')) return mockData.tickets;
    if(url.includes('/customers')) return mockData.customers;
    
    console.warn('🎭 No mock data for URL:', url);
    return {};
  }
  
  console.log('✅ MOCK INSTALLED (fetch + Axios)!');
})();
