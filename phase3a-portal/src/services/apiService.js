/**
 * API Service Layer
 * Handles all communication with SecureBase Phase 2 backend APIs
 * Supports demo mode with mock data for public demonstrations
 */

import axios from 'axios';
import { MockApiService } from '../mocks/MockApiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.dev';
const TIMEOUT = 30000;
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

class RealApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('sessionToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('sessionToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authentication
   */

  async authenticate(apiKey) {
    const response = await this.client.post('/auth/authenticate', {
      api_key: apiKey,
    });
    const { session_token } = response.data;
    localStorage.setItem('sessionToken', session_token);
    return response.data;
  }

  /**
   * Signup & Onboarding
   */

  async createCheckoutSession(signupData) {
    try {
      const response = await this.client.post('/checkout', signupData);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifySignup(sessionId) {
    try {
      const response = await this.client.get(`/signup/verify?session_id=${sessionId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Metrics & Usage
   */

  async getMetrics(timeRange = 'month') {
    return this.client.get('/metrics', {
      params: { timeRange },
    });
  }

  async getMetricsHistory(months = 12) {
    return this.client.get('/metrics/history', {
      params: { months },
    });
  }

  /**
   * Invoices
   */

  async getInvoices(params = {}) {
    return this.client.get('/invoices', { params });
  }

  async getInvoiceById(invoiceId) {
    return this.client.get(`/invoices/${invoiceId}`);
  }

  async downloadInvoice(invoiceId) {
    const response = await this.client.get(
      `/invoices/${invoiceId}/download`,
      {
        responseType: 'blob',
      }
    );

    // Create a blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${invoiceId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * API Keys
   */

  async getApiKeys() {
    return this.client.get('/api-keys');
  }

  async createApiKey(data) {
    return this.client.post('/api-keys/create', data);
  }

  async revokeApiKey(keyId) {
    return this.client.delete(`/api-keys/${keyId}`);
  }

  /**
   * Compliance
   */

  async getComplianceStatus() {
    return this.client.get('/compliance/status');
  }

  async getComplianceFindings() {
    return this.client.get('/compliance/findings');
  }

  async downloadComplianceReport() {
    const response = await this.client.get('/compliance/report', {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Customer Profile
   */

  async getCustomerProfile() {
    return this.client.get('/customer/profile');
  }

  async updateCustomerProfile(data) {
    return this.client.patch('/customer/profile', data);
  }

  /**
   * Support Tickets (Phase 3b)
   */

  async getSupportTickets(params = {}) {
    try {
      const response = await this.client.get('/support/tickets', { params });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSupportTicket(ticketId) {
    try {
      const response = await this.client.get(`/support/tickets/${ticketId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createSupportTicket(ticketData) {
    try {
      const response = await this.client.post('/support/tickets/create', ticketData);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateSupportTicket(ticketId, updates) {
    try {
      const response = await this.client.put(`/support/tickets/${ticketId}`, updates);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addTicketComment(ticketId, commentText) {
    try {
      const response = await this.client.post(
        `/support/tickets/${ticketId}/comments`,
        { text: commentText }
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTicketComments(ticketId) {
    try {
      const response = await this.client.get(`/support/tickets/${ticketId}/comments`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Cost Forecasting & Optimization
   */

  async generateCostForecast(params = {}) {
    try {
      const response = await this.client.get('/cost/forecast', { params });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCostOptimizationRecommendations(params = {}) {
    try {
      const response = await this.client.get('/cost/recommendations', { params });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getResourceUtilization(params = {}) {
    try {
      const response = await this.client.get('/cost/utilization', { params });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async setBudgetAlert(budgetData) {
    try {
      const response = await this.client.post('/cost/budget-alert', budgetData);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getBudgetAlerts() {
    try {
      const response = await this.client.get('/cost/budget-alerts');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportCostForecast(format = 'pdf') {
    try {
      const response = await this.client.get('/cost/forecast/export', {
        params: { format },
        responseType: format === 'pdf' ? 'blob' : 'json',
      });
      
      if (format === 'pdf') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `cost-forecast-${new Date().toISOString().split('T')[0]}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Notifications (Phase 3b)
   */

  async getNotifications(params = {}) {
    try {
      const response = await this.client.get('/notifications', { params });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markNotificationAsRead(notificationId) {
    try {
      const response = await this.client.put(
        `/notifications/${notificationId}/read`,
        {}
      );
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markAllNotificationsAsRead() {
    try {
      const response = await this.client.put('/notifications/read-all', {});
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await this.client.delete(`/notifications/${notificationId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Error handling wrapper
   */

  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.message || error.message,
        errors: error.response.data?.errors,
      };
    } else if (error.request) {
      return {
        status: 0,
        message: 'No response from server. Please check your connection.',
      };
    } else {
      return {
        status: 0,
        message: error.message,
      };
    }
  }
}

// Export the appropriate service based on environment
export const apiService = USE_MOCK_API ? new MockApiService() : new RealApiService();

// Also export for testing/debugging
export { RealApiService, MockApiService };
