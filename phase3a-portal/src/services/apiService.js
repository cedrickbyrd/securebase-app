// API Service for SecureBase Customer Portal

// Define the base URL — /api is proxied by Netlify to the real backend
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
  }

  // --- Core Request Engine ---
  request = async (endpoint, options = {}) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      if (response.status === 401) {
        if (sessionToken) {
          localStorage.removeItem('sessionToken');
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  };

  // --- HTTP Verbs ---
  get = async (endpoint, options = {}) => this.request(endpoint, { ...options, method: 'GET' });
  
  post = async (endpoint, data, options = {}) => this.request(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });

  put = async (endpoint, data, options = {}) => this.request(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });

  delete = async (endpoint, options = {}) => this.request(endpoint, { ...options, method: 'DELETE' });

  // --- Authentication ---
  authenticate = async (apiKey) => {
    try {
      const response = await this.post('/auth/login', { api_key: apiKey });
      if (response.token || response.session_token) {
        localStorage.setItem('sessionToken', response.token || response.session_token);
      }
      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error(error.message.includes('fetch') 
        ? 'Network error. Please check your connection and try again.' 
        : 'Invalid API key. Please check your credentials.');
    }
  };

  // --- Data Fetching Methods ---
  getMetrics = async () => this.get('/billing/metrics');

  getDashboardData = async () => this.get('/billing/dashboard');

  getUserProfile = async () => this.get('/user/profile');

  getInvoices = async () => this.get('/billing/invoices');

  getApiKeys = async () => this.get('/api-keys');

  getComplianceStatus = async () => this.get('/compliance/status');

  getTickets = async (params) => this.get('/tickets', { params });

  createTicket = async (ticketData) => this.post('/tickets', ticketData);
}

export const apiService = new ApiService();
export default apiService;
