import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExecutiveDashboard from '../ExecutiveDashboard';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Navigate: ({ to }) => <div>Redirected to {to}</div>,
}));

describe('ExecutiveDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('customerTier', 'healthcare');
    localStorage.setItem('orgName', 'TriNetX');
    localStorage.setItem('userEmail', 'matthew.matturro@trinetx.com');

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/users') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ email: 'matthew.matturro@trinetx.com', role: 'admin' }],
        });
      }
      if (url === '/api/executive/summary') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            org_name: 'TriNetX',
            frameworks: [
              { id: 'hipaa', score: 84, high_findings: 4, trend: [71, 74, 76, 79, 81, 83, 84] },
              { id: 'soc2', score: 76, high_findings: 6, trend: [68, 71, 74, 76] },
              { id: 'pcidss', score: 91, high_findings: 1, trend: [85, 87, 89, 91] },
            ],
            open_findings_count: 11,
            last_assessed: new Date().toISOString(),
          }),
        });
      }
      if (url === '/api/hipaa/findings') {
        return Promise.resolve({ ok: true, json: async () => [{ severity: 'critical' }, { severity: 'high' }, { severity: 'high' }] });
      }
      if (url === '/api/soc2/findings') {
        return Promise.resolve({ ok: true, json: async () => [{ severity: 'high' }, { severity: 'medium' }] });
      }
      if (url === '/api/pcidss/findings') {
        return Promise.resolve({ ok: true, json: async () => [{ severity: 'critical' }] });
      }
      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders executive hero and framework scorecards for admin users', async () => {
    render(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/TriNetX Compliance Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Open Findings by Severity/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download Board Report/i })).toBeInTheDocument();
    });
  });

  it('navigates to compliance dashboard and sets active framework when framework card is clicked', async () => {
    render(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /HIPAA trend sparkline/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /HIPAA trend sparkline/i }));

    expect(localStorage.getItem('active_framework')).toBe('hipaa');
    expect(mockNavigate).toHaveBeenCalledWith('/hipaa-dashboard');
  });

  it('redirects non-admin users to dashboard', async () => {
    localStorage.setItem('userEmail', 'viewer@trinetx.com');
    globalThis.fetch.mockImplementation((url) => {
      if (url === '/api/users') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ email: 'viewer@trinetx.com', role: 'viewer' }],
        });
      }
      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    render(<ExecutiveDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Redirected to \/dashboard/i)).toBeInTheDocument();
    });
  });
});
