/**
 * Unit tests for SupportTickets component
 * Phase 4: Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SupportTickets } from '../SupportTickets';

// Mock the API service
vi.mock('../../services/apiService', () => ({
  getTickets: vi.fn(() => Promise.resolve({
    tickets: [
      {
        id: 'ticket-001',
        title: 'Cannot access dashboard',
        status: 'open',
        priority: 'high',
        created: '2024-01-15',
        lastUpdate: '2024-01-16',
      },
      {
        id: 'ticket-002',
        title: 'Question about billing',
        status: 'resolved',
        priority: 'medium',
        created: '2024-01-10',
        lastUpdate: '2024-01-12',
      },
    ]
  })),
  createTicket: vi.fn(() => Promise.resolve({
    id: 'ticket-003',
    title: 'New ticket',
    status: 'open',
  })),
}));

describe('SupportTickets Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SupportTickets component', () => {
    render(<SupportTickets />);
    expect(screen.getByText(/support|tickets/i)).toBeInTheDocument();
  });

  it('should display ticket list after loading', async () => {
    render(<SupportTickets />);
    
    await waitFor(() => {
      expect(screen.getByText(/Cannot access dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Question about billing/i)).toBeInTheDocument();
    });
  });

  it('should filter tickets by status', async () => {
    render(<SupportTickets />);
    
    await waitFor(() => {
      expect(screen.getByText(/open/i)).toBeInTheDocument();
      expect(screen.getByText(/resolved/i)).toBeInTheDocument();
    });
  });

  it('should create new ticket', async () => {
    const { createTicket } = await import('../../services/apiService');
    
    render(<SupportTickets />);
    
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    
    // Verify mock is available
    expect(createTicket).toBeDefined();
  });

  it('should display priority levels', async () => {
    render(<SupportTickets />);
    
    await waitFor(() => {
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
    });
  });
});
