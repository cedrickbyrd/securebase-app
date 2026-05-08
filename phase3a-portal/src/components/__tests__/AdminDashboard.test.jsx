import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminDashboard from '../admin/AdminDashboard';
import { MemoryRouter } from 'react-router-dom';
import { adminService } from '../../services/adminService';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getSystemOverview: vi.fn(),
    getInfrastructureHealth: vi.fn(),
    getSecurityMetrics: vi.fn(),
    getCustomerAnalytics: vi.fn(),
    getCostManagement: vi.fn(),
    getOperationsStatus: vi.fn(),
    getRecentAlerts: vi.fn(),
  },
}));

vi.mock('../admin/SystemHealth', () => ({
  default: () => <div data-testid="system-health-widget">System health widget</div>,
}));

const getResolvedPayloads = () => ({
  overview: { activeTenants: 42, totalRevenue: 96000, uptimePercentage: 99.9, openSupportTickets: 3 },
  infrastructure: { lambdaInvocations: 250000, apiLatency: { p50: 30, p95: 80, p99: 120 }, errorRate: 0.2, cloudwatchAlarms: 1 },
  security: { complianceScores: { soc2: 98, fedramp: 95, hipaa: 97 }, failedAuthAttempts: 5, securityEvents24h: 2 },
  customers: { newSignups30d: 12, churnRate: 1.2, mrrTrend: [90000, 96000], npsScore: 55 },
  costs: { awsSpendMtd: 12000, costPerTenant: 89, savingsVsOnDemand: 22, topServicesByCost: [{ name: 'Aurora', cost: 5000 }] },
  operations: { activeDeployments: 1, failedPipelines: 0, pendingTerraformChanges: 2, lambdaColdStarts: 10 },
  alerts: [{ id: 'a1', severity: 'high', summary: 'Latency spike', source: 'CloudWatch', createdAt: new Date().toISOString() }],
});

const primeSuccessMocks = () => {
  const payloads = getResolvedPayloads();
  adminService.getSystemOverview.mockResolvedValue(payloads.overview);
  adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
  adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
  adminService.getCustomerAnalytics.mockResolvedValue(payloads.customers);
  adminService.getCostManagement.mockResolvedValue(payloads.costs);
  adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
  adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);
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
    const payloads = getResolvedPayloads();
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });

    adminService.getSystemOverview.mockReturnValue(pending);
    adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
    adminService.getCustomerAnalytics.mockResolvedValue(payloads.customers);
    adminService.getCostManagement.mockResolvedValue(payloads.costs);
    adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
    adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);

    renderDashboard();

    expect(screen.getByText(/loading executive dashboard/i)).toBeInTheDocument();
    release(payloads.overview);
  });

  it('shows error state when fetch fails', async () => {
    adminService.getSystemOverview.mockRejectedValue(new Error('boom'));
    adminService.getInfrastructureHealth.mockResolvedValue({});
    adminService.getSecurityMetrics.mockResolvedValue({});
    adminService.getCustomerAnalytics.mockResolvedValue({});
    adminService.getCostManagement.mockResolvedValue({});
    adminService.getOperationsStatus.mockResolvedValue({});
    adminService.getRecentAlerts.mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/unable to refresh admin metrics/i)).toBeInTheDocument();
    });
  });

  it('renders all seven required sections on success', async () => {
    primeSuccessMocks();

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/system overview/i)).toBeInTheDocument();
      expect(screen.getByText(/infrastructure health/i)).toBeInTheDocument();
      expect(screen.getByText(/security & compliance/i)).toBeInTheDocument();
      expect(screen.getByText(/customer analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/cost management/i)).toBeInTheDocument();
      expect(screen.getByText(/operations/i)).toBeInTheDocument();
      expect(screen.getByText(/recent alerts/i)).toBeInTheDocument();
      expect(screen.getByTestId('system-health-widget')).toBeInTheDocument();
    });
  });

  it('uses exponential backoff (30s then 60s) after a refresh error', async () => {
    vi.useFakeTimers();

    const payloads = getResolvedPayloads();
    adminService.getSystemOverview
      .mockResolvedValueOnce(payloads.overview)
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValue(payloads.overview);
    adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
    adminService.getCustomerAnalytics.mockResolvedValue(payloads.customers);
    adminService.getCostManagement.mockResolvedValue(payloads.costs);
    adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
    adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);

    renderDashboard();

    await waitFor(() => expect(adminService.getSystemOverview).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(30000);
    await waitFor(() => expect(adminService.getSystemOverview).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(30000);
    expect(adminService.getSystemOverview).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30000);
    await waitFor(() => expect(adminService.getSystemOverview).toHaveBeenCalledTimes(3));
  });

  it('renders trend unavailable when mrr trend starts at zero', async () => {
    const payloads = getResolvedPayloads();
    adminService.getSystemOverview.mockResolvedValue(payloads.overview);
    adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
    adminService.getCustomerAnalytics.mockResolvedValue({
      ...payloads.customers,
      mrrTrend: [0, 96000],
    });
    adminService.getCostManagement.mockResolvedValue(payloads.costs);
    adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
    adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Trend unavailable')).toBeInTheDocument();
    });
  });

  it('renders trend unavailable when mrr trend endpoint is invalid', async () => {
    const payloads = getResolvedPayloads();
    adminService.getSystemOverview.mockResolvedValue(payloads.overview);
    adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
    adminService.getCustomerAnalytics.mockResolvedValue({
      ...payloads.customers,
      mrrTrend: [90000, null],
    });
    adminService.getCostManagement.mockResolvedValue(payloads.costs);
    adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
    adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Trend unavailable')).toBeInTheDocument();
    });
  });

  it('does not set state after unmount when a request resolves late', async () => {
    const payloads = getResolvedPayloads();
    let resolveOverview;
    const delayedOverview = new Promise((resolve) => {
      resolveOverview = resolve;
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    adminService.getSystemOverview.mockReturnValue(delayedOverview);
    adminService.getInfrastructureHealth.mockResolvedValue(payloads.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(payloads.security);
    adminService.getCustomerAnalytics.mockResolvedValue(payloads.customers);
    adminService.getCostManagement.mockResolvedValue(payloads.costs);
    adminService.getOperationsStatus.mockResolvedValue(payloads.operations);
    adminService.getRecentAlerts.mockResolvedValue(payloads.alerts);

    const { unmount } = renderDashboard();
    unmount();

    resolveOverview(payloads.overview);
    await Promise.resolve();
    await Promise.resolve();

    const hasUnmountWarning = consoleErrorSpy.mock.calls.some((call) =>
      String(call?.[0] || '').includes("Can't perform a React state update on an unmounted component")
    );
    expect(hasUnmountWarning).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
