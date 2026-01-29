/**
 * Unit tests for SystemHealth component
 * Phase 5.1: Executive/Admin Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SystemHealth from '../SystemHealth';

describe('SystemHealth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SystemHealth component', () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    expect(screen.getByText(/service status/i)).toBeInTheDocument();
  });

  it('should display service status section', () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    expect(screen.getByText(/service status/i)).toBeInTheDocument();
  });

  it('should display regional health section', () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    expect(screen.getByText(/regional health/i)).toBeInTheDocument();
  });

  it('should display overall system health summary', () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    expect(screen.getByText(/overall system health/i)).toBeInTheDocument();
  });

  it('should show loading state when loading prop is true', () => {
    render(<SystemHealth timeRange="24h" loading={true} />);
    
    // Check for loading skeleton
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display service cards when not loading', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/api gateway/i)).toBeInTheDocument();
      expect(screen.getByText(/lambda functions/i)).toBeInTheDocument();
      expect(screen.getByText(/dynamodb/i)).toBeInTheDocument();
      expect(screen.getByText(/aurora \(primary\)/i)).toBeInTheDocument();
    });
  });

  it('should display uptime percentages for services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/99.98% uptime/i)).toBeInTheDocument();
      expect(screen.getByText(/99.95% uptime/i)).toBeInTheDocument();
      expect(screen.getByText(/99.99% uptime/i)).toBeInTheDocument();
    });
  });

  it('should show operational status for healthy services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      const operationalElements = screen.getAllByText(/operational/i);
      expect(operationalElements.length).toBeGreaterThan(0);
    });
  });

  it('should show degraded status for unhealthy services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/degraded/i)).toBeInTheDocument();
    });
  });

  it('should display region information', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/us-east-1/i)).toBeInTheDocument();
      expect(screen.getByText(/us-west-2/i)).toBeInTheDocument();
    });
  });

  it('should display regional latency metrics', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/45ms/i)).toBeInTheDocument(); // us-east-1 latency
      expect(screen.getByText(/52ms/i)).toBeInTheDocument(); // us-west-2 latency
    });
  });

  it('should display active incidents when they exist', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/active incidents/i)).toBeInTheDocument();
      expect(screen.getByText(/elasticache intermittent connection timeouts/i)).toBeInTheDocument();
    });
  });

  it('should display incident severity levels', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
    });
  });

  it('should display incident status', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/investigating/i)).toBeInTheDocument();
    });
  });

  it('should show affected services in incident details', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/affected services: elasticache, api gateway/i)).toBeInTheDocument();
    });
  });

  it('should display overall availability percentage', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      // 7 out of 8 services operational = 87.5%
      expect(screen.getByText(/87.5%/i)).toBeInTheDocument();
    });
  });

  it('should show correct number of operational services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/7 of 8 services operational/i)).toBeInTheDocument();
    });
  });

  it('should update when timeRange prop changes', async () => {
    const { rerender } = render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/service status/i)).toBeInTheDocument();
    });
    
    rerender(<SystemHealth timeRange="7d" loading={false} />);
    
    await waitFor(() => {
      expect(screen.getByText(/service status/i)).toBeInTheDocument();
    });
  });

  it('should display service uptime progress bars', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      // Check for progress bar elements
      const progressBars = document.querySelectorAll('.h-1.bg-gray-200');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  it('should use green color for high uptime services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      const greenBars = document.querySelectorAll('.bg-green-500');
      expect(greenBars.length).toBeGreaterThan(0);
    });
  });

  it('should use yellow color for degraded services', async () => {
    render(<SystemHealth timeRange="24h" loading={false} />);
    
    await waitFor(() => {
      const yellowBars = document.querySelectorAll('.bg-yellow-500');
      expect(yellowBars.length).toBeGreaterThan(0);
    });
  });
});
