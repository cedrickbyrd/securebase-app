/**
 * Analytics Service - Phase 4
 * API client for analytics and reporting endpoints
 */

import api from './api';

export const analyticsService = {
  /**
   * Get analytics data with filtering
   * @param {Object} params - Query parameters
   * @param {string} params.dateRange - '7d', '30d', '90d', '12m', 'custom'
   * @param {string} params.dimension - 'service', 'region', 'tag', 'account', 'compliance'
   * @param {Object} params.filters - Additional filters
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalytics(params) {
    try {
      const response = await api.get('/analytics', { params });
      return response.data;
    } catch (error) {
      console.error('Get analytics failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch analytics data');
    }
  },

  /**
   * Get list of saved reports
   * @returns {Promise<Array>} Saved reports
   */
  async getSavedReports() {
    try {
      const response = await api.get('/reports');
      return response.data.reports || [];
    } catch (error) {
      console.error('Get saved reports failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch saved reports');
    }
  },

  /**
   * Get a specific report by ID
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report data
   */
  async getReport(reportId) {
    try {
      const response = await api.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      console.error('Get report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch report');
    }
  },

  /**
   * Save a new report configuration
   * @param {Object} reportData - Report configuration
   * @param {string} reportData.name - Report name
   * @param {string} reportData.dateRange - Date range
   * @param {string} reportData.dimension - Grouping dimension
   * @param {Object} reportData.config - Report configuration
   * @returns {Promise<Object>} Created report
   */
  async saveReport(reportData) {
    try {
      const response = await api.post('/reports', reportData);
      return response.data;
    } catch (error) {
      console.error('Save report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to save report');
    }
  },

  /**
   * Update an existing report
   * @param {string} reportId - Report ID
   * @param {Object} updates - Report updates
   * @returns {Promise<Object>} Updated report
   */
  async updateReport(reportId, updates) {
    try {
      const response = await api.put(`/reports/${reportId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Update report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to update report');
    }
  },

  /**
   * Delete a report
   * @param {string} reportId - Report ID
   * @returns {Promise<void>}
   */
  async deleteReport(reportId) {
    try {
      await api.delete(`/reports/${reportId}`);
    } catch (error) {
      console.error('Delete report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete report');
    }
  },

  /**
   * Export report in specified format
   * @param {Object} params - Export parameters
   * @param {string} params.dateRange - Date range
   * @param {string} params.dimension - Dimension
   * @param {string} params.format - 'pdf', 'csv', 'excel', 'json'
   * @returns {Promise<Blob>} Export file blob
   */
  async exportReport(params) {
    try {
      const response = await api.post('/analytics/export', params, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Export report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to export report');
    }
  },

  /**
   * Schedule a report for automatic delivery
   * @param {Object} scheduleData - Schedule configuration
   * @param {string} scheduleData.dateRange - Date range
   * @param {string} scheduleData.dimension - Dimension
   * @param {string} scheduleData.frequency - 'daily', 'weekly', 'monthly'
   * @param {Array<string>} scheduleData.recipients - Email recipients
   * @param {string} scheduleData.format - Export format
   * @returns {Promise<Object>} Schedule confirmation
   */
  async scheduleReport(scheduleData) {
    try {
      const response = await api.post('/reports/schedule', scheduleData);
      return response.data;
    } catch (error) {
      console.error('Schedule report failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to schedule report');
    }
  },

  /**
   * Get scheduled reports
   * @returns {Promise<Array>} Scheduled reports
   */
  async getScheduledReports() {
    try {
      const response = await api.get('/reports/schedules');
      return response.data.schedules || [];
    } catch (error) {
      console.error('Get scheduled reports failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch scheduled reports');
    }
  },

  /**
   * Update a scheduled report
   * @param {string} scheduleId - Schedule ID
   * @param {Object} updates - Schedule updates
   * @returns {Promise<Object>} Updated schedule
   */
  async updateSchedule(scheduleId, updates) {
    try {
      const response = await api.put(`/reports/schedules/${scheduleId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Update schedule failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to update schedule');
    }
  },

  /**
   * Delete a scheduled report
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<void>}
   */
  async deleteSchedule(scheduleId) {
    try {
      await api.delete(`/reports/schedules/${scheduleId}`);
    } catch (error) {
      console.error('Delete schedule failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete schedule');
    }
  },

  /**
   * Get report templates
   * @returns {Promise<Array>} Available report templates
   */
  async getTemplates() {
    try {
      const response = await api.get('/reports/templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('Get templates failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch templates');
    }
  },

  /**
   * Create report from template
   * @param {string} templateId - Template ID
   * @param {Object} params - Template parameters
   * @returns {Promise<Object>} Created report
   */
  async createFromTemplate(templateId, params) {
    try {
      const response = await api.post(`/reports/templates/${templateId}`, params);
      return response.data;
    } catch (error) {
      console.error('Create from template failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to create report from template');
    }
  },

  /**
   * Get analytics summary metrics
   * @param {string} dateRange - Date range
   * @returns {Promise<Object>} Summary metrics
   */
  async getSummary(dateRange = '30d') {
    try {
      const response = await api.get('/analytics/summary', {
        params: { dateRange },
      });
      return response.data;
    } catch (error) {
      console.error('Get summary failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch summary');
    }
  },

  /**
   * Get cost breakdown by dimension
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Cost breakdown data
   */
  async getCostBreakdown(params) {
    try {
      const response = await api.get('/analytics/cost-breakdown', { params });
      return response.data;
    } catch (error) {
      console.error('Get cost breakdown failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch cost breakdown');
    }
  },

  /**
   * Get security analytics
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Security analytics data
   */
  async getSecurityAnalytics(params) {
    try {
      const response = await api.get('/analytics/security', { params });
      return response.data;
    } catch (error) {
      console.error('Get security analytics failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch security analytics');
    }
  },

  /**
   * Get compliance analytics
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Compliance analytics data
   */
  async getComplianceAnalytics(params) {
    try {
      const response = await api.get('/analytics/compliance', { params });
      return response.data;
    } catch (error) {
      console.error('Get compliance analytics failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch compliance analytics');
    }
  },

  /**
   * Get usage analytics
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Usage analytics data
   */
  async getUsageAnalytics(params) {
    try {
      const response = await api.get('/analytics/usage', { params });
      return response.data;
    } catch (error) {
      console.error('Get usage analytics failed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch usage analytics');
    }
  },
};

export default analyticsService;
