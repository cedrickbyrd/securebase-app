import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SystemHealth from '../admin/SystemHealth';
import { adminService } from '../../services/adminService';

vi.mock('../../services/adminService', () => ({
  adminService: {
    getSystemHealth: vi.fn(),
  },
}));

describe('SystemHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders healthy/degraded/down service statuses with color-coded indicators', async () => {
    adminService.getSystemHealth.mockResolvedValue({
      lastUpdated: new Date().toISOString(),
      services: [
        { name: 'API Gateway', status: 'healthy' },
        { name: 'Lambda metrics_aggregation', status: 'degraded' },
        { name: 'CloudFront', status: 'down' },
      ],
    });

    render(<SystemHealth refreshKey={1} />);

    await waitFor(() => {
      expect(screen.getByText('API Gateway')).toBeInTheDocument();
      expect(screen.getByText('Lambda metrics_aggregation')).toBeInTheDocument();
      expect(screen.getByText('CloudFront')).toBeInTheDocument();
    });

    expect(screen.getByTestId('status-indicator-API Gateway')).toHaveClass('bg-green-500');
    expect(screen.getByTestId('status-indicator-Lambda metrics_aggregation')).toHaveClass('bg-yellow-500');
    expect(screen.getByTestId('status-indicator-CloudFront')).toHaveClass('bg-red-500');
  });
});
