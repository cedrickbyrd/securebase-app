// API Service for SecureBase Customer Portal
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.io';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
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

  // GET request
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  // POST request
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Dashboard data
  async getDashboardData() {
    return this.get('/dashboard');
  }

  // User data
  async getUserProfile() {
    return this.get('/user/profile');
  }

  // Invoices
  async getInvoices() {
    return this.get('/invoices');
  }

  // API Keys
  async getApiKeys() {
    return this.get('/api-keys');
  }

  // Mock data for demo/development
  getMockDashboardData() {
    return Promise.resolve({
      metrics: {
        totalScans: 1247,
        activeThreats: 3,
        resolvedIssues: 156,
        systemHealth: 98.5,
      },
      recentActivity: [
        { id: 1, type: 'scan', message: 'Security scan completed', timestamp: new Date().toISOString() },
        { id: 2, type: 'alert', message: 'New threat detected', timestamp: new Date().toISOString() },
      ],
    });
  }
}

// Export as named export to match the import
export const apiService = new ApiService();
export default apiService;
