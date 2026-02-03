/**
 * Mock API Service for Demo Mode
 * Simulates backend API responses with realistic delays
 */

import {
  mockCustomer,
  mockInvoices,
  mockMetrics,
  mockApiKeys,
  mockCompliance,
  mockSupportTickets,
  mockNotifications,
  mockCostForecast,
  mockWebhooks
} from './mockData';

export class MockApiService {
  constructor() {
    // Simulate network delay (300ms - realistic for API calls)
    this.delay = 300;
    this.demoMode = true;
  }

  /**
   * Helper to simulate API calls with network delay
   */
  async simulateCall(data, delay = this.delay) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(data), delay);
    });
  }

  /**
   * Helper to simulate API errors
   */
  async simulateError(message, status = 400) {
    await new Promise(r => setTimeout(r, this.delay));
    const error = new Error(message);
    error.response = {
      status,
      data: { message }
    };
    throw error;
  }

  /**
   * Authentication
   */
  async authenticate(apiKey) {
    if (apiKey === 'demo' || apiKey === 'demo-api-key') {
      return this.simulateCall({
        session_token: 'demo_session_token_' + Date.now(),
        customer_id: mockCustomer.id,
        expires_in: 3600
      });
    }
    return this.simulateError('Invalid API key', 401);
  }

  /**
   * Signup & Onboarding
   */
  async createCheckoutSession(signupData) {
    return this.simulateCall({
      data: {
        url: '#',
        session_id: 'demo_checkout_session',
        message: 'Demo mode: Checkout not available. This would redirect to Stripe in production.'
      }
    });
  }

  async verifySignup(sessionId) {
    return this.simulateCall({
      data: {
        success: false,
        message: 'Demo mode: Signup verification not available'
      }
    });
  }

  /**
   * Metrics & Usage
   */
  async getMetrics(timeRange = 'month') {
    return this.simulateCall({
      data: mockMetrics
    });
  }

  async getMetricsHistory(months = 12) {
    return this.simulateCall({
      data: {
        history: mockMetrics.cost_history,
        total_months: months
      }
    });
  }

  /**
   * Invoices
   */
  async getInvoices(params = {}) {
    return this.simulateCall({
      data: mockInvoices,
      meta: {
        total: mockInvoices.length,
        page: params.page || 1,
        limit: params.limit || 10
      }
    });
  }

  async getInvoiceById(invoiceId) {
    const invoice = mockInvoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      return this.simulateCall({
        data: invoice
      });
    }
    return this.simulateError('Invoice not found', 404);
  }

  async downloadInvoice(invoiceId) {
    // In demo mode, we can't actually download PDFs
    // Return a message instead
    return this.simulateCall({
      data: {
        message: 'Demo mode: PDF download not available. In production, this would download an invoice PDF.',
        demo_url: '#'
      }
    });
  }

  /**
   * API Keys
   */
  async getApiKeys() {
    return this.simulateCall({
      data: mockApiKeys
    });
  }

  async createApiKey(data) {
    // Demo mode - don't create real keys
    return this.simulateError(
      'Demo mode: Cannot create real API keys. Sign up for a trial to create functional API keys.',
      403
    );
  }

  async revokeApiKey(keyId) {
    return this.simulateError(
      'Demo mode: Cannot revoke API keys. This is read-only demo data.',
      403
    );
  }

  /**
   * Compliance
   */
  async getComplianceStatus() {
    return this.simulateCall({
      data: mockCompliance
    });
  }

  async getComplianceFindings() {
    return this.simulateCall({
      data: mockCompliance.alerts
    });
  }

  async downloadComplianceReport() {
    return this.simulateCall({
      data: {
        message: 'Demo mode: PDF download not available. In production, this would download a compliance report.',
        demo_url: '#'
      }
    });
  }

  /**
   * Customer Profile
   */
  async getCustomerProfile() {
    return this.simulateCall({
      data: mockCustomer
    });
  }

  async updateCustomerProfile(data) {
    return this.simulateError(
      'Demo mode: Cannot update customer profile. This is read-only demo data.',
      403
    );
  }

  /**
   * Support Tickets (Phase 3b)
   */
  async getSupportTickets(params = {}) {
    return this.simulateCall({
      data: mockSupportTickets
    });
  }

  async getSupportTicket(ticketId) {
    const ticket = mockSupportTickets.find(t => t.id === ticketId);
    if (ticket) {
      return this.simulateCall({
        data: ticket
      });
    }
    return this.simulateError('Ticket not found', 404);
  }

  async createSupportTicket(ticketData) {
    return this.simulateError(
      'Demo mode: Cannot create real support tickets. Sign up for a trial to access support.',
      403
    );
  }

  async updateSupportTicket(ticketId, updates) {
    return this.simulateError(
      'Demo mode: Cannot update support tickets. This is read-only demo data.',
      403
    );
  }

  async addTicketComment(ticketId, commentText) {
    return this.simulateError(
      'Demo mode: Cannot add comments. This is read-only demo data.',
      403
    );
  }

  async getTicketComments(ticketId) {
    const ticket = mockSupportTickets.find(t => t.id === ticketId);
    if (ticket) {
      return this.simulateCall({
        data: ticket.comments || []
      });
    }
    return this.simulateCall({ data: [] });
  }

  /**
   * Cost Forecasting & Optimization
   */
  async generateCostForecast(params = {}) {
    return this.simulateCall({
      data: mockCostForecast
    });
  }

  async getCostOptimizationRecommendations(params = {}) {
    return this.simulateCall({
      data: mockCostForecast.recommendations
    });
  }

  async getResourceUtilization(params = {}) {
    return this.simulateCall({
      data: mockMetrics.resource_usage
    });
  }

  async setBudgetAlert(budgetData) {
    return this.simulateError(
      'Demo mode: Cannot set budget alerts. Sign up for a trial to configure alerts.',
      403
    );
  }

  async getBudgetAlerts() {
    return this.simulateCall({
      data: []
    });
  }

  async exportCostForecast(format = 'pdf') {
    return this.simulateCall({
      data: {
        message: `Demo mode: ${format.toUpperCase()} export not available. In production, this would download a cost forecast report.`,
        demo_url: '#'
      }
    });
  }

  /**
   * Notifications (Phase 3b)
   */
  async getNotifications(params = {}) {
    return this.simulateCall({
      data: mockNotifications
    });
  }

  async markNotificationAsRead(notificationId) {
    return this.simulateCall({
      data: { success: true, message: 'Demo mode: Notification marked as read (local only)' }
    });
  }

  async markAllNotificationsAsRead() {
    return this.simulateCall({
      data: { success: true, message: 'Demo mode: All notifications marked as read (local only)' }
    });
  }

  async deleteNotification(notificationId) {
    return this.simulateCall({
      data: { success: true, message: 'Demo mode: Notification deleted (local only)' }
    });
  }

  /**
   * Webhooks (Phase 3b)
   */
  async getWebhooks() {
    return this.simulateCall({
      data: mockWebhooks
    });
  }

  async createWebhook(webhookData) {
    return this.simulateError(
      'Demo mode: Cannot create webhooks. Sign up for a trial to configure webhooks.',
      403
    );
  }

  async updateWebhook(webhookId, updates) {
    return this.simulateError(
      'Demo mode: Cannot update webhooks. This is read-only demo data.',
      403
    );
  }

  async deleteWebhook(webhookId) {
    return this.simulateError(
      'Demo mode: Cannot delete webhooks. This is read-only demo data.',
      403
    );
  }

  async testWebhook(webhookId) {
    return this.simulateCall({
      data: {
        success: true,
        message: 'Demo mode: Webhook test would send a sample event in production'
      }
    });
  }

  /**
   * Error handling wrapper (matches real API service interface)
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
