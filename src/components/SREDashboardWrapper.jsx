import React from 'react';
import { isDemoMode } from '../services/demoApiService';
import SREDashboard from './SREDashboard';
import DemoDashboard from '../pages/DemoDashboard';

/**
 * Routes to the appropriate SRE dashboard based on mode:
 * - Demo mode  → DemoDashboard (mock data, no real API calls)
 * - Production → SREDashboard  (real sreService API calls)
 */
const SREDashboardWrapper = () => {
  if (isDemoMode()) {
    return <DemoDashboard />;
  }
  return <SREDashboard />;
};

export default SREDashboardWrapper;
