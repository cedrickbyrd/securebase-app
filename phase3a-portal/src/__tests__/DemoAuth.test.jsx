import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../components/Login';
import { MockAuthService } from '../mocks/mockAuth';

/**
 * Mock Authentication Tests
 * 
 * Tests for demo authentication functionality:
 * - MockAuthService login/logout
 * - Login component in demo mode
 * - Credential validation
 * - Token storage
 */

describe('MockAuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new MockAuthService();
  });

  it('should authenticate with demo credentials', async () => {
    const result = await authService.login({ username: 'demo', password: 'demo' });
    
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.token).toBe('demo-token-000');
    expect(result.user.username).toBe('demo');
    expect(result.user.email).toBe('demo@securebase.io');
  });

  it('should reject invalid credentials', async () => {
    await expect(
      authService.login({ username: 'wrong', password: 'wrong' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('should reject wrong password', async () => {
    await expect(
      authService.login({ username: 'demo', password: 'wrong' })
    ).rejects.toThrow('Invalid credentials');
  });

  it('should successfully logout', async () => {
    const result = await authService.logout();
    expect(result.success).toBe(true);
  });

  it('should validate demo token with whoami', async () => {
    const user = await authService.whoami('demo-token-000');
    expect(user).toBeTruthy();
    expect(user.username).toBe('demo');
  });

  it('should reject invalid token with whoami', async () => {
    const user = await authService.whoami('invalid-token');
    expect(user).toBeNull();
  });

  it('should simulate network latency on login', async () => {
    const startTime = Date.now();
    await authService.login({ username: 'demo', password: 'demo' });
    const elapsed = Date.now() - startTime;
    
    // Should take at least 200ms (250ms delay minus execution time)
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });
});

describe('Login Component - Demo Mode', () => {
  const mockNavigate = vi.fn();
  
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetAllMocks();
    
    // Mock useNavigate
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    // Set demo mode environment variable
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
  });

  it('should render username and password fields in demo mode', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByText(/demo mode active/i)).toBeInTheDocument();
  });

  it('should show demo credentials hint', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText(/demo\/demo/i)).toBeInTheDocument();
  });

  it('should successfully login with demo credentials', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'demo');
    await user.type(passwordInput, 'demo');
    await user.click(submitButton);

    await waitFor(() => {
      expect(sessionStorage.getItem('demo_token')).toBe('demo-token-000');
      expect(sessionStorage.getItem('demo_user')).toBeTruthy();
    });

    // Check for success message
    expect(screen.getByText(/authentication successful/i)).toBeInTheDocument();
  });

  it('should show error with invalid credentials', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(usernameInput, 'wrong');
    await user.type(passwordInput, 'wrong');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    // Token should not be stored
    expect(sessionStorage.getItem('demo_token')).toBeNull();
  });

  it('should disable submit button when fields are empty', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toBeDisabled();
  });

  it('should toggle password visibility', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find and click the eye icon button
    const toggleButton = passwordInput.parentElement.querySelector('button');
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
