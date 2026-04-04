/**
 * Mock API data for SecureBase root app.
 * Provides compliance scores and other demo data for components
 * that need to display real-time-like metrics without a live backend.
 */

export const mockComplianceData = {
  overall: 73,
  frameworks: {
    soc2: 75,
    hipaa: 70,
    fedramp: 75,
  },
  lastUpdated: new Date().toISOString(),
};

export default mockComplianceData;
