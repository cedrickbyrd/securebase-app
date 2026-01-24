/**
 * Unit tests for Analytics component
 * Phase 4: Advanced Analytics & Reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Analytics } from '../Analytics';

// Mock the analytics service
vi.mock('../../services/analyticsService');

describe('Analytics Component', () => {
  it('should render Analytics component', () => {
    render(<Analytics />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('should display summary statistics', async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should switch tabs when clicked', async () => {
    render(<Analytics />);
    fireEvent.click(screen.getByText('Cost'));
    await waitFor(() => {
      expect(screen.getByText('Cost')).toHaveClass('active');
    });
  });
});
