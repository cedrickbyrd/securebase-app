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
      totalRevenue: 125430,
      activeCustomers: 342,
      apiCalls: 1250000,
      uptime: 99.98
    },
    invoices: [
      { id: 'inv_001', amount: 1250, status: 'paid', date: '2026-01-15' },
      { id: 'inv_002', amount: 890, status: 'pending', date: '2026-02-01' }
    ],
    apiKeys: [],
    compliance: {
      pciCompliant: true,
      soc2Certified: true,
      gdprCompliant: true,
      hipaaCompliant: true
    },
    tickets: [
      { id: 'tick_001', subject: 'API Rate Limit Question', status: 'open', date: '2026-02-05' }
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
    if(url.includes('/metrics')) return mockData.metrics;
    if(url.includes('/invoices')) return mockData.invoices;
    if(url.includes('/api-keys')) return mockData.apiKeys;
    if(url.includes('/compliance')) return mockData.compliance;
    if(url.includes('/tickets')) return mockData.tickets;
    if(url.includes('/customers')) return mockData.customers;
    return {};
  }
  
  console.log('✅ MOCK INSTALLED (fetch + Axios)!');
})();
