/**
 * Unit tests for ComplianceDrift component
 * Phase 5.2: Tenant/Customer Dashboard - Drift Detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ComplianceDrift from '../ComplianceDrift';

describe('ComplianceDrift Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render ComplianceDrift component with header', () => {
    render(<ComplianceDrift />);
    expect(screen.getByText(/compliance drift detection/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive timeline showing when controls drift/i)).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<ComplianceDrift />);
    expect(screen.getByText(/loading drift detection data/i)).toBeInTheDocument();
  });

  it('should render filter section after loading', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/filters/i)).toBeInTheDocument();
    });
  });

  it('should display framework filter dropdown', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/framework/i)).toBeInTheDocument();
      expect(screen.getByText(/all frameworks/i)).toBeInTheDocument();
    });
  });

  it('should display severity filter dropdown', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/severity/i)).toBeInTheDocument();
      expect(screen.getByText(/all severities/i)).toBeInTheDocument();
    });
  });

  it('should render compliance timeline chart', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/compliance timeline \(90 days\)/i)).toBeInTheDocument();
    });
  });

  it('should display chart legend', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/compliant/i)).toBeInTheDocument();
      expect(screen.getByText(/drift event/i)).toBeInTheDocument();
    });
  });

  it('should show Mean Time to Resolve (MTTR) metric', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/mean time to resolve/i)).toBeInTheDocument();
    });
  });

  it('should display drift frequency analytics', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/drift frequency/i)).toBeInTheDocument();
    });
  });

  it('should show active drift events count', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/active drift events/i)).toBeInTheDocument();
    });
  });

  it('should render drift event cards', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/drift events/i)).toBeInTheDocument();
      expect(screen.getByText(/ac-2: account management/i)).toBeInTheDocument();
    });
  });

  it('should display root cause analysis section', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/root cause analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/password policy weakened/i)).toBeInTheDocument();
    });
  });

  it('should show remediation steps list', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/remediation steps/i)).toBeInTheDocument();
      expect(screen.getByText(/restore password minimum length/i)).toBeInTheDocument();
    });
  });

  it('should render top drifting controls table', async () => {
    render(<ComplianceDrift />);
    
    await waitFor(() => {
      expect(screen.getByText(/top 10 drifting controls/i)).toBeInTheDocument();
      expect(screen.getByText(/rank/i)).toBeInTheDocument();
      expect(screen.getByText(/control/i)).toBeInTheDocument();
    });
  });
});
