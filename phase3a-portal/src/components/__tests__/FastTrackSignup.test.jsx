/**
 * Unit tests for FastTrackSignup component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../test/testUtils';
import FastTrackSignup from '../FastTrackSignup';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../services/crmService', () => ({
  submitLead: vi.fn(() => Promise.resolve({ score: 85, grade: 'HOT' })),
  getStoredLead: vi.fn(() => null),
}));

vi.mock('../../utils/analytics', () => ({
  trackLeadCapture: vi.fn(),
  trackWave3HighValueAction: vi.fn(),
  trackWave3Conversion: vi.fn(),
  getWave3Target: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

const mockFetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
);

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
  // Reset VITE env var
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test.securebase.io');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FastTrackSignup – generic (no wave3Target)', () => {
  it('renders the generic heading when no wave3Target is provided', () => {
    renderWithRouter(<FastTrackSignup />);
    expect(screen.getByText(/Get Started with SecureBase/i)).toBeInTheDocument();
  });

  it('shows the SecureBase logo link', () => {
    renderWithRouter(<FastTrackSignup />);
    expect(screen.getByText('SecureBase')).toBeInTheDocument();
  });

  it('displays all three benefit items', () => {
    renderWithRouter(<FastTrackSignup />);
    expect(screen.getByText(/Full compliance dashboard access/i)).toBeInTheDocument();
    expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
    expect(screen.getByText(/No credit card required/i)).toBeInTheDocument();
  });

  it('renders the email input and submit button', () => {
    renderWithRouter(<FastTrackSignup />);
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get instant access/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitting with an empty email', () => {
    renderWithRouter(<FastTrackSignup />);
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows a validation error for an invalid email format', () => {
    renderWithRouter(<FastTrackSignup />);
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));
    expect(screen.getByText(/valid work email/i)).toBeInTheDocument();
  });

  it('clears email validation error when the user starts typing', () => {
    renderWithRouter(<FastTrackSignup />);
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'x' },
    });
    expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wave 3 personalisation
// ---------------------------------------------------------------------------

describe('FastTrackSignup – Wave 3 personalisation', () => {
  it.each([
    ['column',  'Welcome, Column! 🎯'],
    ['mercury', 'Welcome, Mercury! 🎯'],
    ['lithic',  'Welcome, Lithic! 🎯'],
  ])('shows the correct greeting for wave3Target="%s"', (target, expectedGreeting) => {
    renderWithRouter(<FastTrackSignup wave3Target={target} />);
    expect(screen.getByText(expectedGreeting)).toBeInTheDocument();
  });

  it('falls back to the generic greeting for an unknown target', () => {
    renderWithRouter(<FastTrackSignup wave3Target="unknown_company" />);
    expect(screen.getByText(/Get Started with SecureBase/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Successful submission
// ---------------------------------------------------------------------------

describe('FastTrackSignup – successful submission', () => {
  it('calls the Netlify lead endpoint and the signup API on submit', async () => {
    renderWithRouter(<FastTrackSignup wave3Target="column" />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@column.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      // Netlify function call
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/submit-lead',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      // Magic link API call
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/signup'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows the success screen with the submitted email', async () => {
    renderWithRouter(<FastTrackSignup />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(screen.getByText(/Check your inbox!/i)).toBeInTheDocument();
      expect(screen.getByText(/user@acme\.com/i)).toBeInTheDocument();
    });
  });

  it('fires the onSuccess callback with the submitted email', async () => {
    const onSuccess = vi.fn();
    renderWithRouter(<FastTrackSignup onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ email: 'user@acme.com' });
    });
  });

  it('fires Wave 3 analytics helpers for wave3 sessions', async () => {
    const { trackWave3HighValueAction, trackWave3Conversion, trackLeadCapture } =
      await import('../../utils/analytics');

    renderWithRouter(<FastTrackSignup wave3Target="mercury" />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'cto@mercury.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(trackLeadCapture).toHaveBeenCalledWith('fast_track_signup');
      expect(trackWave3HighValueAction).toHaveBeenCalledWith('fast_track_signup');
      expect(trackWave3Conversion).toHaveBeenCalled();
    });
  });

  it('does NOT fire Wave 3 analytics for non-wave3 sessions', async () => {
    const { trackWave3HighValueAction, trackWave3Conversion, trackLeadCapture } =
      await import('../../utils/analytics');

    renderWithRouter(<FastTrackSignup />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(trackLeadCapture).toHaveBeenCalled();
    });

    expect(trackWave3HighValueAction).not.toHaveBeenCalled();
    expect(trackWave3Conversion).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Network error handling
// ---------------------------------------------------------------------------

describe('FastTrackSignup – error handling', () => {
  it('shows an error message when the Netlify function call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    renderWithRouter(<FastTrackSignup />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  it('still shows success when only the magic-link API call fails', async () => {
    // First fetch (Netlify) succeeds; second (magic link) fails
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      .mockRejectedValueOnce(new Error('API unavailable'));

    renderWithRouter(<FastTrackSignup />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'user@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /get instant access/i }));

    await waitFor(() => {
      expect(screen.getByText(/Check your inbox!/i)).toBeInTheDocument();
    });
  });
});
