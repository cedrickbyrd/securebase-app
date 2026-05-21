import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AlertSettings from '../AlertSettings';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('AlertSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('userEmail', 'user@example.com');
    localStorage.setItem('orgName', 'Test Org');
    localStorage.removeItem('alert_settings');
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url === '/api/alerts/settings' && (!options?.method || options?.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            slack_webhook: 'https://hooks.slack.com/services/abc',
            email_notify: true,
            notify_email: 'user@example.com',
            score_drop_threshold: 5,
            notify_on_critical: true,
            notify_on_high: true,
          }),
        });
      }
      if (url === '/api/alerts/settings' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (url === '/api/alerts/test' && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    }));
  });

  it('loads alert settings from API and shows form', async () => {
    render(<AlertSettings />);

    await waitFor(() => {
      expect(screen.getByText(/🔔 Alert Settings/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://hooks.slack.com/services/abc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument();
    });
  });

  it('saves settings and sends test notification', async () => {
    render(<AlertSettings />);
    await waitFor(() => screen.getByRole('button', { name: /Save Alert Settings/i }));

    fireEvent.click(screen.getByRole('button', { name: /Send Test Notification/i }));
    await waitFor(() => {
      expect(screen.getByText(/✓ Test notification sent/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Alert Settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/✓ Alert settings saved/i)).toBeInTheDocument();
      expect(localStorage.getItem('alert_settings')).toBeTruthy();
    });
  });
});
