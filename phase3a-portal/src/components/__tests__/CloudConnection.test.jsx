import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CloudConnection from '../CloudConnection';

const SCAN_STEP_COUNT = 5;
const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../services/apiService', () => ({
  apiService: {
    get: (...args) => getMock(...args),
    post: (...args) => postMock(...args),
  },
}));

describe('CloudConnection', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    getMock.mockResolvedValue({ status: 'not_connected' });
    postMock.mockImplementation((path) => {
      if (path === '/cloud-connection/init') {
        return Promise.resolve({
          external_id: 'ext-12345',
          securebase_principal_arn: 'arn:aws:iam::999999999999:role/SecureBasePrincipal',
        });
      }

      if (path === '/cloud-connection/verify') {
        return Promise.resolve({
          connected: true,
          account_id: '123456789012',
        });
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  });

  it('shows the locked value preview before step 1 starts', async () => {
    render(<CloudConnection />);

    expect(await screen.findByText('HIPAA Posture Score')).toBeInTheDocument();
    expect(screen.getByText('Open Findings')).toBeInTheDocument();
    expect(screen.getByText('Controls Passing')).toBeInTheDocument();
    expect(screen.getByText(/Connect your AWS environment to unlock your live HIPAA posture/i)).toBeInTheDocument();
    expect(screen.getByText('87')).toHaveStyle({ filter: 'blur(6px)', userSelect: 'none' });
  });

  it('builds a team handoff mailto link with live deployment values', async () => {
    render(<CloudConnection />);

    fireEvent.click(await screen.findByRole('button', { name: /Generate External ID/i }));

    const sendToTeamLink = await screen.findByRole('link', { name: /Send deployment instructions to my team/i });
    const mailto = sendToTeamLink.getAttribute('href');
    const decoded = decodeURIComponent(mailto);

    expect(decoded).toContain('SecureBase AWS Role Deployment — Action Required');
    expect(decoded).toContain('CloudFormation template URL: https://securebase-public-assets.s3.amazonaws.com/cf-templates/securebase-readonly-role.json');
    expect(decoded).toContain('Stack name: SecureBaseReadOnlyRole');
    expect(decoded).toContain('External ID: ext-12345');
    expect(decoded).toContain('SecureBase principal ARN: arn:aws:iam::999999999999:role/SecureBasePrincipal');
    expect(decoded).toContain('CloudFormation → Stacks → SecureBaseReadOnlyRole → Outputs → RoleArn');
    expect(decoded).toContain('read-only, has no write permissions, and all access is auditable via CloudTrail');
  });

  it('animates the scan checklist after a successful verification', async () => {
    vi.useFakeTimers();
    render(<CloudConnection />);

    fireEvent.click(await screen.findByRole('button', { name: /Generate External ID/i }));

    fireEvent.change(await screen.findByPlaceholderText(/arn:aws:iam::123456789012:role\/SecureBaseReadOnlyRole/i), {
      target: { value: 'arn:aws:iam::123456789012:role/SecureBaseReadOnlyRole' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify Connection/i }));

    expect(await screen.findByText('Connection established')).toBeInTheDocument();
    expect(screen.getByText('Role verified')).toBeInTheDocument();
    expect(screen.getByText('Analyzing IAM policies')).toBeInTheDocument();
    expect(screen.getByText('Scan in progress')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1800 * SCAN_STEP_COUNT);
    });

    await waitFor(() => {
      expect(screen.getByText(/Your HIPAA dashboard is ready — results populating now/i)).toBeInTheDocument();
    });
  });
});
