// API Service for SecureBase Customer Portal
import { mockApiService } from './mockApiService';

// 1. Define the base URL from env or fallback
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; 

// 2. Determine if we should use mocks
// Force true if API_BASE is empty OR if explicitly requested via env
const USE_MOCK = !API_BASE || import.meta.env.VITE_USE_MOCK_API === 'true';

if (!API_BASE) {
  console.warn("⚠️ VITE_API_BASE_URL is not defined. SecureBase is running in MOCK MODE.");
}

class ApiService {
  constructor() {
    this.baseURL = API_BASE;
    this.useMock = USE_MOCK;
  }

  async request(endpoint, options = {}) {
    // If we're in mock mode, we shouldn't even hit this base request logic 
    // for specific methods, but this is a good safety net.
    if (this.useMock) {
       console.log(`🎭 Mocking request to: ${endpoint}`);
       // You could optionally route to mockApiService here as a catch-all
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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ... (get, post, put, delete methods remain the same)

  async authenticate(apiKey) {
    // If useMock is true (because env is missing), this will trigger the mock service
    if (this.useMock) return mockApiService.authenticate(apiKey);
    
    try {
      const response = await this.post('/auth/login', { api_key: apiKey });
      if (response.token || response.session_token) {
        const token = response.token || response.session_token;
        localStorage.setItem('sessionToken', token);
      }
      return response;
    } catch (error) {
      // (Error handling remains the same)
      throw error;
    }
  }

  // Example of the pattern for all other methods
  async getMetrics() {
    if (this.useMock) return mockApiService.getMetrics();
    return this.get('/metrics');
  }

  // ... (apply the "if (this.useMock)" pattern to all other methods as you already have)
}

export const apiService = new ApiService();
export default apiService;
