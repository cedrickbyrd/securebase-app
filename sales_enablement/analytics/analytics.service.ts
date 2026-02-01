/**
 * Analytics Service
 * 
 * Provides analytics and reporting capabilities for sales enablement.
 * Tracks events, calculates metrics, and generates insights.
 */

/**
 * Analytics Event Interface
 */
export interface AnalyticsEvent {
  id: string;
  type: 'lead_created' | 'lead_stage_changed' | 'content_viewed' | 'content_shared' | 
        'email_sent' | 'meeting_scheduled' | 'deal_won' | 'deal_lost' | 'other';
  userId: string;
  timestamp: Date;
  properties: {
    [key: string]: any;
  };
}

/**
 * Dashboard Metrics Interface
 */
export interface DashboardMetrics {
  // Lead metrics
  totalLeads: number;
  newLeadsThisMonth: number;
  leadConversionRate: number;
  averageLeadScore: number;
  
  // Pipeline metrics
  totalPipelineValue: number;
  dealsInProgress: number;
  averageDealSize: number;
  forecastedRevenue: number;
  
  // Content metrics
  totalContentViews: number;
  topPerformingContent: string[];
  contentEngagementRate: number;
  
  // Performance metrics
  winRate: number;
  averageSalesCycle: number; // in days
  topPerformingRep: string;
}

/**
 * Sample Analytics Events
 * 
 * These events demonstrate different types of sales activities that are tracked:
 * 1. New lead created from website form
 * 2. Content shared with prospect
 * 3. Lead advanced to proposal stage
 * 4. Deal closed won
 */
export const sampleAnalyticsEvents: AnalyticsEvent[] = [
  {
    id: 'event-001',
    type: 'lead_created',
    userId: 'system',
    timestamp: new Date('2026-01-29T10:30:00Z'),
    properties: {
      leadId: 'lead-003',
      source: 'website',
      formName: 'Contact Us',
      industry: 'Government',
      estimatedBudget: 'unknown'
    }
  },
  {
    id: 'event-002',
    type: 'content_shared',
    userId: 'sales-rep-john-doe',
    timestamp: new Date('2026-01-28T14:22:00Z'),
    properties: {
      contentId: 'content-001',
      contentTitle: 'HealthCare Corp Case Study',
      leadId: 'lead-001',
      shareMethod: 'email'
    }
  },
  {
    id: 'event-003',
    type: 'lead_stage_changed',
    userId: 'sales-rep-john-doe',
    timestamp: new Date('2026-01-28T16:45:00Z'),
    properties: {
      leadId: 'lead-001',
      oldStage: 'qualified',
      newStage: 'proposal',
      dealValue: 500000,
      expectedCloseDate: '2026-02-15'
    }
  },
  {
    id: 'event-004',
    type: 'deal_won',
    userId: 'sales-rep-jane-smith',
    timestamp: new Date('2026-01-25T11:00:00Z'),
    properties: {
      leadId: 'lead-002',
      dealValue: 150000,
      tier: 'fintech',
      contractLength: 12, // months
      closedReason: 'Best compliance features',
      salesCycleDays: 45
    }
  },
  {
    id: 'event-005',
    type: 'content_viewed',
    userId: 'lead-001',
    timestamp: new Date('2026-01-30T09:15:00Z'),
    properties: {
      contentId: 'content-002',
      contentTitle: 'Product Overview Deck',
      viewDuration: 420, // seconds (7 minutes)
      completed: true
    }
  }
];

/**
 * AnalyticsService
 * 
 * Provides methods for:
 * - Event tracking
 * - Metrics calculation
 * - Report generation
 * - Forecasting
 */
export class AnalyticsService {
  /**
   * Track an analytics event
   * 
   * @param event - Event data to track
   * @returns Promise<AnalyticsEvent> - The tracked event
   * 
   * Example:
   * ```typescript
   * await AnalyticsService.trackEvent({
   *   type: 'content_shared',
   *   userId: 'rep-123',
   *   properties: { contentId: 'content-001', leadId: 'lead-456' }
   * });
   * ```
   */
  static async trackEvent(
    type: AnalyticsEvent['type'],
    userId: string,
    properties: { [key: string]: any }
  ): Promise<AnalyticsEvent> {
    // TODO: Implement event storage in database/data warehouse
    const event: AnalyticsEvent = {
      id: `event-${Date.now()}`,
      type,
      userId,
      timestamp: new Date(),
      properties
    };
    
    sampleAnalyticsEvents.push(event);
    
    return event;
  }

  /**
   * Get dashboard metrics
   * 
   * Aggregates key performance indicators from all sources
   * 
   * @returns Promise<DashboardMetrics> - Comprehensive dashboard metrics
   */
  static async getDashboardMetrics(): Promise<DashboardMetrics> {
    // TODO: Implement real-time metrics calculation from database
    
    // Calculate from sample data
    const leadEvents = sampleAnalyticsEvents.filter(e => e.type === 'lead_created');
    const wonDeals = sampleAnalyticsEvents.filter(e => e.type === 'deal_won');
    const lostDeals = sampleAnalyticsEvents.filter(e => e.type === 'deal_lost');
    
    const totalDeals = wonDeals.length + lostDeals.length;
    const winRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0;
    
    const totalPipelineValue = wonDeals.reduce(
      (sum, event) => sum + (event.properties.dealValue || 0),
      0
    );
    
    const averageDealSize = wonDeals.length > 0
      ? totalPipelineValue / wonDeals.length
      : 0;
    
    return {
      // Lead metrics
      totalLeads: leadEvents.length,
      newLeadsThisMonth: leadEvents.filter(e => {
        const daysAgo = (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
      }).length,
      leadConversionRate: 68.5, // Percentage
      averageLeadScore: 68,
      
      // Pipeline metrics
      totalPipelineValue,
      dealsInProgress: 8,
      averageDealSize,
      forecastedRevenue: totalPipelineValue * 1.3, // 30% growth projection
      
      // Content metrics
      totalContentViews: sampleAnalyticsEvents.filter(
        e => e.type === 'content_viewed'
      ).length,
      topPerformingContent: ['content-001', 'content-002', 'content-003'],
      contentEngagementRate: 45.2,
      
      // Performance metrics
      winRate,
      averageSalesCycle: 45,
      topPerformingRep: 'sales-rep-jane-smith'
    };
  }

  /**
   * Get lead funnel analytics
   * 
   * Calculates conversion rates and bottlenecks in the sales funnel
   * 
   * @returns Promise<FunnelAnalytics>
   */
  static async getLeadFunnelAnalytics(): Promise<{
    stages: {
      stage: string;
      count: number;
      conversionRate: number;
      averageTimeInStage: number;
    }[];
    overallConversionRate: number;
  }> {
    // TODO: Implement funnel analysis from database
    return {
      stages: [
        { stage: 'new', count: 100, conversionRate: 65, averageTimeInStage: 2 },
        { stage: 'contacted', count: 65, conversionRate: 75, averageTimeInStage: 7 },
        { stage: 'qualified', count: 49, conversionRate: 60, averageTimeInStage: 14 },
        { stage: 'proposal', count: 29, conversionRate: 55, averageTimeInStage: 10 },
        { stage: 'negotiation', count: 16, conversionRate: 70, averageTimeInStage: 8 },
        { stage: 'won', count: 11, conversionRate: 100, averageTimeInStage: 0 }
      ],
      overallConversionRate: 11 // 11% of leads convert to customers
    };
  }

  /**
   * Get content effectiveness analytics
   * 
   * @returns Promise<ContentAnalytics[]>
   */
  static async getContentAnalytics(): Promise<{
    contentId: string;
    title: string;
    views: number;
    shares: number;
    leadsGenerated: number;
    conversions: number;
    effectivenessScore: number;
  }[]> {
    // TODO: Implement content analytics from database
    return [
      {
        contentId: 'content-001',
        title: 'HealthCare Corp Case Study',
        views: 847,
        shares: 156,
        leadsGenerated: 23,
        conversions: 7,
        effectivenessScore: 92
      },
      {
        contentId: 'content-002',
        title: 'Product Overview Deck',
        views: 1243,
        shares: 289,
        leadsGenerated: 45,
        conversions: 18,
        effectivenessScore: 88
      },
      {
        contentId: 'content-003',
        title: 'Security Architecture Whitepaper',
        views: 623,
        shares: 89,
        leadsGenerated: 31,
        conversions: 12,
        effectivenessScore: 85
      }
    ];
  }

  /**
   * Generate revenue forecast
   * 
   * Uses historical data and current pipeline to predict future revenue
   * 
   * @param months - Number of months to forecast
   * @returns Promise<RevenueForecasa[]>
   */
  static async getForecast(months: number = 6): Promise<{
    month: string;
    forecastedRevenue: number;
    confidence: 'high' | 'medium' | 'low';
  }[]> {
    // TODO: Implement ML-based forecasting
    const forecast = [];
    const baseRevenue = 250000;
    
    for (let i = 1; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      forecast.push({
        month: monthName,
        forecastedRevenue: baseRevenue * (1 + (i * 0.15)), // 15% monthly growth
        confidence: i <= 2 ? 'high' : i <= 4 ? 'medium' : 'low'
      });
    }
    
    return forecast;
  }

  /**
   * Get top performing sales representatives
   * 
   * @param limit - Number of reps to return
   * @returns Promise<RepPerformance[]>
   */
  static async getTopPerformers(limit: number = 5): Promise<{
    repId: string;
    repName: string;
    dealsWon: number;
    totalRevenue: number;
    winRate: number;
    averageDealSize: number;
  }[]> {
    // TODO: Implement from database
    return [
      {
        repId: 'sales-rep-jane-smith',
        repName: 'Jane Smith',
        dealsWon: 12,
        totalRevenue: 1800000,
        winRate: 75,
        averageDealSize: 150000
      },
      {
        repId: 'sales-rep-john-doe',
        repName: 'John Doe',
        dealsWon: 10,
        totalRevenue: 2100000,
        winRate: 70,
        averageDealSize: 210000
      }
    ];
  }
}
