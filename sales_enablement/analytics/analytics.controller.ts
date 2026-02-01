/**
 * Analytics Controller
 * 
 * Handles HTTP requests for analytics and reporting operations.
 * Routes requests to AnalyticsService and formats responses.
 */

import { AnalyticsService, AnalyticsEvent, DashboardMetrics } from './analytics.service';

/**
 * AnalyticsController
 * 
 * Exposes REST API endpoints for analytics:
 * - POST /analytics/track - Track an analytics event
 * - GET /analytics/dashboard - Get dashboard metrics
 * - GET /analytics/funnel - Get lead funnel analytics
 * - GET /analytics/content - Get content effectiveness
 * - GET /analytics/forecast - Get revenue forecast
 * - GET /analytics/top-performers - Get top sales reps
 */
export class AnalyticsController {
  /**
   * Track an analytics event
   * 
   * POST /api/analytics/track
   * 
   * Request body:
   * {
   *   "type": "content_shared",
   *   "userId": "user-123",
   *   "properties": {
   *     "contentId": "content-001",
   *     "leadId": "lead-456"
   *   }
   * }
   * 
   * Response: 201 Created
   * {
   *   "success": true,
   *   "data": { ...event },
   *   "message": "Event tracked successfully"
   * }
   */
  static async trackEvent(req: any, res: any): Promise<void> {
    try {
      const { type, userId, properties } = req.body;
      
      if (!type || !userId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: type, userId'
        });
        return;
      }
      
      const event = await AnalyticsService.trackEvent(type, userId, properties || {});
      
      res.status(201).json({
        success: true,
        data: event,
        message: 'Event tracked successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to track event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get dashboard metrics
   * 
   * GET /api/analytics/dashboard
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "totalLeads": 100,
   *     "newLeadsThisMonth": 23,
   *     "leadConversionRate": 68.5,
   *     "totalPipelineValue": 2500000,
   *     ...
   *   }
   * }
   */
  static async getDashboard(req: any, res: any): Promise<void> {
    try {
      const metrics = await AnalyticsService.getDashboardMetrics();
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get lead funnel analytics
   * 
   * GET /api/analytics/funnel
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "stages": [
   *       { "stage": "new", "count": 100, "conversionRate": 65, ... },
   *       ...
   *     ],
   *     "overallConversionRate": 11
   *   }
   * }
   */
  static async getFunnelAnalytics(req: any, res: any): Promise<void> {
    try {
      const funnel = await AnalyticsService.getLeadFunnelAnalytics();
      
      res.status(200).json({
        success: true,
        data: funnel
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve funnel analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get content effectiveness analytics
   * 
   * GET /api/analytics/content
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "contentId": "content-001",
   *       "title": "HealthCare Corp Case Study",
   *       "views": 847,
   *       "effectivenessScore": 92,
   *       ...
   *     },
   *     ...
   *   ]
   * }
   */
  static async getContentAnalytics(req: any, res: any): Promise<void> {
    try {
      const contentAnalytics = await AnalyticsService.getContentAnalytics();
      
      res.status(200).json({
        success: true,
        data: contentAnalytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve content analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get revenue forecast
   * 
   * GET /api/analytics/forecast?months=6
   * 
   * Query parameters:
   * - months: Number of months to forecast (default: 6)
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "month": "February 2026",
   *       "forecastedRevenue": 287500,
   *       "confidence": "high"
   *     },
   *     ...
   *   ]
   * }
   */
  static async getForecast(req: any, res: any): Promise<void> {
    try {
      const months = parseInt(req.query.months || '6', 10);
      
      if (months < 1 || months > 24) {
        res.status(400).json({
          success: false,
          error: 'Months must be between 1 and 24'
        });
        return;
      }
      
      const forecast = await AnalyticsService.getForecast(months);
      
      res.status(200).json({
        success: true,
        data: forecast
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate forecast',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get top performing sales representatives
   * 
   * GET /api/analytics/top-performers?limit=5
   * 
   * Query parameters:
   * - limit: Number of reps to return (default: 5)
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "repId": "sales-rep-jane-smith",
   *       "repName": "Jane Smith",
   *       "dealsWon": 12,
   *       "totalRevenue": 1800000,
   *       "winRate": 75,
   *       "averageDealSize": 150000
   *     },
   *     ...
   *   ]
   * }
   */
  static async getTopPerformers(req: any, res: any): Promise<void> {
    try {
      const limit = parseInt(req.query.limit || '5', 10);
      
      if (limit < 1 || limit > 50) {
        res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 50'
        });
        return;
      }
      
      const topPerformers = await AnalyticsService.getTopPerformers(limit);
      
      res.status(200).json({
        success: true,
        data: topPerformers,
        count: topPerformers.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve top performers',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Example Express.js route setup:
 * 
 * import express from 'express';
 * import { AnalyticsController } from './analytics.controller';
 * 
 * const router = express.Router();
 * 
 * router.post('/analytics/track', AnalyticsController.trackEvent);
 * router.get('/analytics/dashboard', AnalyticsController.getDashboard);
 * router.get('/analytics/funnel', AnalyticsController.getFunnelAnalytics);
 * router.get('/analytics/content', AnalyticsController.getContentAnalytics);
 * router.get('/analytics/forecast', AnalyticsController.getForecast);
 * router.get('/analytics/top-performers', AnalyticsController.getTopPerformers);
 * 
 * export default router;
 */
