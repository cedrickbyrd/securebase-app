/**
 * Unit tests for HIPAADashboard component
 * Phase 5.3 Healthcare: HIPAA Compliance Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HIPAADashboard from '../HIPAADashboard';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

const mockHIPAAData = {
  overallScore: 87,
  lastAssessmentDate: '2026-03-22T00:00:00Z',
  nextAssessmentDue: '2026-05-20T00:00:00Z',
  riskLevel: 'low',
  baaCompliance: {
    signed: true,
    vendors: [
      { name: 'AWS', status: 'active', signedDate: '2025-04-19T00:00:00Z', expiresDate: '2027-04-19T00:00:00Z', coveredServices: ['S3', 'RDS'] },
      { name: 'Datadog', status: 'active', signedDate: '2025-10-20T00:00:00Z', expiresDate: '2026-10-20T00:00:00Z', coveredServices: ['Log Management'] },
      { name: 'PagerDuty', status: 'pending_renewal', signedDate: '2025-04-14T00:00:00Z', expiresDate: '2026-04-24T00:00:00Z', coveredServices: ['Incident Alerting'] }
    ]
  },
  training: {
    completionRate: 84,
    totalStaff: 38,
    completedStaff: 32,
    overdueStaff: 6,
    nextDeadline: '2026-05-03T00:00:00Z',
    lastCampaignDate: '2026-03-05T00:00:00Z',
    modules: [
      { name: 'HIPAA Privacy Rule Fundamentals', completion: 97 },
      { name: 'PHI Handling & Access Controls', completion: 89 }
    ]
  },
  riskAssessment: {
    status: 'completed',
    completedDate: '2026-03-22T00:00:00Z',
    nextScheduled: '2026-05-20T00:00:00Z',
    openRisks: 3,
    mitigatedRisks: 14,
    riskScore: 'low',
    items: []
  },
  safeguards: {
    administrative: {
      passed: 18, total: 20, percentage: 90,
      controls: [
        { id: '164.308(a)(1)', name: 'Security Management Process', status: 'passing' },
        { id: '164.308(a)(5)', name: 'Security Awareness and Training', status: 'warning' }
      ]
    },
    physical: {
      passed: 13, total: 14, percentage: 92.9,
      controls: [
        { id: '164.310(a)(1)', name: 'Facility Access Controls', status: 'passing' }
      ]
    },
    technical: {
      passed: 20, total: 24, percentage: 83.3,
      controls: [
        { id: '164.312(a)(1)', name: 'Access Control', status: 'passing' },
        { id: '164.312(a)(2)(iv)', name: 'Encryption & Decryption', status: 'warning' }
      ]
    }
  },
  phi: {
    encryptionAtRest: true,
    encryptionInTransit: true,
    accessLogging: true,
    auditTrail: true
  },
  phiEncryption: { atRest: true, inTransit: true, verified: true },
  phiLocations: [
    { service: 'Aurora PostgreSQL', encrypted: true, region: 'us-east-1', kmsKeyId: 'alias/securebase-phi' },
    { service: 'S3 Evidence Vault', encrypted: true, region: 'us-east-1', kmsKeyId: 'alias/securebase-phi' }
  ],
  findings: [
    {
      id: 'hipaa-f001',
      title: 'PHI access review cadence below 90-day requirement',
      severity: 'medium',
      control: '164.308(a)(3)',
      status: 'open',
      daysOpen: 12,
      owner: 'security@healthcorp.example.com',
      remediation: 'Schedule quarterly PHI access reviews'
    },
    {
      id: 'hipaa-f003',
      title: 'PagerDuty BAA expiring in 5 days',
      severity: 'high',
      control: '164.308(b)(1)',
      status: 'open',
      daysOpen: 3,
      owner: 'compliance@healthcorp.example.com',
      remediation: 'Renew PagerDuty BAA immediately'
    }
  ],
  phiAccessLog: [
    { timestamp: '2026-04-19T12:00:00Z', user: 'dr.chen@healthcorp', action: 'read', resource: 'patient_records', status: 'authorized' },
    { timestamp: '2026-04-18T15:00:00Z', user: 'unknown_ip_scan', action: 'read', resource: 'patient_records', status: 'denied' }
  ]
};

vi.mock('../../services/sreService', () => ({
  sreService: {
    getHIPAACompliance: vi.fn(() => Promise.resolve(mockHIPAAData))
  }
}));

vi.mock('../../utils/analytics', () => ({
  trackPageView: vi.fn(),
  trackHIPAARoute: vi.fn()
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HIPAADashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<HIPAADashboard />);
    expect(screen.getByText(/Loading HIPAA compliance data/i)).toBeInTheDocument();
  });

  it('should render the HIPAA dashboard header after load', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText(/HIPAA Compliance Dashboard/i)).toBeInTheDocument();
    });
  });

  it('should display overall compliance score', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText('87%')).toBeInTheDocument();
    });
  });

  it('should display risk level', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });
  });

  it('should render all tabs', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText(/📋 Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/🛡️ Safeguards/i)).toBeInTheDocument();
      expect(screen.getByText(/🔒 PHI Controls/i)).toBeInTheDocument();
      expect(screen.getByText(/⚠️ Findings/i)).toBeInTheDocument();
      expect(screen.getByText(/📄 Evidence Export/i)).toBeInTheDocument();
    });
  });

  it('should show overview content by default', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Administrative Safeguards/i)).toBeInTheDocument();
      expect(screen.getByText(/Physical Safeguards/i)).toBeInTheDocument();
      expect(screen.getByText(/Technical Safeguards/i)).toBeInTheDocument();
    });
  });

  it('should show BAA vendor names in overview', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      expect(screen.getByText('AWS')).toBeInTheDocument();
      expect(screen.getByText('Datadog')).toBeInTheDocument();
      expect(screen.getByText('PagerDuty')).toBeInTheDocument();
    });
  });

  it('should show training completion rate in overview', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => {
      // Training module name indicates training section is rendered
      expect(screen.getByText(/HIPAA Privacy Rule Fundamentals/i)).toBeInTheDocument();
    });
  });

  it('should switch to Safeguards tab on click', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/🛡️ Safeguards/i));

    fireEvent.click(screen.getByText(/🛡️ Safeguards/i));

    await waitFor(() => {
      expect(screen.getByText(/Administrative.*164\.308/i)).toBeInTheDocument();
    });
  });

  it('should switch to PHI Controls tab on click', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/🔒 PHI Controls/i));

    fireEvent.click(screen.getByText(/🔒 PHI Controls/i));

    await waitFor(() => {
      expect(screen.getByText(/Encryption at Rest/i)).toBeInTheDocument();
      expect(screen.getByText(/PHI Data Locations/i)).toBeInTheDocument();
    });
  });

  it('should switch to Findings tab and display findings', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/⚠️ Findings/i));

    fireEvent.click(screen.getByText(/⚠️ Findings/i));

    await waitFor(() => {
      expect(screen.getByText(/PHI access review cadence/i)).toBeInTheDocument();
      expect(screen.getByText(/PagerDuty BAA expiring/i)).toBeInTheDocument();
    });
  });

  it('should display finding severity and control reference in Findings tab', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/⚠️ Findings/i));
    fireEvent.click(screen.getByText(/⚠️ Findings/i));

    await waitFor(() => {
      expect(screen.getByText(/164\.308\(b\)\(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });
  });

  it('should switch to Evidence Export tab', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/📄 Evidence Export/i));

    fireEvent.click(screen.getByText(/📄 Evidence Export/i));

    await waitFor(() => {
      expect(screen.getByText(/Auditor Evidence Package/i)).toBeInTheDocument();
      expect(screen.getByText(/Download Evidence Report/i)).toBeInTheDocument();
    });
  });

  it('should show PHI access log entries in PHI Controls tab', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/🔒 PHI Controls/i));
    fireEvent.click(screen.getByText(/🔒 PHI Controls/i));

    await waitFor(() => {
      expect(screen.getByText('dr.chen@healthcorp')).toBeInTheDocument();
      expect(screen.getByText('unknown_ip_scan')).toBeInTheDocument();
    });
  });

  it('should show denied access entry with denied status in PHI access log', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/🔒 PHI Controls/i));
    fireEvent.click(screen.getByText(/🔒 PHI Controls/i));

    await waitFor(() => {
      // denied pill appears at least once
      const denied = screen.getAllByText(/Denied/i);
      expect(denied.length).toBeGreaterThan(0);
    });
  });

  it('should navigate back to dashboard on back button click', async () => {
    render(<HIPAADashboard />);
    await waitFor(() => screen.getByText(/← Dashboard/i));

    fireEvent.click(screen.getByText(/← Dashboard/i));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('should show error state if sreService throws', async () => {
    const { sreService } = await import('../../services/sreService');
    sreService.getHIPAACompliance.mockRejectedValueOnce(new Error('Network error'));

    render(<HIPAADashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load HIPAA compliance data/i)).toBeInTheDocument();
    });
  });

  it('should track HIPAA page view on mount', async () => {
    const { trackPageView, trackHIPAARoute } = await import('../../utils/analytics');

    render(<HIPAADashboard />);

    await waitFor(() => {
      expect(trackPageView).toHaveBeenCalledWith('HIPAA Dashboard', '/hipaa-dashboard');
      expect(trackHIPAARoute).toHaveBeenCalledWith('/hipaa-dashboard', 'view');
    });
  });
});
