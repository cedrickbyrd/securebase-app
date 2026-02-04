import { describe, it, expect, beforeEach } from 'vitest';
import { MockApiService } from '../mocks/MockApiService';

/**
 * Mock API Service Tests
 * 
 * Tests for demo mode API service:
 * - Data loading from mockData.js
 * - All endpoints return proper data
 * - 5 customers as per DEMO_ENVIRONMENT.md
 * - 30+ invoices
 */

describe('MockApiService - Demo Data Validation', () => {
  let mockApi;

  beforeEach(() => {
    mockApi = new MockApiService();
  });

  it('should return customer profile with HealthCorp data', async () => {
    const response = await mockApi.getCustomerProfile();
    
    expect(response.data).toBeDefined();
    expect(response.data.name).toBe('HealthCorp Medical Systems');
    expect(response.data.tier).toBe('healthcare');
    expect(response.data.framework).toBe('hipaa');
    expect(response.data.accounts).toBe(45);
    expect(response.data.monthly_price).toBe(15000);
  });

  it('should return 30+ invoices', async () => {
    const response = await mockApi.getInvoices();
    
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThanOrEqual(30);
  });

  it('should return invoices with proper structure', async () => {
    const response = await mockApi.getInvoices();
    const invoice = response.data[0];
    
    expect(invoice).toHaveProperty('id');
    expect(invoice).toHaveProperty('invoice_number');
    expect(invoice).toHaveProperty('customer_id');
    expect(invoice).toHaveProperty('customer_name');
    expect(invoice).toHaveProperty('total_amount');
    expect(invoice).toHaveProperty('status');
    expect(invoice).toHaveProperty('line_items');
    expect(Array.isArray(invoice.line_items)).toBe(true);
  });

  it('should return invoices from all 5 customers', async () => {
    const response = await mockApi.getInvoices();
    const customerIds = new Set(response.data.map(inv => inv.customer_id));
    
    // Should have invoices from 5 different customers
    expect(customerIds.size).toBe(5);
  });

  it('should return metrics with total revenue of $58,240', async () => {
    const response = await mockApi.getMetrics();
    
    expect(response.data).toBeDefined();
    expect(response.data.monthly_cost).toBe(58240);
    expect(response.data.total_customers).toBe(5);
    expect(response.data.account_count).toBe(233); // 45 + 28 + 5 + 120 + 35
  });

  it('should return API keys', async () => {
    const response = await mockApi.getApiKeys();
    
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data[0]).toHaveProperty('id');
    expect(response.data[0]).toHaveProperty('masked_key');
  });

  it('should return compliance status', async () => {
    const response = await mockApi.getComplianceStatus();
    
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('score');
    expect(response.data).toHaveProperty('frameworks');
    expect(Array.isArray(response.data.frameworks)).toBe(true);
  });

  it('should return support tickets', async () => {
    const response = await mockApi.getSupportTickets();
    
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should return cost forecast', async () => {
    const response = await mockApi.generateCostForecast();
    
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('current_monthly_cost');
    expect(response.data).toHaveProperty('forecasted_costs');
    expect(Array.isArray(response.data.forecasted_costs)).toBe(true);
  });

  it('should handle authentication with demo credentials', async () => {
    const response = await mockApi.authenticate('demo-api-key');
    
    expect(response).toBeDefined();
    expect(response.session_token).toBeDefined();
    expect(response.customer_id).toBeDefined();
  });

  it('should reject invalid API keys in demo mode', async () => {
    await expect(mockApi.authenticate('invalid-key')).rejects.toThrow();
  });
});
