/**
 * Demo API service — wraps the real apiService with demo mode support.
 *
 * isDemoMode() returns true when:
 *  - The hostname starts with "demo." (e.g. demo.securebase.tximhotep.com)
 *  - OR localStorage key "demo_mode" is set to "true"
 *
 * When demo mode is active every method returns mock data after a
 * 300 ms simulated network delay. When not in demo mode, calls are
 * forwarded to the real apiService (production).
 */

import {
  mockDashboardData,
  mockComplianceData,
  mockAlertData,
  mockEnvironmentData,
} from '../utils/demoData';

/** Detect whether the current session should run in demo mode. */
export const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname.startsWith('demo.')) return true;
  }
  return localStorage.getItem('demo_mode') === 'true';
};

/** Simulated network latency for demo responses (ms). */
const DEMO_DELAY = 300;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const demoAwareApiService = {
  /** Returns dashboard metrics. */
  async getDashboardMetrics() {
    if (isDemoMode()) {
      await delay(DEMO_DELAY);
      return { data: mockDashboardData };
    }
    const { apiService } = await import('./apiService');
    return apiService.getMetrics();
  },

  /** Returns compliance findings. */
  async getComplianceFindings() {
    if (isDemoMode()) {
      await delay(DEMO_DELAY);
      return { data: mockComplianceData.recentFindings };
    }
    const { apiService } = await import('./apiService');
    return apiService.request('/compliance/findings');
  },

  /** Returns compliance summary. */
  async getComplianceSummary() {
    if (isDemoMode()) {
      await delay(DEMO_DELAY);
      return { data: mockComplianceData };
    }
    const { apiService } = await import('./apiService');
    return apiService.request('/compliance/summary');
  },

  /** Returns alert notifications. */
  async getAlerts() {
    if (isDemoMode()) {
      await delay(DEMO_DELAY);
      return { data: mockAlertData };
    }
    const { apiService } = await import('./apiService');
    return apiService.request('/alerts');
  },

  /** Returns environment list. */
  async getEnvironments() {
    if (isDemoMode()) {
      await delay(DEMO_DELAY);
      return { data: mockEnvironmentData };
    }
    const { apiService } = await import('./apiService');
    return apiService.request('/environments');
  },
};
