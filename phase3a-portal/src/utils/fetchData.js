// phase3a-portal/src/utils/fetchData.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const isDemoMode = () =>
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  window.location.hostname.includes('demo');

const getMockData = (endpoint) => {
  // Return appropriate mock data based on endpoint
  const mockResponses = {
    '/metrics': {
      soc2Score: 94,
      hipaaScore: 88,
      activeControls: 142,
      openFindings: 7,
      lastAudit: '2026-03-15',
    },
    '/findings': [
      { id: 1, severity: 'High', title: 'MFA not enforced on 3 accounts', status: 'Open' },
      { id: 2, severity: 'Medium', title: 'Encryption at rest missing on S3 bucket', status: 'Open' },
      { id: 3, severity: 'Low', title: 'Password policy below recommended threshold', status: 'In Progress' },
    ],
    '/controls': {
      total: 142,
      passing: 135,
      failing: 7,
    },
    // Added mock data for your compliance history charts/views
    '/tenant/compliance/history': {
      framework: 'all',
      days: 90,
      complianceScore: 94,
      history: [
        { date: '2026-05-01', passed: 130, failed: 12 },
        { date: '2026-06-01', passed: 132, failed: 10 },
        { date: '2026-07-01', passed: 135, failed: 7 }
      ]
    },
    // Added mock data for your AWS IAM Cloud Connection view
    '/cloud-connection/init': {
      externalId: 'securebase-demo-env-ext-id-bc8d41a3',
      awsAccountId: '123456789012',
      roleName: 'SecureBase-Audit-ExecutionRole'
    }
  };

  // Check if the requested endpoint contains any of our key routes
  for (const key of Object.keys(mockResponses)) {
    if (endpoint.includes(key)) return mockResponses[key];
  }
  
  // Clean fallback context for unhandled mock routes to prevent UI shell crashes
  return {};
};

const fetchData = async (endpoint) => {
  if (isDemoMode()) {
    console.log(`[Demo Mode] Intercepted network request and returning mock data for: ${endpoint}`);
    return getMockData(endpoint);
  }

  try {
    const token = localStorage.getItem('sessionToken');
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    // Hard boundary safety rule: production failures should never mask behind mock data
    console.error(`[API Error] Request failed for ${endpoint}:`, error.message);
    throw error; 
  }
};

export { fetchData, getMockData, isDemoMode };
