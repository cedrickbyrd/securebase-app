/**
 * Analytics Unit Tests
 * 
 * Test suite for the analytics submodule including:
 * - Event tracking
 * - Dashboard metrics calculation
 * - Funnel analytics
 * - Content effectiveness
 * - Revenue forecasting
 */

import { AnalyticsService, sampleAnalyticsEvents } from '../analytics.service';
import { AnalyticsController } from '../analytics.controller';

describe('Analytics Service', () => {
  test('should have valid sample events', () => {
    expect(sampleAnalyticsEvents).toBeDefined();
    expect(sampleAnalyticsEvents.length).toBeGreaterThan(0);
    
    sampleAnalyticsEvents.forEach(event => {
      expect(event.id).toBeDefined();
      expect(event.type).toBeDefined();
      expect(event.userId).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  test('should track a new event', async () => {
    const initialCount = sampleAnalyticsEvents.length;
    
    const event = await AnalyticsService.trackEvent(
      'content_viewed',
      'user-123',
      { contentId: 'content-001', duration: 300 }
    );
    
    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.type).toBe('content_viewed');
    expect(event.userId).toBe('user-123');
    expect(sampleAnalyticsEvents.length).toBe(initialCount + 1);
  });

  test('should get dashboard metrics', async () => {
    const metrics = await AnalyticsService.getDashboardMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics.totalLeads).toBeGreaterThanOrEqual(0);
    expect(metrics.leadConversionRate).toBeGreaterThanOrEqual(0);
    expect(metrics.leadConversionRate).toBeLessThanOrEqual(100);
    expect(metrics.totalPipelineValue).toBeGreaterThanOrEqual(0);
    expect(metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(metrics.winRate).toBeLessThanOrEqual(100);
  });

  test('should calculate lead funnel analytics', async () => {
    const funnel = await AnalyticsService.getLeadFunnelAnalytics();
    
    expect(funnel).toBeDefined();
    expect(funnel.stages).toBeDefined();
    expect(funnel.stages.length).toBeGreaterThan(0);
    expect(funnel.overallConversionRate).toBeGreaterThanOrEqual(0);
    expect(funnel.overallConversionRate).toBeLessThanOrEqual(100);
    
    // Verify stages are in order
    funnel.stages.forEach(stage => {
      expect(stage.count).toBeGreaterThanOrEqual(0);
      expect(stage.conversionRate).toBeGreaterThanOrEqual(0);
      expect(stage.averageTimeInStage).toBeGreaterThanOrEqual(0);
    });
  });

  test('should get content analytics', async () => {
    const contentAnalytics = await AnalyticsService.getContentAnalytics();
    
    expect(contentAnalytics).toBeDefined();
    expect(contentAnalytics.length).toBeGreaterThan(0);
    
    contentAnalytics.forEach(content => {
      expect(content.contentId).toBeDefined();
      expect(content.views).toBeGreaterThanOrEqual(0);
      expect(content.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(content.effectivenessScore).toBeLessThanOrEqual(100);
    });
  });

  test('should generate revenue forecast', async () => {
    const forecast = await AnalyticsService.getForecast(6);
    
    expect(forecast).toBeDefined();
    expect(forecast.length).toBe(6);
    
    forecast.forEach((month, index) => {
      expect(month.month).toBeDefined();
      expect(month.forecastedRevenue).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(month.confidence);
      
      // Verify confidence decreases over time
      if (index < 2) expect(month.confidence).toBe('high');
      else if (index < 4) expect(month.confidence).toBe('medium');
      else expect(month.confidence).toBe('low');
    });
  });

  test('should get top performers', async () => {
    const topPerformers = await AnalyticsService.getTopPerformers(5);
    
    expect(topPerformers).toBeDefined();
    expect(topPerformers.length).toBeGreaterThan(0);
    expect(topPerformers.length).toBeLessThanOrEqual(5);
    
    topPerformers.forEach(rep => {
      expect(rep.repId).toBeDefined();
      expect(rep.repName).toBeDefined();
      expect(rep.dealsWon).toBeGreaterThanOrEqual(0);
      expect(rep.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(rep.winRate).toBeGreaterThanOrEqual(0);
      expect(rep.winRate).toBeLessThanOrEqual(100);
    });
  });
});

describe('Analytics Controller', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('should track an event', async () => {
    mockReq.body = {
      type: 'lead_created',
      userId: 'user-123',
      properties: { leadId: 'lead-789', source: 'website' }
    };

    await AnalyticsController.trackEvent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          type: 'lead_created',
        }),
      })
    );
  });

  test('should validate event tracking fields', async () => {
    mockReq.body = {
      type: 'content_viewed',
      // Missing userId
    };

    await AnalyticsController.trackEvent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  test('should get dashboard metrics', async () => {
    await AnalyticsController.getDashboard(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalLeads: expect.any(Number),
          totalPipelineValue: expect.any(Number),
        }),
      })
    );
  });

  test('should get funnel analytics', async () => {
    await AnalyticsController.getFunnelAnalytics(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          stages: expect.any(Array),
          overallConversionRate: expect.any(Number),
        }),
      })
    );
  });

  test('should get content analytics', async () => {
    await AnalyticsController.getContentAnalytics(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });

  test('should get revenue forecast', async () => {
    mockReq.query.months = '6';

    await AnalyticsController.getForecast(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });

  test('should validate forecast months parameter', async () => {
    mockReq.query.months = '30'; // Exceeds max of 24

    await AnalyticsController.getForecast(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  test('should get top performers', async () => {
    mockReq.query.limit = '5';

    await AnalyticsController.getTopPerformers(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        count: expect.any(Number),
      })
    );
  });

  test('should validate top performers limit parameter', async () => {
    mockReq.query.limit = '100'; // Exceeds max of 50

    await AnalyticsController.getTopPerformers(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
