/**
 * Unit tests for SignupForm component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../test/testUtils';
import SignupForm from '../SignupForm';

vi.mock('../../services/apiService', () => ({
  apiService: {
    signup: vi.fn((payload) => {
      if (payload.email === 'exists@example.com') {
        return Promise.reject(new Error('HTTP error! status: 409'));
      }
      return Promise.resolve({ customer_id: 'test-uuid-123' });
    }),
  },
}));

describe('SignupForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the first step by default', () => {
    renderWithRouter(<SignupForm />);
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
  });

  it('displays step indicators', () => {
    renderWithRouter(<SignupForm />);
    expect(screen.getByText(/account/i)).toBeInTheDocument();
    expect(screen.getByText(/organization/i)).toBeInTheDocument();
    expect(screen.getByText(/configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/verify/i)).toBeInTheDocument();
  });

  it('shows validation errors when Next is clicked with empty step 1 fields', () => {
    renderWithRouter(<SignupForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
  });

  it('shows email validation error for invalid email', () => {
    renderWithRouter(<SignupForm />);
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { name: 'firstName', value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { name: 'lastName', value: 'Smith' },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { name: 'email', value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { name: 'password', value: 'SuperSecret123!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { name: 'confirmPassword', value: 'SuperSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', () => {
    renderWithRouter(<SignupForm />);
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { name: 'firstName', value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { name: 'lastName', value: 'Smith' },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { name: 'email', value: 'jane@acme.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { name: 'password', value: 'SuperSecret123!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { name: 'confirmPassword', value: 'SuperSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/tell us about your organization/i)).toBeInTheDocument();
  });

  it('shows a Back button on step 2', () => {
    renderWithRouter(<SignupForm />);
    // Advance to step 2
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { name: 'firstName', value: 'Jane' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { name: 'lastName', value: 'Smith' },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { name: 'email', value: 'jane@acme.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { name: 'password', value: 'SuperSecret123!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { name: 'confirmPassword', value: 'SuperSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});
