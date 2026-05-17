import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../admin/AdminDashboard';
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
    getVaultSummary: vi.fn(),
  },
}));

vi.mock('../admin/SystemHealth', () => ({
  default: () => <div data-testid="system-health-widget">System health widget</div>,
}));

vi.mock('../admin/AlertingDashboard', () => ({
  default: () => <div data-testid="alerting-dashboard-widget">Alerting dashboard</div>,
}));

const vaultPayload = {
  totalPackages: 47,
  totalSizeBytes: 831000000,
  packagerSuccessRate24h: 98.3,
  lastPackage: {
    tenantId: 'blue-cross',
    tenantName: 'Blue Cross Healthcare',
    createdAt: new Date('2026-05-17T10:00:00Z').toISOString(),
  },
  tenants: [
    {
      tenantId: 'blue-cross',
      tenantName: 'Blue Cross Healthcare',
      packageCount: 14,
      lastGenerated: new Date('2026-05-17T10:00:00Z').toISOString(),
      totalSizeBytes: 280000000,
      frameworks: ['HIPAA', 'SOC2'],
      packages: [
        { id: 'pkg-1', packageName: 'hipaa-2026-04-30', framework: 'HIPAA', sizeBytes: 42000000, status: 'complete', createdAt: new Date('2026-05-17T10:00:00Z').toISOString() },
      ],
    },
    {
      tenantId: 'goldman-fin',
      tenantName: 'Goldman Financial',
      packageCount: 18,
      lastGenerated: new Date('2026-05-16T08:00:00Z').toISOString(),
      totalSizeBytes: 360000000,
      frameworks: ['SOC2', 'FedRAMP'],
      packages: [],
    },
  ],
};

const basePayload = {
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

const setupMocks = (overrides = {}) => {
  adminService.getSystemOverview.mockResolvedValue(overrides.overview ?? basePayload.overview);
  adminService.getInfrastructureHealth.mockResolvedValue(overrides.infrastructure ?? basePayload.infrastructure);
  adminService.getSecurityMetrics.mockResolvedValue(overrides.security ?? basePayload.security);
  adminService.getCustomerAnalytics.mockResolvedValue(overrides.customers ?? basePayload.customers);
  adminService.getCostManagement.mockResolvedValue(overrides.costs ?? basePayload.costs);
  adminService.getOperationsStatus.mockResolvedValue(overrides.operations ?? basePayload.operations);
  adminService.getRecentAlerts.mockResolvedValue(overrides.alerts ?? basePayload.alerts);
  adminService.getVaultSummary.mockResolvedValue(overrides.vault ?? vaultPayload);
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
    adminService.getSystemOverview.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    adminService.getInfrastructureHealth.mockResolvedValue(basePayload.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(basePayload.security);
    adminService.getCustomerAnalytics.mockResolvedValue(basePayload.customers);
    adminService.getCostManagement.mockResolvedValue(basePayload.costs);
    adminService.getOperationsStatus.mockResolvedValue(basePayload.operations);
    adminService.getRecentAlerts.mockResolvedValue(basePayload.alerts);
    adminService.getVaultSummary.mockResolvedValue(vaultPayload);
    renderDashboard();
    expect(screen.getByText(/loading executive dashboard/i)).toBeInTheDocument();
    release(basePayload.overview);
  });

  it('shows error state when fetch fails', async () => {
    adminService.getSystemOverview.mockRejectedValue(new Error('boom'));
    adminService.getInfrastructureHealth.mockResolvedValue(basePayload.infrastructure);
    adminService.getSecurityMetrics.mockResolvedValue(basePayload.security);
    adminService.getCustomerAnalytics.mockResolvedValue(basePayload.customers);
    adminService.getCostManagement.mockResolvedValue(basePayload.costs);
    adminService.getOperationsStatus.mockResolvedValue(basePayload.operations);
    adminService.getRecentAlerts.mockResolvedValue(basePayload.alerts);
    adminService.getVaultSummary.mockResolvedValue(vaultPayload);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/unable to refresh admin metrics/i)).toBeInTheDocument();
    });
  });

  it('renders all required sections including vault on success', async () => {
    setupMocks();
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
      expect(screen.getByText(/evidence vault overview/i)).toBeInTheDocument();
      expect(screen.getByText(/per-tenant vault/i)).toBeInTheDocument();
    });
  });

  it('renders vault overview metrics correctly', async () => {
    setupMocks();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/total packages/i)).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument();
      expect(screen.getByText(/total vault size/i)).toBeInTheDocument();
      expect(screen.getByText(/831\.0 mb/i)).toBeInTheDocument();
      expect(screen.getByText(/packager success rate/i)).toBeInTheDocument();
      expect(screen.getByText(/98\.3%/i)).toBeInTheDocument();
    });
  });

  it('renders per-tenant vault table rows', async () => {
    setupMocks();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Blue Cross Healthcare')).toBeInTheDocument();
      expect(screen.getByText('Goldman Financial')).toBeInTheDocument();
    });
  });

  it('expands a tenant row to show packages on click', async () => {
    setupMocks();
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Blue Cross Healthcare')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Blue Cross Healthcare'));

    await waitFor(() => {
      expect(screen.getByText('hipaa-2026-04-30')).toBeInTheDocument();
    });
  });

  it('polls on a 60 second interval', async () => {
    vi.useFakeTimers();
    setupMocks();

    renderDashboard();
    await waitFor(() => expect(adminService.getSystemOverview).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60000);
    await waitFor(() => expect(adminService.getSystemOverview).toHaveBeenCalledTimes(2));
  });
});
