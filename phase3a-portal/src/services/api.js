/**
 * API Service Layer
 * Handles all HTTP requests to SecureBase backend
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.com/v1';

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sessionToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sessionToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (apiKey) => api.post('/auth/login', { api_key: apiKey });

// Dashboard
export const getDashboardMetrics = () => api.get('/dashboard/metrics');

// Invoices
export const getInvoices = (params = {}) => api.get('/invoices', { params });
export const getInvoice = (invoiceId) => api.get(`/invoices/${invoiceId}`);
export const downloadInvoicePDF = (invoiceId) => 
  api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });

// API Keys
export const getApiKeys = () => api.get('/api-keys');
export const createApiKey = (data) => api.post('/api-keys', data);
export const revokeApiKey = (keyId) => api.delete(`/api-keys/${keyId}`);

// Compliance
export const getComplianceStatus = () => api.get('/compliance/status');
export const getComplianceReport = (framework) => 
  api.get(`/compliance/report/${framework}`, { responseType: 'blob' });

// Support Tickets
export const getSupportTickets = (params = {}) => api.get('/support/tickets', { params });
export const getSupportTicket = (ticketId) => api.get(`/support/tickets/${ticketId}`);
export const createSupportTicket = (data) => api.post('/support/tickets', data);
export const updateSupportTicket = (ticketId, data) => 
  api.put(`/support/tickets/${ticketId}`, data);
export const addTicketComment = (ticketId, text) =>
  api.post(`/support/tickets/${ticketId}/comments`, { text });
export const getTicketComments = (ticketId) =>
  api.get(`/support/tickets/${ticketId}/comments`);

// Cost Forecasting
export const getCostForecast = () => api.get('/forecast');
export const getUsageHistory = (months = 12) => api.get('/usage/history', { params: { months } });

// Webhooks
export const getWebhooks = () => api.get('/webhooks');
export const getWebhook = (webhookId) => api.get(`/webhooks/${webhookId}`);
export const createWebhook = (data) => api.post('/webhooks', data);
export const updateWebhook = (webhookId, data) => api.put(`/webhooks/${webhookId}`, data);
export const deleteWebhook = (webhookId) => api.delete(`/webhooks/${webhookId}`);
export const testWebhook = (webhookId) => api.post(`/webhooks/test?webhookId=${webhookId}`);
export const getWebhookDeliveries = (webhookId, limit = 50) => 
  api.get('/webhooks/deliveries', { params: { webhookId, limit } });

// Notifications
export const getNotifications = () => api.get('/notifications');
export const markNotificationRead = (notificationId) =>
  api.patch(`/notifications/${notificationId}`, { read: true });
export const markAllNotificationsRead = () => api.post('/notifications/mark-all-read');
export const clearNotifications = () => api.delete('/notifications');

export default api;
