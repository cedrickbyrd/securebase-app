import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeamManagement from '../components/TeamManagement';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('TeamManagement (integration smoke)', () => {
  beforeEach(() => {
    localStorage.setItem('customerTier', 'healthcare');
    localStorage.setItem('orgName', 'TriNetX');
    localStorage.setItem('userEmail', 'matthew.matturro@trinetx.com');

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/users') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'u001', name: 'Matthew Matturro', email: 'matthew.matturro@trinetx.com', role: 'admin', avatar_initials: 'MM', joined_at: '2026-04-01T00:00:00Z' },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the Team Members heading', async () => {
    render(<TeamManagement />);
    await waitFor(() => {
      expect(screen.getByText(/Team Members/i)).toBeInTheDocument();
    });
  });
});
