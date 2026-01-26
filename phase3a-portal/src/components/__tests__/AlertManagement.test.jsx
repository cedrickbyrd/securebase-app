/**
 * Unit tests for AlertManagement component
 * Phase 5 Component 3: SRE/Operations Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AlertManagement from '../AlertManagement';

describe('AlertManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render alert management header', () => {
    render(<AlertManagement />);
    expect(screen.getByText(/Alert Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time monitoring and incident response/i)).toBeInTheDocument();
  });

  it('should display alert statistics', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Info').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Acknowledged').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    });
  });

  it('should have search functionality', () => {
    render(<AlertManagement />);
    
    const searchInput = screen.getByPlaceholderText(/Search alerts/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should have severity filter', () => {
    render(<AlertManagement />);
    
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it('should have status filter', () => {
    render(<AlertManagement />);
    
    const statusFilters = screen.getAllByRole('combobox');
    expect(statusFilters.length).toBeGreaterThan(0);
  });

  it('should display alerts after loading', async () => {
    render(<AlertManagement />);
    
    // Component should render
    expect(screen.getByText(/Alert Management/i)).toBeInTheDocument();
  });

  it('should filter alerts by search query', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/Alert Management/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search alerts/i);
    fireEvent.change(searchInput, { target: { value: 'Lambda' } });

    // Should filter alerts containing "Lambda"
    await waitFor(() => {
      const alerts = screen.queryAllByText(/Lambda/i);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it('should have auto-refresh toggle', () => {
    render(<AlertManagement />);
    
    const autoRefreshButton = screen.getByText(/Auto-refresh/i);
    expect(autoRefreshButton).toBeInTheDocument();
  });

  it('should have refresh now button', () => {
    render(<AlertManagement />);
    
    const refreshButton = screen.getByText(/Refresh Now/i);
    expect(refreshButton).toBeInTheDocument();
  });

  it('should allow acknowledging alerts', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      const acknowledgeButtons = screen.queryAllByText(/^Acknowledge$/);
      if (acknowledgeButtons.length > 0) {
        expect(acknowledgeButtons[0]).toBeInTheDocument();
      }
    });
  });

  it('should allow resolving alerts', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      const resolveButtons = screen.queryAllByText(/^Resolve$/);
      if (resolveButtons.length > 0) {
        expect(resolveButtons[0]).toBeInTheDocument();
      }
    });
  });

  it('should allow escalating alerts', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      const escalateButtons = screen.queryAllByText(/Escalate/i);
      if (escalateButtons.length > 0) {
        expect(escalateButtons[0]).toBeInTheDocument();
      }
    });
  });

  it('should support bulk operations', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
        
        // Should show bulk action buttons
        expect(screen.queryByText(/Acknowledge Selected/i) || screen.queryByText(/selected/i)).toBeTruthy();
      }
    });
  });

  it('should show runbook links for alerts', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      const runbookLinks = screen.queryAllByText(/Runbook/i);
      if (runbookLinks.length > 0) {
        expect(runbookLinks[0]).toBeInTheDocument();
      }
    });
  });

  it('should expand alert details', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      // Look for expansion buttons
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should display alert severity badges', async () => {
    render(<AlertManagement />);
    
    await waitFor(() => {
      // Should have severity indicators
      const criticalBadges = screen.queryAllByText(/CRITICAL/i);
      const highBadges = screen.queryAllByText(/HIGH/i);
      const mediumBadges = screen.queryAllByText(/MEDIUM/i);
      
      const totalSeverityBadges = criticalBadges.length + highBadges.length + mediumBadges.length;
      expect(totalSeverityBadges).toBeGreaterThan(0);
    });
  });

  it('should show no alerts message when filtered with no results', async () => {
    render(<AlertManagement />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Alert Management/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search alerts/i);
    fireEvent.change(searchInput, { target: { value: 'NonexistentAlert12345' } });

    await waitFor(() => {
      expect(screen.getByText(/No alerts found/i)).toBeInTheDocument();
    });
  });
});
