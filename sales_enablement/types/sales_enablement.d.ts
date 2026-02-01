/**
 * Sales Enablement Module - TypeScript Type Definitions
 * 
 * Shared type definitions and interfaces used across all submodules.
 * This file provides a central location for common types to ensure consistency.
 */

/**
 * Common utility types
 */

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata in responses
 */
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

/**
 * Standard error response
 */
export interface ApiError {
  success: false;
  error: string;
  details?: string;
  code?: string;
  statusCode: number;
}

/**
 * Timestamp fields common to most models
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // For soft deletes
}

/**
 * User reference (simplified user info)
 */
export interface UserReference {
  id: string;
  name: string;
  email: string;
  role?: string;
}

/**
 * Filter options for list queries
 */
export interface FilterOptions {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Lead-specific types
 */

/**
 * Lead lifecycle stages
 */
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

/**
 * Lead sources
 */
export type LeadSource = 'website' | 'referral' | 'conference' | 'cold_outreach' | 'partner' | 'other';

/**
 * BANT authority levels
 */
export type AuthorityLevel = 'decision_maker' | 'influencer' | 'end_user' | 'unknown';

/**
 * Lead activity type
 */
export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'email' | 'call' | 'meeting' | 'demo' | 'content_shared' | 'note';
  subject: string;
  description?: string;
  outcome?: string;
  performedBy: string;
  timestamp: Date;
}

/**
 * Content-specific types
 */

/**
 * Content types
 */
export type ContentType = 'case_study' | 'presentation' | 'whitepaper' | 'video' | 'datasheet' | 'template' | 'other';

/**
 * Content status
 */
export type ContentStatus = 'draft' | 'review' | 'published' | 'archived';

/**
 * Content visibility
 */
export type ContentVisibility = 'public' | 'internal' | 'restricted';

/**
 * Content access log entry
 */
export interface ContentAccessLog {
  id: string;
  contentId: string;
  userId: string;
  leadId?: string;
  action: 'view' | 'download' | 'share';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  duration?: number; // For video views
}

/**
 * Analytics-specific types
 */

/**
 * Analytics event types
 */
export type AnalyticsEventType = 
  | 'lead_created'
  | 'lead_stage_changed'
  | 'content_viewed'
  | 'content_shared'
  | 'email_sent'
  | 'meeting_scheduled'
  | 'deal_won'
  | 'deal_lost'
  | 'other';

/**
 * Time period for analytics queries
 */
export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Metric data point
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

/**
 * Funnel stage data
 */
export interface FunnelStage {
  stage: LeadStage;
  count: number;
  value: number; // Total deal value
  conversionRate: number; // Percentage
  averageTimeInStage: number; // Days
}

/**
 * RBAC-specific types
 */

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'share' | 'view';

/**
 * Resource types for permissions
 */
export type ResourceType = 'leads' | 'content' | 'analytics' | 'roles' | 'users' | 'settings' | 'team';

/**
 * Permission string (resource:action format)
 */
export type PermissionString = `${ResourceType}:${PermissionAction}`;

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: ResourceType;
  resourceId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  changes?: {
    before?: any;
    after?: any;
  };
}

/**
 * Integration-specific types
 */

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  event: string;
  payload: any;
  timestamp: Date;
  signature: string;
}

/**
 * Integration status
 */
export interface IntegrationStatus {
  provider: string;
  enabled: boolean;
  connected: boolean;
  lastSync?: Date;
  error?: string;
}

/**
 * Notification types
 */

/**
 * Email notification
 */
export interface EmailNotification {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: {
    filename: string;
    content: string | Buffer;
  }[];
}

/**
 * Slack notification
 */
export interface SlackNotification {
  channel: string;
  text: string;
  blocks?: any[];
  username?: string;
  iconEmoji?: string;
}

/**
 * Validation and error types
 */

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: {
    item: T;
    error: string;
  }[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Health check response
 */
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    [serviceName: string]: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
  };
}

/**
 * Export all types
 */
export type {
  // Re-export for convenience
  PaginationParams as Pagination,
  ApiResponse as Response,
  ApiError as Error,
};
