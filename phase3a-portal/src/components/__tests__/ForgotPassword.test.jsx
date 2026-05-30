import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../../test/testUtils';
import ForgotPassword, { maskEmail } from '../ForgotPassword';

const postMock = vi.fn();
const forgotPasswordMock = vi.fn();

vi.mock('../../services/apiService', () => ({
  apiService: {
    post: (...args) => postMock(...args),
    forgotPassword: (...args) => forgotPasswordMock(...args),
  },
}));

vi.mock('../../config/branding', () => ({
  default: {
    supportEmail: 'support@test.example.com',
    productShortName: 'TestApp',
    productName: 'TestApp',
    year: 2026,
    copyrightHolder: 'Test Company',
  },
}));

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({ ok: true });
    forgotPasswordMock.mockResolvedValue({ ok: true });
  });

  it('shows success copy with 24-hour TTL and no 30-minute text', async () => {
    renderWithRouter(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });

    expect(forgotPasswordMock).toHaveBeenCalledWith('user@example.com');
    expect(screen.getByText(/24 hours|24h/i)).toBeInTheDocument();
    expect(screen.queryByText(/30 minutes/i)).not.toBeInTheDocument();
  });

  it('uses BRANDING.supportEmail in support link after success', async () => {
    renderWithRouter(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'support@test.example.com' })).toBeInTheDocument();
    });

    const supportLink = screen.getByRole('link', { name: 'support@test.example.com' });
    expect(supportLink).toHaveAttribute('href', 'mailto:support@test.example.com');
  });

  it('masks the email shown in success state', async () => {
    renderWithRouter(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText('****@example.com')).toBeInTheDocument();
    });

    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });
});

describe('maskEmail', () => {
  it('returns masked email for valid email strings', () => {
    expect(maskEmail('user@company.com')).toBe('****@company.com');
  });

  it('handles invalid inputs without throwing', () => {
    expect(maskEmail('')).toBe('****');
    expect(maskEmail('invalid-email')).toBe('****');
    expect(maskEmail('@domain.com')).toBe('****');
    expect(maskEmail('user@')).toBe('****');
    expect(maskEmail(null)).toBe('****');
  });
});
