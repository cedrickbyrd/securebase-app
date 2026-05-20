import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ComplianceTrend from '../ComplianceTrend';

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const basePayload = {
  tenant_id: 'tenant-123',
  generated_at: '2026-05-17T02:05:00Z',
  frameworks: {
    SOC2: {
      current_score: 84,
      score_delta_7d: 6,
      status: 'Passing',
      trend: 'Improving',
      history: [{ date: '2026-05-10', score: 78 }, { date: '2026-05-17', score: 84 }],
      violations: [{
        control_id: 'CC6.1',
        control_name: 'Logical and Physical Access Controls',
        rule_name: 'iam-user-mfa-enabled',
        severity: 'Critical',
        status: 'NON_COMPLIANT',
        days_failing: 3,
      }],
    },
    HIPAA: {
      current_score: 72,
      score_delta_7d: 0,
      status: 'At Risk',
      trend: 'Stable',
      history: [{ date: '2026-05-10', score: 72 }, { date: '2026-05-17', score: 72 }],
      violations: [],
    },
    FedRAMP: {
      current_score: 55,
      score_delta_7d: -5,
      status: 'Failing',
      trend: 'Declining',
      history: [{ date: '2026-05-10', score: 60 }, { date: '2026-05-17', score: 55 }],
      violations: [],
    },
  },
};

describe('ComplianceTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary cards and violation table', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => basePayload,
    });

    render(<ComplianceTrend />);

    await waitFor(() => {
      expect(screen.getByText(/compliance score trend/i)).toBeInTheDocument();
      expect(screen.getByText('SOC2')).toBeInTheDocument();
      expect(screen.getByText('HIPAA')).toBeInTheDocument();
      expect(screen.getByText('FedRAMP')).toBeInTheDocument();
      expect(screen.getByText('Control Violations')).toBeInTheDocument();
      expect(screen.getByText('CC6.1')).toBeInTheDocument();
    });
  });

  it('renders empty state when no score history exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tenant_id: 'tenant-123', generated_at: '2026-05-17T02:05:00Z', frameworks: {} }),
    });

    render(<ComplianceTrend />);

    await waitFor(() => {
      expect(screen.getByText(/your first compliance score will appear/i)).toBeInTheDocument();
    });
  });

  it('filters violations by framework', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => basePayload,
    });

    render(<ComplianceTrend />);

    await waitFor(() => expect(screen.getByText('CC6.1')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('All Frameworks'), { target: { value: 'HIPAA' } });

    await waitFor(() => {
      expect(screen.getByText(/no violations found for the selected filter/i)).toBeInTheDocument();
    });
  });
});
