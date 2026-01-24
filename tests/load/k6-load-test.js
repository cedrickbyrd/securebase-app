// SecureBase Load Testing (k6)
// Alternative to Artillery with more detailed metrics

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const authSuccessRate = new Rate('auth_success');
const apiCallCounter = new Counter('api_calls');

// Test configuration
export const options = {
  stages: [
    // Warm-up
    { duration: '1m', target: 10 },
    
    // Baseline load
    { duration: '5m', target: 50 },
    
    // Ramp up to sustained load
    { duration: '2m', target: 100 },
    { duration: '10m', target: 100 },
    
    // Spike test
    { duration: '1m', target: 300 },
    { duration: '2m', target: 300 },
    
    // Cool down
    { duration: '1m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  
  // Performance thresholds (test fails if not met)
  thresholds: {
    'http_req_duration': ['p(95)<100', 'p(99)<200'],  // 95% < 100ms, 99% < 200ms
    'http_req_failed': ['rate<0.01'],                  // < 1% errors
    'errors': ['rate<0.01'],                           // < 1% custom errors
    'auth_success': ['rate>0.99'],                     // > 99% auth success
    'http_req_duration{endpoint:health}': ['p(95)<50'], // Health check < 50ms
    'http_req_duration{endpoint:analytics}': ['p(95)<500'], // Analytics < 500ms
  },
  
  // External metrics (k6 Cloud - optional)
  // ext: {
  //   loadimpact: {
  //     projectID: parseInt(__ENV.K6_PROJECT_ID || '0'),
  //     name: 'SecureBase API Load Test'
  //   }
  // }
};

// Test data
const API_BASE = __ENV.API_BASE_URL || 'https://api.securebase.com/v1';
const TEST_USERS = [
  { email: 'loadtest1@example.com', password: 'Test123!' },
  { email: 'loadtest2@example.com', password: 'Test123!' },
  { email: 'loadtest3@example.com', password: 'Test123!' },
];

// Main test function (runs for each virtual user)
export default function() {
  // Choose random test user
  const user = TEST_USERS[randomIntBetween(0, TEST_USERS.length - 1)];
  let authToken, customerId;
  
  // Group 1: Authentication
  group('Authentication', function() {
    const loginRes = http.post(`${API_BASE}/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth' }
    });
    
    const loginSuccess = check(loginRes, {
      'login successful': (r) => r.status === 200,
      'login has token': (r) => r.json('token') !== undefined,
      'login latency < 200ms': (r) => r.timings.duration < 200,
    });
    
    authSuccessRate.add(loginSuccess);
    errorRate.add(!loginSuccess);
    apiLatency.add(loginRes.timings.duration, { endpoint: 'auth' });
    apiCallCounter.add(1);
    
    if (loginSuccess) {
      authToken = loginRes.json('token');
      customerId = loginRes.json('customer_id');
    } else {
      console.error(`Login failed: ${loginRes.status} - ${loginRes.body}`);
      return;
    }
    
    sleep(1);
  });
  
  if (!authToken) return;
  
  // Group 2: Dashboard data
  group('Dashboard', function() {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    
    // Get invoices
    const invoicesRes = http.get(
      `${API_BASE}/customers/${customerId}/invoices`,
      { headers, tags: { endpoint: 'invoices' } }
    );
    
    check(invoicesRes, {
      'invoices loaded': (r) => r.status === 200,
      'invoices are array': (r) => Array.isArray(r.json('invoices')),
      'invoices latency < 100ms': (r) => r.timings.duration < 100,
    });
    
    apiLatency.add(invoicesRes.timings.duration, { endpoint: 'invoices' });
    apiCallCounter.add(1);
    errorRate.add(invoicesRes.status >= 400);
    
    sleep(2);
    
    // Get metrics
    const metricsRes = http.get(
      `${API_BASE}/customers/${customerId}/metrics?period=30d`,
      { headers, tags: { endpoint: 'metrics' } }
    );
    
    check(metricsRes, {
      'metrics loaded': (r) => r.status === 200,
      'metrics have data': (r) => r.json('data') !== undefined,
      'metrics latency < 200ms': (r) => r.timings.duration < 200,
    });
    
    apiLatency.add(metricsRes.timings.duration, { endpoint: 'metrics' });
    apiCallCounter.add(1);
    errorRate.add(metricsRes.status >= 400);
    
    sleep(3);
    
    // Get compliance status
    const complianceRes = http.get(
      `${API_BASE}/customers/${customerId}/compliance`,
      { headers, tags: { endpoint: 'compliance' } }
    );
    
    check(complianceRes, {
      'compliance loaded': (r) => r.status === 200,
      'compliance latency < 150ms': (r) => r.timings.duration < 150,
    });
    
    apiLatency.add(complianceRes.timings.duration, { endpoint: 'compliance' });
    apiCallCounter.add(1);
    errorRate.add(complianceRes.status >= 400);
    
    sleep(5);
  });
  
  // Group 3: Analytics (slower, less frequent)
  if (Math.random() < 0.3) {  // 30% of users
    group('Analytics', function() {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };
      
      const analyticsRes = http.get(
        `${API_BASE}/analytics/cost-breakdown?customer_id=${customerId}&period=30d`,
        { headers, tags: { endpoint: 'analytics' } }
      );
      
      check(analyticsRes, {
        'analytics loaded': (r) => r.status === 200,
        'analytics has data': (r) => r.json('data') !== undefined,
        'analytics latency < 500ms': (r) => r.timings.duration < 500,
      });
      
      apiLatency.add(analyticsRes.timings.duration, { endpoint: 'analytics' });
      apiCallCounter.add(1);
      errorRate.add(analyticsRes.status >= 400);
      
      sleep(4);
    });
  }
  
  // Group 4: API Key management (rare)
  if (Math.random() < 0.1) {  // 10% of users
    group('API Keys', function() {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };
      
      // List keys
      const listRes = http.get(
        `${API_BASE}/customers/${customerId}/api-keys`,
        { headers, tags: { endpoint: 'api_keys' } }
      );
      
      check(listRes, {
        'api keys listed': (r) => r.status === 200,
        'api keys latency < 100ms': (r) => r.timings.duration < 100,
      });
      
      apiCallCounter.add(1);
      errorRate.add(listRes.status >= 400);
      
      sleep(3);
      
      // Create key
      const createRes = http.post(
        `${API_BASE}/customers/${customerId}/api-keys`,
        JSON.stringify({
          name: `Load Test Key ${randomString(8)}`,
          permissions: ['read:invoices']
        }),
        { headers, tags: { endpoint: 'api_keys' } }
      );
      
      check(createRes, {
        'api key created': (r) => r.status === 201,
        'create latency < 200ms': (r) => r.timings.duration < 200,
      });
      
      apiCallCounter.add(1);
      errorRate.add(createRes.status >= 400);
      
      if (createRes.status === 201) {
        const apiKeyId = createRes.json('api_key_id');
        sleep(2);
        
        // Delete key (cleanup)
        const deleteRes = http.del(
          `${API_BASE}/customers/${customerId}/api-keys/${apiKeyId}`,
          null,
          { headers, tags: { endpoint: 'api_keys' } }
        );
        
        check(deleteRes, {
          'api key deleted': (r) => r.status === 204,
        });
        
        apiCallCounter.add(1);
      }
    });
  }
  
  // Random think time between iterations
  sleep(randomIntBetween(3, 10));
}

// Setup function (runs once per VU at start)
export function setup() {
  // Health check
  const healthRes = http.get(`${API_BASE}/health`, {
    tags: { endpoint: 'health' }
  });
  
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }
  
  console.log('API is healthy, starting load test...');
  
  return {
    timestamp: new Date().toISOString(),
    apiBase: API_BASE
  };
}

// Teardown function (runs once at end)
export function teardown(data) {
  console.log(`Load test completed at ${new Date().toISOString()}`);
  console.log(`Started at: ${data.timestamp}`);
  console.log(`API Base: ${data.apiBase}`);
}

// Handle summary (custom report)
export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    'stdout': generateTextSummary(data, { indent: ' ', enableColors: true }),
  };
}

function generateTextSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  
  let summary = '\n';
  summary += `${indent}=== Load Test Summary ===\n`;
  summary += `${indent}Duration: ${data.state.testRunDurationMs / 1000}s\n`;
  summary += `${indent}Virtual Users: ${data.metrics.vus.values.max}\n`;
  summary += `${indent}Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s\n`;
  summary += `${indent}\n`;
  summary += `${indent}--- Performance ---\n`;
  summary += `${indent}p50 latency: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms\n`;
  summary += `${indent}p95 latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}p99 latency: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `${indent}\n`;
  summary += `${indent}--- Reliability ---\n`;
  summary += `${indent}Error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  summary += `${indent}Auth success: ${(data.metrics.auth_success.values.rate * 100).toFixed(2)}%\n`;
  
  return summary;
}
