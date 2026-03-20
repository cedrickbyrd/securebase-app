// Demo-aware API service wrapper
import { apiService } from './apiService';
import { 
  isDemoMode, 
  mockComplianceData, 
  mockAlertData, 
  mockEnvironmentData 
} from '../utils/demoData';

// Wrap API service to return mock data in demo mode
export const demoAwareApiService = {
  // Compliance methods
  getComplianceFindings: async () => {
    if (isDemoMode()) {
      // Return mock data in demo mode
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: mockComplianceData.findings
          });
        }, 300);
      });
    }
    return apiService.getComplianceFindings ? apiService.getComplianceFindings() : Promise.resolve({ data: [] });
  },

  getComplianceScore: async () => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              overallScore: mockComplianceData.overallScore,
              totalControls: mockComplianceData.totalControls,
              passedControls: mockComplianceData.passedControls,
              failedControls: mockComplianceData.failedControls,
              categories: mockComplianceData.categories
            }
          });
        }, 300);
      });
    }
    return apiService.getComplianceScore ? apiService.getComplianceScore() : Promise.resolve({ data: {} });
  },

  getComplianceReport: async () => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: mockComplianceData
          });
        }, 300);
      });
    }
    return apiService.getComplianceReport ? apiService.getComplianceReport() : Promise.resolve({ data: {} });
  },

  // Alert methods
  getAlerts: async () => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: mockAlertData.alerts
          });
        }, 300);
      });
    }
    return apiService.getAlerts ? apiService.getAlerts() : Promise.resolve({ data: [] });
  },

  markAlertAsRead: async (alertId) => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 100);
      });
    }
    return apiService.markAlertAsRead ? apiService.markAlertAsRead(alertId) : Promise.resolve({ success: true });
  },

  // Environment methods
  getEnvironments: async () => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: mockEnvironmentData
          });
        }, 300);
      });
    }
    return apiService.getEnvironments ? apiService.getEnvironments() : Promise.resolve({ data: [] });
  },

  // Dashboard methods
  getDashboardMetrics: async () => {
    if (isDemoMode()) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              environments: 3,
              complianceScore: 94,
              monthlyCost: 8247,
              securityScore: 'A+',
              totalResources: 127,
              activeAlerts: 2
            }
          });
        }, 300);
      });
    }
    return apiService.getDashboardMetrics ? apiService.getDashboardMetrics() : Promise.resolve({ data: {} });
  },

  // Pass through other methods
  authenticate: apiService.authenticate,
  
  // Add any other methods that need to be proxied
  ...Object.keys(apiService).reduce((acc, key) => {
    if (!acc[key]) {
      acc[key] = async (...args) => {
        if (isDemoMode()) {
          console.warn(`Demo mode: ${key} called, returning empty response`);
          return Promise.resolve({ success: true, data: null });
        }
        return apiService[key] ? apiService[key](...args) : Promise.resolve({ data: null });
      };
    }
    return acc;
  }, {})
};

export default demoAwareApiService;
