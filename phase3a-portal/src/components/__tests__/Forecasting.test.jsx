/**
 * Unit tests for Forecasting component
 * Phase 4: Testing & Quality Assurance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Forecasting } from '../Forecasting';

// Mock the API service
vi.mock('../../services/apiService', () => ({
  getForecast: vi.fn(() => Promise.resolve({
    currentCost: 1500,
    forecastedCost: 1750,
    trend: 'increasing',
    confidence: 85,
    breakdown: [
      { month: 'Jan', cost: 1400 },
      { month: 'Feb', cost: 1500 },
      { month: 'Mar', cost: 1750 },
    ],
  })),
}));

describe('Forecasting Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Forecasting component', () => {
    render(<Forecasting />);
    expect(screen.getByText(/forecast/i)).toBeInTheDocument();
  });

  it('should display current and forecasted costs', async () => {
    render(<Forecasting />);
    
    await waitFor(() => {
      expect(screen.getByText(/1,500|1500/)).toBeInTheDocument();
      expect(screen.getByText(/1,750|1750/)).toBeInTheDocument();
    });
  });

  it('should display trend information', async () => {
    render(<Forecasting />);
    
    await waitFor(() => {
      expect(screen.getByText(/increasing/i)).toBeInTheDocument();
    });
  });

  it('should display confidence level', async () => {
    render(<Forecasting />);
    
    await waitFor(() => {
      expect(screen.getByText(/85/)).toBeInTheDocument();
    });
  });
});
