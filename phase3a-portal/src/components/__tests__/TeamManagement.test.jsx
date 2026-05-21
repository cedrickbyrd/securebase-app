import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TeamManagement from '../TeamManagement';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const apiUsers = [
  { id: 'u001', name: 'Matthew Matturro', email: 'matthew.matturro@trinetx.com', role: 'admin', avatar_initials: 'MM', joined_at: '2026-04-01T00:00:00Z' },
  { id: 'u002', name: 'Sarah Chen', email: 'sarah.chen@trinetx.com', role: 'analyst', avatar_initials: 'SC', joined_at: '2026-04-15T00:00:00Z' },
];

describe('TeamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('customerTier', 'healthcare');
    localStorage.setItem('orgName', 'TriNetX');
    localStorage.setItem('userEmail', 'matthew.matturro@trinetx.com');

    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url === '/api/users' && (!options?.method || options?.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => apiUsers });
      }
      if (url === '/api/users/invite' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (String(url).startsWith('/api/users/') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (String(url).startsWith('/api/users/') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.reject(new Error(`Unhandled fetch ${url}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders team rows and marks current user with [You]', async () => {
    render(<TeamManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Team Members/i)).toBeInTheDocument();
      expect(screen.getByText('Matthew Matturro')).toBeInTheDocument();
      expect(screen.getByText(/\[You\]/i)).toBeInTheDocument();
    });
  });

  it('shows email validation error for invalid invite input', async () => {
    render(<TeamManagement />);
    await waitFor(() => screen.getByText('Sarah Chen'));

    fireEvent.click(screen.getByRole('button', { name: /Invite Member/i }));
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }));

    expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
  });

  it('adds invite pending row even when invite API fails', async () => {
    globalThis.fetch.mockImplementation((url, options) => {
      if (url === '/api/users' && (!options?.method || options?.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => apiUsers });
      }
      if (url === '/api/users/invite' && options?.method === 'POST') {
        return Promise.reject(new Error('invite failed'));
      }
      if (String(url).startsWith('/api/users/') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (String(url).startsWith('/api/users/') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.reject(new Error(`Unhandled fetch ${url}`));
    });

    render(<TeamManagement />);
    await waitFor(() => screen.getByText('Sarah Chen'));

    fireEvent.click(screen.getByRole('button', { name: /Invite Member/i }));
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new.member@trinetx.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invite Pending/i)).toBeInTheDocument();
      expect(screen.getByText(/Invite sent to new.member@trinetx.com/i)).toBeInTheDocument();
    });
  });

  it('updates user role optimistically', async () => {
    render(<TeamManagement />);
    await waitFor(() => screen.getByText('Sarah Chen'));

    fireEvent.change(screen.getByLabelText(/Change role for Sarah Chen/i), { target: { value: 'auditor' } });

    await waitFor(() => {
      expect(screen.getByText(/✓ Role updated/i)).toBeInTheDocument();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/users/u002',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('removes user after inline confirmation', async () => {
    render(<TeamManagement />);
    await waitFor(() => screen.getByText('Sarah Chen'));

    fireEvent.click(screen.getByRole('button', { name: /Remove Sarah Chen/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(() => {
      expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/users/u002',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
