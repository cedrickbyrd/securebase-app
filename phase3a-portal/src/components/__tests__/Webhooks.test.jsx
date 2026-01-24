/**
 * Unit tests for Webhooks component
 * Phase 4: Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Webhooks } from '../Webhooks';

// Mock the API service
vi.mock('../../services/apiService', () => ({
  getWebhooks: vi.fn(() => Promise.resolve({
    webhooks: [
      {
        id: 'webhook-001',
        url: 'https://example.com/webhook1',
        events: ['invoice.created', 'invoice.paid'],
        status: 'active',
        created: '2024-01-10',
      },
      {
        id: 'webhook-002',
        url: 'https://example.com/webhook2',
        events: ['customer.created'],
        status: 'inactive',
        created: '2024-01-15',
      },
    ]
  })),
  createWebhook: vi.fn(() => Promise.resolve({
    id: 'webhook-003',
    url: 'https://example.com/new',
    events: ['invoice.created'],
  })),
}));

describe('Webhooks Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Webhooks component', () => {
    render(<Webhooks />);
    expect(screen.getByText(/webhooks/i)).toBeInTheDocument();
  });

  it('should display webhook list after loading', async () => {
    render(<Webhooks />);
    
    await waitFor(() => {
      expect(screen.getByText(/https:\/\/example.com\/webhook1/i)).toBeInTheDocument();
    });
  });

  it('should display webhook events', async () => {
    render(<Webhooks />);
    
    await waitFor(() => {
      expect(screen.getByText(/invoice.created/i)).toBeInTheDocument();
    });
  });

  it('should show webhook status', async () => {
    render(<Webhooks />);
    
    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });
});
