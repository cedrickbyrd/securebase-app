/**
 * Unit tests for AdminDashboard component
 * Phase 5.1: Executive/Admin Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';

// Mock the adminService
vi.mock('../../services/adminService', () => ({
  adminService: {
    getPlatformMetrics: vi.fn(() => Promise.resolve({
      customers: {
        total: 147,
        active: 142,
        churned: 5,
        growth: 12.5,
        mrr: 58400
      },
      api: {
        requests: 2800000,
        latency_p50: 45,
        latency_p95: 285,
        latency_p99: 820,
        errorRate: 0.18,
        successRate: 99.82
      },
      infrastructure: {
        lambdaColdStarts: 487,
        lambdaErrors: 15,
        dynamodbThrottles: 0,
        auroraConnections: 42,
        cacheHitRate: 78.5
      },
      security: {
        criticalAlerts: 0,
        violations: 3,
        openIncidents: 1,
        complianceScore: 97.2
      },
      costs: {
        current: 8420,
        projected: 12630,
        byService: [
          { name: 'Aurora', cost: 2840 },
          { name: 'Lambda', cost: 1920 },
          { name: 'DynamoDB', cost: 1540 }
        ],
        trend: 8.3
      },
      deployments: {
        recent: [
          {
            service: 'API Gateway',
            version: 'v2.4.1',
            environment: 'production',
            status: 'success',
            deployer: 'alice@securebase.com',
            timestamp: new Date().toISOString(),
            duration: '2m 34s'
          }
        ],
        successRate: 98.5
      }
    }))
  }
}));

// Mock SystemHealth component
vi.mock('../SystemHealth', () => ({
  default: () => <div data-testid="system-health">System Health Component</div>
}));

describe('AdminDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render AdminDashboard component', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/executive dashboard/i)).toBeInTheDocument();
  });

  it('should display platform-wide health and performance metrics subtitle', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/platform-wide health and performance metrics/i)).toBeInTheDocument();
  });

  it('should have time range selector with default 24h', () => {
    render(<AdminDashboard />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('24h');
  });

  it('should have auto-refresh toggle button', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/auto-refresh on/i)).toBeInTheDocument();
  });

  it('should have manual refresh button', () => {
    render(<AdminDashboard />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('should display customer overview section', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/customer overview/i)).toBeInTheDocument();
    });
  });

  it('should display API performance metrics', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/api performance/i)).toBeInTheDocument();
    });
  });

  it('should display infrastructure health section', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/infrastructure health/i)).toBeInTheDocument();
    });
  });

  it('should display security & compliance section', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/security & compliance/i)).toBeInTheDocument();
    });
  });

  it('should display cost analytics section', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/cost analytics/i)).toBeInTheDocument();
    });
  });

  it('should display recent deployments section', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/recent deployments/i)).toBeInTheDocument();
    });
  });

  it('should render SystemHealth component', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByTestId('system-health')).toBeInTheDocument();
    });
  });

  it('should display customer metrics after loading', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      // Check for total customers
      expect(screen.getByText('147')).toBeInTheDocument();
      // Check for MRR (in K format)
      expect(screen.getByText(/58.4K/i)).toBeInTheDocument();
    });
  });

  it('should display API latency metrics', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('45ms')).toBeInTheDocument(); // P50
      expect(screen.getByText('285ms')).toBeInTheDocument(); // P95
      expect(screen.getByText('820ms')).toBeInTheDocument(); // P99
    });
  });

  it('should display security compliance score', async () => {
    render(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('97.2%')).toBeInTheDocument();
    });
  });

  it('should toggle auto-refresh when button is clicked', async () => {
    render(<AdminDashboard />);
    
    const autoRefreshButton = screen.getByText(/auto-refresh on/i);
    fireEvent.click(autoRefreshButton);
    
    await waitFor(() => {
      expect(screen.getByText(/auto-refresh off/i)).toBeInTheDocument();
    });
  });

  it('should change time range when selector is changed', async () => {
    render(<AdminDashboard />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '7d' } });
    
    expect(select.value).toBe('7d');
  });

  it('should display last updated timestamp', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  it('should handle error gracefully when API fails', async () => {
    // Mock the service to fail
    const mockService = await import('../../services/adminService');
    mockService.adminService.getPlatformMetrics.mockRejectedValueOnce(new Error('API Error'));
    
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<AdminDashboard />);
    
    await waitFor(() => {
      // Component should still render without crashing
      expect(screen.getByText(/executive dashboard/i)).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });
});
