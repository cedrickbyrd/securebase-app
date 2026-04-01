// phase3a-portal/src/utils/fetchData.js

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

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
  };

  // Return matched mock or a generic empty response
  for (const key of Object.keys(mockResponses)) {
    if (endpoint.includes(key)) return mockResponses[key];
  }
  return {};
};

const fetchData = async (endpoint) => {
  if (isDemoMode()) {
    console.log(`[Demo Mode] Returning mock data for ${endpoint}`);
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
    console.warn(`[API] Request failed for ${endpoint}, falling back to mock data:`, error.message);
    return getMockData(endpoint);
  }
};

export { fetchData, getMockData, isDemoMode };
