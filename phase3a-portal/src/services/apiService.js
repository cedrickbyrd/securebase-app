// API Service for SecureBase Customer Portal
import { mockApiService } from './mockApiService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; 
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !API_BASE;

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
    this.useMock = USE_MOCK;
  }

  // 1. Use arrow functions for all methods to preserve 'this' context
  request = async (endpoint, options = {}) => {
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

  // 2. Explicitly define the post method that was missing/unbound
  post = async (endpoint, data, options = {}) => {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  // 3. Define the get method for your metrics calls
  get = async (endpoint, options = {}) => {
    return this.request(endpoint, { ...options, method: 'GET' });
  };

  authenticate = async (apiKey) => {
    if (this.useMock) return mockApiService.authenticate(apiKey);
    
    try {
      // Now this.post is guaranteed to be a function!
      const response = await this.post('/auth/login', { api_key: apiKey });
      if (response.token || response.session_token) {
        const token = response.token || response.session_token;
        localStorage.setItem('sessionToken', token);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  getMetrics = async () => {
    if (this.useMock) return mockApiService.getMetrics();
    return this.get('/metrics');
  };

  // ... add other methods following the same arrow function pattern
}

export const apiService = new ApiService();
export default apiService;
