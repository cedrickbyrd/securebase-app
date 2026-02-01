/**
 * Sales Enablement Configuration
 * 
 * Central configuration file for the sales enablement module.
 * Loads settings from environment variables and provides default values.
 */

/**
 * Database Configuration
 */
export const databaseConfig = {
  host: process.env.SE_DB_HOST || 'localhost',
  port: parseInt(process.env.SE_DB_PORT || '5432', 10),
  database: process.env.SE_DB_NAME || 'sales_enablement',
  user: process.env.SE_DB_USER || 'se_user',
  password: process.env.SE_DB_PASSWORD || '',
  ssl: process.env.SE_DB_SSL === 'true',
  maxConnections: parseInt(process.env.SE_DB_MAX_CONNECTIONS || '20', 10),
};

/**
 * API Configuration
 */
export const apiConfig = {
  port: parseInt(process.env.SE_API_PORT || '3000', 10),
  host: process.env.SE_API_HOST || '0.0.0.0',
  corsOrigins: process.env.SE_CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  rateLimit: {
    windowMs: parseInt(process.env.SE_RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.SE_RATE_LIMIT_MAX || '100', 10),
  },
};

/**
 * Authentication Configuration
 */
export const authConfig = {
  jwtSecret: process.env.SE_JWT_SECRET || 'change-me-in-production',
  jwtExpiresIn: process.env.SE_JWT_EXPIRES_IN || '24h',
  refreshTokenExpiresIn: process.env.SE_REFRESH_TOKEN_EXPIRES || '7d',
  passwordMinLength: parseInt(process.env.SE_PASSWORD_MIN_LENGTH || '8', 10),
  sessionTimeout: parseInt(process.env.SE_SESSION_TIMEOUT || '3600', 10), // 1 hour
};

/**
 * Lead Management Configuration
 */
export const leadsConfig = {
  // Lead scoring thresholds
  scoring: {
    highValue: parseInt(process.env.SE_LEAD_SCORE_HIGH || '70', 10),
    mediumValue: parseInt(process.env.SE_LEAD_SCORE_MEDIUM || '40', 10),
    lowValue: parseInt(process.env.SE_LEAD_SCORE_LOW || '0', 10),
  },
  
  // Automatic lead assignment
  autoAssignment: {
    enabled: process.env.SE_LEAD_AUTO_ASSIGN === 'true',
    method: process.env.SE_LEAD_ASSIGN_METHOD || 'round_robin', // 'round_robin', 'territory', 'score'
  },
  
  // Lead retention
  retention: {
    archiveAfterDays: parseInt(process.env.SE_LEAD_ARCHIVE_DAYS || '365', 10),
    deleteAfterDays: parseInt(process.env.SE_LEAD_DELETE_DAYS || '730', 10),
  },
};

/**
 * Content Management Configuration
 */
export const contentConfig = {
  // File storage
  storage: {
    provider: process.env.SE_STORAGE_PROVIDER || 's3', // 's3', 'azure', 'local'
    bucket: process.env.SE_STORAGE_BUCKET || 'sales-content',
    region: process.env.SE_STORAGE_REGION || 'us-east-1',
    cdnUrl: process.env.SE_CDN_URL || 'https://cdn.securebase.io',
  },
  
  // File upload limits
  upload: {
    maxFileSize: parseInt(process.env.SE_MAX_FILE_SIZE || '52428800', 10), // 50MB
    allowedTypes: process.env.SE_ALLOWED_TYPES?.split(',') || [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4',
      'image/jpeg',
      'image/png',
    ],
  },
  
  // Content publishing workflow
  publishing: {
    requiresApproval: process.env.SE_CONTENT_APPROVAL === 'true',
    approverRoles: process.env.SE_APPROVER_ROLES?.split(',') || ['role-001', 'role-002'],
  },
};

/**
 * Analytics Configuration
 */
export const analyticsConfig = {
  // Data aggregation
  aggregation: {
    interval: process.env.SE_ANALYTICS_INTERVAL || 'hourly', // 'realtime', 'hourly', 'daily'
    retentionDays: parseInt(process.env.SE_ANALYTICS_RETENTION || '365', 10),
  },
  
  // Reporting
  reporting: {
    defaultTimezone: process.env.SE_TIMEZONE || 'America/New_York',
    emailReports: process.env.SE_EMAIL_REPORTS === 'true',
    reportSchedule: process.env.SE_REPORT_SCHEDULE || '0 9 * * 1', // Monday 9am
  },
  
  // Forecasting
  forecasting: {
    enabled: process.env.SE_FORECASTING_ENABLED === 'true',
    model: process.env.SE_FORECAST_MODEL || 'linear', // 'linear', 'exponential', 'ml'
  },
};

/**
 * Notification Configuration
 */
export const notificationConfig = {
  email: {
    provider: process.env.SE_EMAIL_PROVIDER || 'sendgrid',
    apiKey: process.env.SE_EMAIL_API_KEY || '',
    fromAddress: process.env.SE_EMAIL_FROM || 'noreply@securebase.io',
    fromName: process.env.SE_EMAIL_FROM_NAME || 'SecureBase Sales',
  },
  
  slack: {
    enabled: process.env.SE_SLACK_ENABLED === 'true',
    webhookUrl: process.env.SE_SLACK_WEBHOOK || '',
    channel: process.env.SE_SLACK_CHANNEL || '#sales',
  },
  
  // Notification preferences
  notifications: {
    leadAssigned: process.env.SE_NOTIFY_LEAD_ASSIGNED === 'true',
    leadStageChanged: process.env.SE_NOTIFY_STAGE_CHANGE === 'true',
    contentPublished: process.env.SE_NOTIFY_CONTENT === 'true',
    dealWon: process.env.SE_NOTIFY_DEAL_WON === 'true',
  },
};

/**
 * Integration Configuration
 */
export const integrationConfig = {
  // CRM integration
  crm: {
    provider: process.env.SE_CRM_PROVIDER || 'salesforce', // 'salesforce', 'hubspot', 'pipedrive'
    enabled: process.env.SE_CRM_ENABLED === 'true',
    apiKey: process.env.SE_CRM_API_KEY || '',
    syncInterval: parseInt(process.env.SE_CRM_SYNC_INTERVAL || '300', 10), // 5 minutes
  },
  
  // Marketing automation
  marketing: {
    provider: process.env.SE_MARKETING_PROVIDER || 'marketo',
    enabled: process.env.SE_MARKETING_ENABLED === 'true',
    apiKey: process.env.SE_MARKETING_API_KEY || '',
  },
};

/**
 * Feature Flags
 */
export const featureFlags = {
  aiLeadScoring: process.env.SE_FEATURE_AI_SCORING === 'true',
  contentRecommendations: process.env.SE_FEATURE_CONTENT_REC === 'true',
  predictiveAnalytics: process.env.SE_FEATURE_PREDICTIVE === 'true',
  advancedRBAC: process.env.SE_FEATURE_RBAC === 'true',
  webhooks: process.env.SE_FEATURE_WEBHOOKS === 'true',
};

/**
 * Logging Configuration
 */
export const loggingConfig = {
  level: process.env.SE_LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  format: process.env.SE_LOG_FORMAT || 'json', // 'json', 'simple'
  destination: process.env.SE_LOG_DESTINATION || 'console', // 'console', 'file', 'cloudwatch'
  filePath: process.env.SE_LOG_FILE || './logs/sales_enablement.log',
};

/**
 * Export all configurations
 */
export default {
  database: databaseConfig,
  api: apiConfig,
  auth: authConfig,
  leads: leadsConfig,
  content: contentConfig,
  analytics: analyticsConfig,
  notifications: notificationConfig,
  integrations: integrationConfig,
  features: featureFlags,
  logging: loggingConfig,
};
