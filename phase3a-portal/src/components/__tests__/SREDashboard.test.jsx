/**
 * Unit tests for SREDashboard component
 * Phase 5 Component 3: SRE/Operations Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SREDashboard from '../SREDashboard';

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

// Mock Chart.js registration
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  ArcElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));

describe('SREDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SRE dashboard header', () => {
    render(<SREDashboard />);
    expect(screen.getByText(/SRE Operations Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time infrastructure observability/i)).toBeInTheDocument();
  });

  it('should display quick stats cards', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Infrastructure Health/i)).toBeInTheDocument();
      expect(screen.getByText(/Error Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Cache Hit Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Cost/i)).toBeInTheDocument();
    });
  });

  it('should render infrastructure health section', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Infrastructure Health/i)).toBeInTheDocument();
      expect(screen.getByText(/CPU Usage/i)).toBeInTheDocument();
      expect(screen.getByText(/Memory Usage/i)).toBeInTheDocument();
      expect(screen.getByText(/Disk Usage/i)).toBeInTheDocument();
      expect(screen.getByText(/Network I\/O/i)).toBeInTheDocument();
    });
  });

  it('should render deployment pipeline section', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Deployment Pipeline/i)).toBeInTheDocument();
      expect(screen.getByText(/Success Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Avg Duration/i)).toBeInTheDocument();
    });
  });

  it('should render auto-scaling metrics', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Auto-Scaling Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Lambda Concurrency/i)).toBeInTheDocument();
      expect(screen.getByText(/ECS Tasks/i)).toBeInTheDocument();
    });
  });

  it('should render database performance section', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Database Performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Aurora PostgreSQL/i)).toBeInTheDocument();
      expect(screen.getByText(/DynamoDB/i)).toBeInTheDocument();
    });
  });

  it('should render cache performance metrics', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Cache Performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Hit Rate/i)).toBeInTheDocument();
    });
  });

  it('should render error rates section', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error Rates/i)).toBeInTheDocument();
      expect(screen.getByText(/Overall Rate/i)).toBeInTheDocument();
    });
  });

  it('should render Lambda metrics', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Lambda Metrics/i)).toBeInTheDocument();
      expect(screen.getByText(/Cold Starts/i)).toBeInTheDocument();
    });
  });

  it('should render cost analysis section', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Cost Analysis/i)).toBeInTheDocument();
    });
  });

  it('should have time range selector', () => {
    render(<SREDashboard />);
    
    const timeRangeSelect = screen.getByRole('combobox');
    expect(timeRangeSelect).toBeInTheDocument();
  });

  it('should have auto-refresh toggle', () => {
    render(<SREDashboard />);
    
    const autoRefreshButton = screen.getByText(/Auto-refresh/i);
    expect(autoRefreshButton).toBeInTheDocument();
  });

  it('should display charts', async () => {
    render(<SREDashboard />);
    
    await waitFor(() => {
      const lineCharts = screen.getAllByTestId('line-chart');
      const barCharts = screen.getAllByTestId('bar-chart');
      const doughnutCharts = screen.getAllByTestId('doughnut-chart');
      
      expect(lineCharts.length).toBeGreaterThan(0);
      expect(barCharts.length).toBeGreaterThan(0);
      expect(doughnutCharts.length).toBeGreaterThan(0);
    });
  });
});
