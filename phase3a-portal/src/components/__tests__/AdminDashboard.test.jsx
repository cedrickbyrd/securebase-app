import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../admin/AdminDashboard';
import { adminService } from '../../services/adminService';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getMetricsSnapshot: vi.fn(),
  },
}));

vi.mock('../admin/SystemHealth', () => ({
  default: () => <div data-testid="system-health-widget">System health widget</div>,
}));

const payload = {
  overview: { activeTenants: 42, totalRevenue: 96000, uptimePercentage: 99.9, openSupportTickets: 3 },
  infrastructure: { lambdaInvocations: 250000, apiLatency: { p50: 30, p95: 80, p99: 120 }, errorRate: 0.2, cloudwatchAlarms: 1 },
  security: { complianceScores: { soc2: 98, fedramp: 95, hipaa: 97 }, failedAuthAttempts: 5, securityEvents24h: 2 },
  customers: { newSignups30d: 12, churnRate: 1.2, mrrTrend: [90000, 96000], npsScore: 55 },
  costs: {
    awsSpendMtd: 12000,
    costPerTenant: 89,
    savingsVsOnDemand: 22,
    topServicesByCost: [{ name: 'Aurora', cost: 5000 }],
    tenantCostHistory: [{ tenant_id: 'tenant_a', date: '2026-05-11', totalCost: 325.12 }],
  },
  operations: { activeDeployments: 1, failedPipelines: 0, pendingTerraformChanges: 2, lambdaColdStarts: 10 },
  alerts: [{ id: 'a1', severity: 'high', summary: 'Latency spike', source: 'CloudWatch', createdAt: new Date().toISOString() }],
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('userRole', 'admin');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading skeleton on first load', () => {
    let release;
    adminService.getMetricsSnapshot.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    renderDashboard();
    expect(screen.getByText(/loading executive dashboard/i)).toBeInTheDocument();
    release(payload);
  });

  it('shows error state when fetch fails', async () => {
    adminService.getMetricsSnapshot.mockRejectedValue(new Error('boom'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/unable to refresh admin metrics/i)).toBeInTheDocument();
    });
  });

  it('renders all seven required sections on success', async () => {
    adminService.getMetricsSnapshot.mockResolvedValue(payload);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/system overview/i)).toBeInTheDocument();
      expect(screen.getByText(/infrastructure health/i)).toBeInTheDocument();
      expect(screen.getByText(/security & compliance/i)).toBeInTheDocument();
      expect(screen.getByText(/customer analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/cost management/i)).toBeInTheDocument();
      expect(screen.getByText(/cost per tenant \(daily\)/i)).toBeInTheDocument();
      expect(screen.getByText(/operations/i)).toBeInTheDocument();
      expect(screen.getByText(/recent alerts/i)).toBeInTheDocument();
      expect(screen.getByTestId('system-health-widget')).toBeInTheDocument();
    });
  });

  it('polls on a 60 second interval', async () => {
    vi.useFakeTimers();
    adminService.getMetricsSnapshot.mockResolvedValue(payload);

    renderDashboard();
    await waitFor(() => expect(adminService.getMetricsSnapshot).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(adminService.getMetricsSnapshot).toHaveBeenCalledTimes(2));
  });
});
