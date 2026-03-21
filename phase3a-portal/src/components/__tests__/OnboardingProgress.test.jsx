/**
 * Unit tests for OnboardingProgress component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../test/testUtils';
import OnboardingProgress from '../OnboardingProgress';

const MOCK_JOB = {
  job_id: 'job-uuid-001',
  customer_id: 'cust-uuid-001',
  status: 'in_progress',
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    { step_key: 'email_verified',     status: 'complete',     started_at: new Date().toISOString(), completed_at: new Date().toISOString(), error_message: null },
    { step_key: 'account_created',    status: 'complete',     started_at: new Date().toISOString(), completed_at: new Date().toISOString(), error_message: null },
    { step_key: 'account_active',     status: 'in_progress',  started_at: new Date().toISOString(), completed_at: null, error_message: null },
    { step_key: 'ou_assigned',        status: 'pending',      started_at: null, completed_at: null, error_message: null },
    { step_key: 'terraform_running',  status: 'pending',      started_at: null, completed_at: null, error_message: null },
    { step_key: 'guardrails_applied', status: 'pending',      started_at: null, completed_at: null, error_message: null },
    { step_key: 'welcome_sent',       status: 'pending',      started_at: null, completed_at: null, error_message: null },
  ],
};

vi.mock('../../services/apiService', () => ({
  apiService: {
    get: vi.fn(() => Promise.resolve(MOCK_JOB)),
  },
}));

describe('OnboardingProgress Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('customerId', 'cust-uuid-001');
  });

  it('shows a loading indicator initially', () => {
    renderWithRouter(<OnboardingProgress />);
    expect(screen.getByText(/loading onboarding status/i)).toBeInTheDocument();
  });

  it('renders step names after data loads', async () => {
    renderWithRouter(<OnboardingProgress />);
    await waitFor(() => {
      expect(screen.getByText(/environment provisioning/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    expect(screen.getByText(/aws account created/i)).toBeInTheDocument();
  });

  it('shows progress bar', async () => {
    renderWithRouter(<OnboardingProgress />);
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('renders compact variant', async () => {
    renderWithRouter(<OnboardingProgress compact />);
    await waitFor(() => {
      expect(screen.getByText(/environment setup/i)).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    const { apiService } = await import('../../services/apiService');
    apiService.get.mockRejectedValueOnce(new Error('Network error'));

    renderWithRouter(<OnboardingProgress />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
