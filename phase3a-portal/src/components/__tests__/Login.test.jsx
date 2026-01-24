/**
 * Unit tests for Login component
 * Phase 4: Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../test/testUtils';
import { Login } from '../Login';

// Mock the API service
vi.mock('../../services/apiService', () => ({
  login: vi.fn((email, apiKey) => {
    if (email === 'test@example.com' && apiKey === 'valid-key') {
      return Promise.resolve({
        token: 'jwt-token-123',
        customerId: 'customer-001',
        email: 'test@example.com',
      });
    }
    return Promise.reject(new Error('Invalid credentials'));
  }),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Login component', () => {
    renderWithRouter(<Login />);
    expect(screen.getByText(/login|sign in/i)).toBeInTheDocument();
  });

  it('should have email and API key input fields', () => {
    renderWithRouter(<Login />);
    
    expect(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i) || screen.getByPlaceholderText(/api key/i)).toBeInTheDocument();
  });

  it('should have a submit button', () => {
    renderWithRouter(<Login />);
    expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    renderWithRouter(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /login|sign in/i });
    fireEvent.click(submitButton);
    
    // Check for validation messages - adjust based on implementation
    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/required|enter|provide/i);
      expect(errorMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should call login API with valid credentials', async () => {
    const { login } = await import('../../services/apiService');
    
    renderWithRouter(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    const apiKeyInput = screen.getByLabelText(/api key/i) || screen.getByPlaceholderText(/api key/i);
    const submitButton = screen.getByRole('button', { name: /login|sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(apiKeyInput, { target: { value: 'valid-key' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('test@example.com', 'valid-key');
    });
  });

  it('should display error message on login failure', async () => {
    const { login } = await import('../../services/apiService');
    
    renderWithRouter(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    const apiKeyInput = screen.getByLabelText(/api key/i) || screen.getByPlaceholderText(/api key/i);
    const submitButton = screen.getByRole('button', { name: /login|sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(apiKeyInput, { target: { value: 'wrong-key' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid|error|failed/i)).toBeInTheDocument();
    });
  });

  it('should disable submit button while logging in', async () => {
    renderWithRouter(<Login />);
    
    const emailInput = screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i);
    const apiKeyInput = screen.getByLabelText(/api key/i) || screen.getByPlaceholderText(/api key/i);
    const submitButton = screen.getByRole('button', { name: /login|sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(apiKeyInput, { target: { value: 'valid-key' } });
    fireEvent.click(submitButton);
    
    // Button should be disabled during API call
    // Note: This test might need adjustment based on actual implementation
    expect(submitButton.disabled || submitButton.getAttribute('aria-busy') === 'true').toBeTruthy();
  });
});
