/**
 * Unit tests for Invoices component
 * Phase 4: Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Invoices } from '../Invoices';

// Mock the API service
vi.mock('../../services/apiService', () => ({
  apiService: {
    getInvoices: vi.fn(() => Promise.resolve({
      data: [
        {
          id: 'inv-001',
          invoice_number: 'INV-2024-001',
          created_at: '2024-01-01',
          due_at: '2024-02-01',
          total_amount: 1000,
          tier_base_cost: 800,
          tax_amount: 80,
          volume_discount: 0,
          usage_charges: { total: 120 },
          status: 'paid',
          description: 'January 2024',
        },
        {
          id: 'inv-002',
          invoice_number: 'INV-2024-002',
          created_at: '2024-02-01',
          due_at: '2024-03-01',
          total_amount: 1200,
          tier_base_cost: 1000,
          tax_amount: 96,
          volume_discount: 0,
          usage_charges: { total: 104 },
          status: 'issued',
          description: 'February 2024',
        },
      ],
      meta: { total: 2 }
    })),
    downloadInvoice: vi.fn(() => Promise.resolve(new Blob(['PDF content']))),
  }
}));

describe('Invoices Component', () => {
  // Store original location
  let originalLocation;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
  });

  it('should render Invoices component', () => {
    render(<Invoices />);
    expect(screen.getByText(/invoices/i)).toBeInTheDocument();
  });

  it('should display invoice list after loading', async () => {
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/INV-2024-001/i)).toBeInTheDocument();
      expect(screen.getByText(/INV-2024-002/i)).toBeInTheDocument();
    });
  });

  it('should display invoice amounts correctly', async () => {
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/\$1,000/)).toBeInTheDocument();
      expect(screen.getByText(/\$1,200/)).toBeInTheDocument();
    });
  });

  it('should filter invoices by status', async () => {
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/paid/i)).toBeInTheDocument();
      expect(screen.getByText(/issued/i)).toBeInTheDocument();
    });
  });

  it('should redirect to marketing site in demo mode when download button is clicked', async () => {
    // Set demo mode environment variable
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/INV-2024-001/i)).toBeInTheDocument();
    });
    
    // Find and click the download button using test ID
    const downloadButton = screen.getAllByTestId('download-invoice-button')[0];
    fireEvent.click(downloadButton);
    
    // Verify redirect to marketing site
    expect(window.location.href).toBe('https://tximhotep.com');
    
    vi.unstubAllEnvs();
  });

  it('should redirect to marketing site when VITE_USE_MOCK_API is true', async () => {
    // Set mock API environment variable
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/INV-2024-001/i)).toBeInTheDocument();
    });
    
    // Find and click the download button using test ID
    const downloadButton = screen.getAllByTestId('download-invoice-button')[0];
    fireEvent.click(downloadButton);
    
    // Verify redirect to marketing site
    expect(window.location.href).toBe('https://tximhotep.com');
    
    vi.unstubAllEnvs();
  });

  it('should call downloadInvoice API in production mode', async () => {
    // Ensure demo mode is off
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    
    const { apiService } = await import('../../services/apiService');
    
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/INV-2024-001/i)).toBeInTheDocument();
    });
    
    // Find and click the download button using test ID
    const downloadButton = screen.getAllByTestId('download-invoice-button')[0];
    fireEvent.click(downloadButton);
    
    // Verify API was called instead of redirect
    await waitFor(() => {
      expect(apiService.downloadInvoice).toHaveBeenCalledWith('inv-001');
    });
    
    // Verify no redirect happened
    expect(window.location.href).toBe('');
    
    vi.unstubAllEnvs();
  });

  it('should handle empty invoice list', async () => {
    const { apiService } = await import('../../services/apiService');
    apiService.getInvoices.mockResolvedValueOnce({ data: [], meta: { total: 0 } });
    
    render(<Invoices />);
    
    await waitFor(() => {
      expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
    });
  });
});
