import React from 'react';
import { isDemoMode } from '../utils/demoData';
import SREDashboard from './SREDashboard';
import DemoDashboard from '../pages/DemoDashboard';

/**
 * Wrapper component that routes to the appropriate dashboard
 * based on whether we're in demo mode or not
 */
export default function SREDashboardWrapper() {
  const isDemo = isDemoMode();
  
  // In demo mode, show the simple demo dashboard
  if (isDemo) {
    return <DemoDashboard />;
  }
  
  // In production, show the full SRE dashboard with real API calls
  return <SREDashboard />;
}
