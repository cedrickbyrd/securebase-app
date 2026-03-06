// API Service for SecureBase Customer Portal
import { mockApiService } from './mockApiService';

const API_BASE = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.com/v1'); 

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !API_BASE;

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
    this.useMock = USE_MOCK;
  }

  // --- Core Request Engine ---
  request = async (endpoint, options = {}) => {
    if (this.useMock) {
      console.log(`🎭 Mocking request to: ${endpoint}`);
    }

    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
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
    if (this.useMock) return mockApiService.authenticate(apiKey);
    
    try {
      const response = await this.post('/auth/login', { api_key: apiKey });
      if (response.token || response.session_token) {
        localStorage.setItem('sessionToken', response.token || response.session_token);
      }
      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error(error.message.includes('fetch') 
        ? 'Network error. Check connection.' 
        : 'Invalid API key.');
    }
  };

  // --- Data Fetching Methods ---
  getMetrics = async () => {
    if (this.useMock) return mockApiService.getMetrics();
    return this.get('/metrics');
  };

  getDashboardData = async () => {
    if (this.useMock) return mockApiService.getDashboardData();
    return this.get('/dashboard');
  };

  getUserProfile = async () => {
    if (this.useMock) return mockApiService.getUserProfile();
    return this.get('/user/profile');
  };

  getInvoices = async () => {
    if (this.useMock) return mockApiService.getInvoices();
    return this.get('/invoices');
  };

  getApiKeys = async () => {
    if (this.useMock) return mockApiService.getApiKeys();
    return this.get('/api-keys');
  };

  getComplianceStatus = async () => {
    if (this.useMock) return mockApiService.getComplianceStatus();
    return this.get('/compliance/status');
  };

  getTickets = async (params) => {
    if (this.useMock) return mockApiService.getTickets(params);
    return this.get('/tickets', { params });
  };

  createTicket = async (ticketData) => {
    if (this.useMock) return mockApiService.createTicket(ticketData);
    return this.post('/tickets', ticketData);
  };
}

export const apiService = new ApiService();
export default apiService;
