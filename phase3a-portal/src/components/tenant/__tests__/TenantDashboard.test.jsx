/**
 * Unit tests for TenantDashboard component
 * Phase 5.2: Tenant/Customer Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TenantDashboard from '../TenantDashboard';

describe('TenantDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render TenantDashboard component with header', () => {
    render(<TenantDashboard />);
    expect(screen.getByText(/customer dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/real-time compliance, usage & cost insights/i)).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<TenantDashboard />);
    expect(screen.getByText(/loading dashboard metrics/i)).toBeInTheDocument();
  });

  it('should display compliance score after loading', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/94.5%/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should render violations breakdown', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/active violations/i)).toBeInTheDocument();
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });
  });

  it('should display framework compliance cards', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/soc2/i)).toBeInTheDocument();
      expect(screen.getByText(/hipaa/i)).toBeInTheDocument();
      expect(screen.getByText(/pci/i)).toBeInTheDocument();
      expect(screen.getByText(/gdpr/i)).toBeInTheDocument();
    });
  });

  it('should show API calls metrics', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/api calls this month/i)).toBeInTheDocument();
      expect(screen.getByText(/45.3k/i)).toBeInTheDocument();
      expect(screen.getByText(/success rate: 99.82%/i)).toBeInTheDocument();
    });
  });

  it('should display storage metrics', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/data stored/i)).toBeInTheDocument();
      expect(screen.getByText(/documents:/i)).toBeInTheDocument();
      expect(screen.getByText(/evidence:/i)).toBeInTheDocument();
      expect(screen.getByText(/logs:/i)).toBeInTheDocument();
    });
  });

  it('should show compute hours section', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/compute hours/i)).toBeInTheDocument();
      expect(screen.getByText(/lambda execution/i)).toBeInTheDocument();
      expect(screen.getByText(/db query time/i)).toBeInTheDocument();
      expect(screen.getByText(/avg response time/i)).toBeInTheDocument();
    });
  });

  it('should display current month spend', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/current month spend/i)).toBeInTheDocument();
      expect(screen.getByText(/\$1,245.67/i)).toBeInTheDocument();
    });
  });

  it('should show forecasted costs', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/forecasted: \$1,580.34/i)).toBeInTheDocument();
    });
  });

  it('should display cost breakdown by service', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/cost by service/i)).toBeInTheDocument();
    });
  });

  it('should show usage vs plan limits', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/usage vs plan limits/i)).toBeInTheDocument();
    });
  });

  it('should display top API endpoints table', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/top api endpoints/i)).toBeInTheDocument();
      expect(screen.getByText(/\/api\/compliance\/check/i)).toBeInTheDocument();
      expect(screen.getByText(/\/api\/evidence\/upload/i)).toBeInTheDocument();
    });
  });

  it('should render configuration audit trail', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/configuration audit trail/i)).toBeInTheDocument();
      expect(screen.getByText(/timestamp/i)).toBeInTheDocument();
      expect(screen.getByText(/changed by/i)).toBeInTheDocument();
      expect(screen.getByText(/resource/i)).toBeInTheDocument();
      expect(screen.getByText(/action/i)).toBeInTheDocument();
      expect(screen.getByText(/status/i)).toBeInTheDocument();
    });
  });

  it('should display active alerts section', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/2 active/i)).toBeInTheDocument();
    });
  });

  it('should show alert details with severity', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/critical compliance violation detected/i)).toBeInTheDocument();
      expect(screen.getByText(/password policy weakened below soc 2 requirements/i)).toBeInTheDocument();
    });
  });

  it('should display alert action buttons', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      const viewDetailsButtons = screen.getAllByText(/view details/i);
      expect(viewDetailsButtons.length).toBeGreaterThan(0);
      
      const acknowledgeButtons = screen.getAllByText(/acknowledge/i);
      expect(acknowledgeButtons.length).toBeGreaterThan(0);
    });
  });

  it('should have time range selector', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText(/last 7 days/i)).toBeInTheDocument();
      expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
      expect(screen.getByText(/last 90 days/i)).toBeInTheDocument();
    });
  });

  it('should have export report button', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/export report/i)).toBeInTheDocument();
    });
  });

  it('should display last updated timestamp', async () => {
    render(<TenantDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    });
  });
});
