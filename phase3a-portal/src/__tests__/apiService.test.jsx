/**
 * Unit tests for ApiService
 * Tests for production API authentication and core methods
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiService } from '../services/apiService';

// Mock fetch globally
global.fetch = vi.fn();

describe('ApiService - authenticate() method', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully authenticate with valid API key', async () => {
    // Mock successful authentication response
    const mockResponse = {
      token: 'jwt-token-123',
      session_token: 'session-abc-456',
      customer_id: 'customer-001',
      email: 'test@example.com',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await apiService.authenticate('sb_test_key_12345');

    // Verify the fetch call
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ api_key: 'sb_test_key_12345' }),
      })
    );

    // Verify the response
    expect(result).toEqual(mockResponse);

    // Verify session token is stored in localStorage
    expect(localStorage.getItem('sessionToken')).toBe('jwt-token-123');
  });

  it('should store session_token if token is not present', async () => {
    // Mock response with session_token instead of token
    const mockResponse = {
      session_token: 'session-xyz-789',
      customer_id: 'customer-002',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await apiService.authenticate('sb_another_key');

    // Verify session_token is stored
    expect(localStorage.getItem('sessionToken')).toBe('session-xyz-789');
  });

  it('should handle network errors gracefully', async () => {
    // Mock network error
    global.fetch.mockRejectedValueOnce(new Error('fetch failed: Network error'));

    await expect(
      apiService.authenticate('sb_test_key')
    ).rejects.toThrow('Network error. Please check your connection and try again.');
  });

  it('should handle authentication errors with appropriate message', async () => {
    // Mock authentication error (non-network)
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(
      apiService.authenticate('sb_invalid_key')
    ).rejects.toThrow('Invalid API key. Please check your credentials.');
  });

  it('should not store token if response has neither token nor session_token', async () => {
    const mockResponse = {
      customer_id: 'customer-003',
      email: 'test@example.com',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await apiService.authenticate('sb_key_without_token');

    // Verify no token is stored
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });

  it('should call POST endpoint with correct data structure', async () => {
    const mockResponse = {
      token: 'test-token',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await apiService.authenticate('sb_production_key_123');

    // Verify the request body structure
    const fetchCall = global.fetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    
    expect(requestBody).toEqual({
      api_key: 'sb_production_key_123',
    });
  });
});

describe('ApiService - Core HTTP Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make GET requests', async () => {
    const mockData = { data: 'test' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await apiService.get('/test-endpoint');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should make POST requests', async () => {
    const mockData = { success: true };
    const postData = { name: 'test' };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const result = await apiService.post('/test-endpoint', postData);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(postData),
      })
    );
    expect(result).toEqual(mockData);
  });
});
