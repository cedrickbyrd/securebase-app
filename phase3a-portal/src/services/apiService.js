// API Service for SecureBase Customer Portal
import { mockApiService } from './mockApiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.io';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.useMock = USE_MOCK;
  }

  async request(endpoint, options = {}) {
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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Authenticate with API key
   * @param {string} apiKey - Customer API key (starts with sb_)
   * @returns {Promise<Object>} Session token and customer info
   */
  async authenticate(apiKey) {
    if (this.useMock) return mockApiService.authenticate(apiKey);
    
    try {
      const response = await this.post('/auth/login', { api_key: apiKey });
      
      if (response.token || response.session_token) {
        const token = response.token || response.session_token;
        localStorage.setItem('sessionToken', token);
      }
      
      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      const isNetworkError = error.message && error.message.includes('fetch');
      const errorMessage = isNetworkError 
        ? 'Network error. Please check your connection and try again.'
        : 'Invalid API key. Please check your credentials.';
      throw new Error(errorMessage);
    }
  }

  async getMetrics() {
    if (this.useMock) return mockApiService.getMetrics();
    return this.get('/metrics');
  }

  async getDashboardData() {
    if (this.useMock) return mockApiService.getDashboardData();
    return this.get('/dashboard');
  }

  async getUserProfile() {
    if (this.useMock) return mockApiService.getUserProfile();
    return this.get('/user/profile');
  }

  async getInvoices() {
    if (this.useMock) return mockApiService.getInvoices();
    return this.get('/invoices');
  }

  async getApiKeys() {
    if (this.useMock) return mockApiService.getApiKeys();
    return this.get('/api-keys');
  }

  async getComplianceStatus() {
    if (this.useMock) return mockApiService.getComplianceStatus();
    return this.get('/compliance/status');
  }

  async getComplianceFindings() {
    if (this.useMock) return mockApiService.getComplianceFindings();
    return this.get('/compliance/findings');
  }

  async downloadComplianceReport() {
    if (this.useMock) return mockApiService.downloadComplianceReport();
    return this.get('/compliance/report/download');
  }

  async getTickets(params) {
    if (this.useMock) return mockApiService.getTickets(params);
    return this.get('/tickets', { params });
  }

  async getSupportTickets(params) {
    return this.getTickets(params);
  }

  async createTicket(ticketData) {
    if (this.useMock) return mockApiService.createTicket(ticketData);
    return this.post('/tickets', ticketData);
  }
}

export const apiService = new ApiService();
export default apiService;
