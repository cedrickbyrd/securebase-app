/**
 * apiService.ts
 * Production and mock API client for SecureBase telemetry and drift analytics
 */
import { mockApiService, DriftAnalyticsResponse, ComplianceScoreResponse } from './mockApiService';

const API_BASE = import.meta.env?.VITE_API_BASE_URL || '/api';
const SESSION_TOKEN_KEY = 'sessionToken';

export function getStoredSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
}

export function clearStoredSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function persistSessionToken(token: string, rememberMe = false): void {
  clearStoredSessionToken();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(SESSION_TOKEN_KEY, token);
}

class ApiService {
  baseURL: string;

  constructor() {
    this.baseURL = API_BASE;
  }

  request = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const sessionToken = getStoredSessionToken();
    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        ...(options.headers || {})
      },
      ...options
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      if (response.status === 401) {
        if (sessionToken) {
          clearStoredSessionToken();
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
      }
      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.json();
        } catch {
          errorBody = {};
        }
        const requestError: any = new Error(errorBody.message || `HTTP error! status: ${response.status}`);
        requestError.status = response.status;
        requestError.errorCode = errorBody.error;
        throw requestError;
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  };

  get = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    return this.request(endpoint, { ...options, method: 'GET' });
  };

  post = async (endpoint: string, data: any, options: RequestInit = {}): Promise<any> => {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  };

  // Compliance & Telemetry (Bridge Interceptors)
  getComplianceScore = async (
    tenantId = 'cnb-waxahachie',
    framework = 'ffiec'
  ): Promise<ComplianceScoreResponse> => {
    const useMock =
      import.meta.env?.VITE_USE_MOCK_API === 'true' ||
      import.meta.env?.VITE_DEMO_MODE === 'true' ||
      true; // Default to built-in simulation engine in demo portal
    if (useMock) return mockApiService.getComplianceScore(tenantId, framework);
    return this.get(`/compliance/score/${tenantId}?framework=${framework}`);
  };

  getDriftAnalytics = async (tenantId = 'cnb-waxahachie'): Promise<DriftAnalyticsResponse> => {
    const useMock =
      import.meta.env?.VITE_USE_MOCK_API === 'true' ||
      import.meta.env?.VITE_DEMO_MODE === 'true' ||
      true; // Default to built-in simulation engine in demo portal
    if (useMock) return mockApiService.getDriftAnalytics(tenantId);
    return this.get(`/compliance/drift-analytics?tenantId=${encodeURIComponent(tenantId)}`);
  };
}

export const apiService = new ApiService();
