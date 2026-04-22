/**
 * SecureBase Analytics Tracking Utility
 * Comprehensive event tracking for compliance-as-code workflows
 * 
 * @module analytics
 */

/**
 * Check if analytics is available and user is not a bot
 */
const isAnalyticsAvailable = () => {
  if (typeof window === 'undefined' || typeof gtag === 'undefined') {
    return false;
  }
  
  // Filter out bot traffic
  const ua = navigator.userAgent.toLowerCase();
  const botPatterns = /bot|crawler|spider|scraper|headless|phantom/i;
  
  return !botPatterns.test(ua) && window.innerWidth > 0;
};

/**
 * Base event tracker with error handling
 */
const trackEvent = (eventName, params = {}) => {
  if (!isAnalyticsAvailable()) {
    console.debug('[Analytics] Event skipped:', eventName, params);
    return;
  }
  
  try {
    gtag('event', eventName, {
      timestamp: new Date().toISOString(),
      ...params
    });
    console.debug('[Analytics] Event tracked:', eventName, params);
  } catch (error) {
    console.error('[Analytics] Error tracking event:', eventName, error);
  }
};

/**
 * Track page views with enhanced metadata
 */
export const trackPageView = (pagePath, pageTitle, additionalParams = {}) => {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
    page_referrer: document.referrer || 'direct',
    ...additionalParams
  });
};

/**
 * Compliance Event Trackers
 * Each function corresponds to a key user action in the compliance workflow
 */
export const ComplianceEvents = {
  // ============================================================================
  // POLICY SCANNING
  // ============================================================================
  
  /**
   * Track when a user initiates a policy scan
   * @param {string} policyType - SOC2, HIPAA, PCI-DSS, ISO27001, etc.
   * @param {string} scanScope - full, partial, single_resource
   * @param {object} metadata - Additional scan configuration
   */
  policyScanInitiated: (policyType, scanScope, metadata = {}) => {
    trackEvent('policy_scan_initiated', {
      event_category: 'compliance',
      policy_type: policyType,
      scan_scope: scanScope,
      resource_count: metadata.resourceCount || 0,
      estimated_duration: metadata.estimatedDuration || null,
      scan_id: metadata.scanId || null
    });
  },
  
  /**
   * Track scan completion with findings summary
   * @param {string} policyType - Type of policy scanned
   * @param {object} findings - Scan results breakdown
   */
  policyScanCompleted: (policyType, findings) => {
    trackEvent('policy_scan_completed', {
      event_category: 'compliance',
      policy_type: policyType,
      findings_total: findings.total || 0,
      findings_critical: findings.critical || 0,
      findings_high: findings.high || 0,
      findings_medium: findings.medium || 0,
      findings_low: findings.low || 0,
      scan_duration_seconds: findings.duration || 0,
      compliance_score: findings.score || null,
      scan_id: findings.scanId || null,
      success: true
    });
  },
  
  /**
   * Track scan failures for debugging
   */
  policyScanFailed: (policyType, errorType, errorMessage) => {
    trackEvent('policy_scan_failed', {
      event_category: 'compliance',
      policy_type: policyType,
      error_type: errorType,
      error_message: errorMessage,
      success: false
    });
  },
  
  // ============================================================================
  // REPORT GENERATION & DOWNLOADS
  // ============================================================================
  
  /**
   * Track report generation
   * @param {string} reportType - compliance_summary, audit_trail, gap_analysis, executive_summary
   * @param {string} format - pdf, csv, json, xlsx
   */
  reportGenerated: (reportType, format, metadata = {}) => {
    trackEvent('report_generated', {
      event_category: 'reports',
      report_type: reportType,
      format: format,
      date_range: metadata.dateRange || null,
      filters_applied: metadata.filters || null,
      report_size_kb: metadata.sizeKb || null
    });
  },
  
  /**
   * Track actual report downloads (critical conversion metric)
   */
  reportDownloaded: (reportType, format, fileSize = null) => {
    trackEvent('report_downloaded', {
      event_category: 'reports',
      report_type: reportType,
      format: format,
      file_size_kb: fileSize,
      // This is a key conversion event
      value: 1
    });
  },
  
  /**
   * Track report sharing/email
   */
  reportShared: (reportType, shareMethod) => {
    trackEvent('report_shared', {
      event_category: 'reports',
      report_type: reportType,
      share_method: shareMethod, // email, slack, link
      value: 1
    });
  },
  
  // ============================================================================
  // REMEDIATION WORKFLOW
  // ============================================================================
  
  /**
   * Track when remediation begins for a finding
   */
  remediationStarted: (findingId, severity, remediationType) => {
    trackEvent('remediation_started', {
      event_category: 'remediation',
      finding_id: findingId,
      severity: severity,
      remediation_type: remediationType, // automated, manual, risk_accepted
      value: severity === 'critical' ? 3 : severity === 'high' ? 2 : 1
    });
  },
  
  /**
   * Track successful remediation completion
   */
  remediationCompleted: (findingId, method, durationMinutes) => {
    trackEvent('remediation_completed', {
      event_category: 'remediation',
      finding_id: findingId,
      remediation_method: method,
      duration_minutes: durationMinutes,
      success: true,
      // High-value conversion event
      value: 5
    });
  },
  
  /**
   * Track automated remediation triggers
   */
  automatedRemediationTriggered: (findingId, automationType) => {
    trackEvent('automated_remediation_triggered', {
      event_category: 'remediation',
      finding_id: findingId,
      automation_type: automationType, // terraform, ansible, script, api
      value: 3
    });
  },
  
  /**
   * Track risk acceptance (alternative to remediation)
   */
  riskAccepted: (findingId, severity, justification) => {
    trackEvent('risk_accepted', {
      event_category: 'remediation',
      finding_id: findingId,
      severity: severity,
      has_justification: !!justification
    });
  },
  
  // ============================================================================
  // SRE DASHBOARD INTERACTIONS
  // ============================================================================
  
  /**
   * Track alert views in SRE dashboard
   */
  alertViewed: (alertId, alertType, severity) => {
    trackEvent('alert_viewed', {
      event_category: 'sre',
      alert_id: alertId,
      alert_type: alertType, // security, performance, availability, cost
      severity: severity,
      value: severity === 'critical' ? 2 : 1
    });
  },
  
  /**
   * Track alert acknowledgment
   */
  alertAcknowledged: (alertId, responseTime) => {
    trackEvent('alert_acknowledged', {
      event_category: 'sre',
      alert_id: alertId,
      response_time_seconds: responseTime,
      value: 2
    });
  },
  
  /**
   * Track infrastructure filtering/search
   */
  infrastructureFiltered: (filterType, filterValue, resultsCount) => {
    trackEvent('infrastructure_filtered', {
      event_category: 'sre',
      filter_type: filterType, // region, service, compliance_status, environment
      filter_value: filterValue,
      results_count: resultsCount
    });
  },
  
  /**
   * Track metric visualization interactions
   */
  metricViewed: (metricType, timeRange) => {
    trackEvent('metric_viewed', {
      event_category: 'sre',
      metric_type: metricType, // uptime, latency, error_rate, compliance_drift
      time_range: timeRange // 1h, 24h, 7d, 30d
    });
  },
  
  // ============================================================================
  // SEARCH & DISCOVERY
  // ============================================================================
  
  /**
   * Track dashboard search usage
   */
  dashboardSearchUsed: (query, resultsCount, filterContext = null) => {
    trackEvent('search', {
      event_category: 'engagement',
      search_term: query,
      results_count: resultsCount,
      filter_context: filterContext
    });
    
    // Also send as GA4 built-in search event
    trackEvent('view_search_results', {
      search_term: query
    });
  },
  
  /**
   * Track search result clicks (what users found valuable)
   */
  searchResultClicked: (query, resultType, resultPosition) => {
    trackEvent('search_result_clicked', {
      event_category: 'engagement',
      search_term: query,
      result_type: resultType, // finding, resource, policy, report
      result_position: resultPosition
    });
  },
  
  // ============================================================================
  // USER ENGAGEMENT
  // ============================================================================
  
  /**
   * Track feature discovery/first use
   */
  featureDiscovered: (featureName) => {
    trackEvent('feature_discovered', {
      event_category: 'engagement',
      feature_name: featureName,
      value: 1
    });
  },
  
  /**
   * Track dashboard section engagement
   */
  sectionViewed: (sectionName, timeSpentSeconds) => {
    trackEvent('section_engagement', {
      event_category: 'engagement',
      section_name: sectionName,
      time_spent_seconds: timeSpentSeconds
    });
  },
  
  /**
   * Track filter application (important for understanding user intent)
   */
  filterApplied: (filterType, filterValue, contextPage) => {
    trackEvent('filter_applied', {
      event_category: 'engagement',
      filter_type: filterType,
      filter_value: filterValue,
      context_page: contextPage
    });
  },
  
  /**
   * Track export actions (CSV, JSON, etc.)
   */
  dataExported: (dataType, format, recordCount) => {
    trackEvent('data_exported', {
      event_category: 'engagement',
      data_type: dataType,
      format: format,
      record_count: recordCount,
      value: 1
    });
  },
  
  // ============================================================================
  // INTEGRATION & API USAGE
  // ============================================================================
  
  /**
   * Track integration connections
   */
  integrationConnected: (integrationType, integrationName) => {
    trackEvent('integration_connected', {
      event_category: 'integrations',
      integration_type: integrationType, // cloud_provider, ticketing, cicd, monitoring
      integration_name: integrationName, // aws, azure, gcp, jira, github, datadog
      value: 5
    });
  },
  
  /**
   * Track API key generation (indicates programmatic usage)
   */
  apiKeyGenerated: (keyType, scopes) => {
    trackEvent('api_key_generated', {
      event_category: 'integrations',
      key_type: keyType, // readonly, readwrite, admin
      scopes: scopes?.join(',') || 'all',
      value: 3
    });
  },
  
  // ============================================================================
  // COLLABORATION
  // ============================================================================
  
  /**
   * Track team member invitations
   */
  teamMemberInvited: (role, inviteMethod) => {
    trackEvent('team_member_invited', {
      event_category: 'collaboration',
      member_role: role,
      invite_method: inviteMethod, // email, link
      value: 4
    });
  },
  
  /**
   * Track finding comments/collaboration
   */
  findingCommented: (findingId, commentLength) => {
    trackEvent('finding_commented', {
      event_category: 'collaboration',
      finding_id: findingId,
      comment_length: commentLength,
      value: 2
    });
  },
  
  // ============================================================================
  // ERRORS & EXCEPTIONS
  // ============================================================================
  
  /**
   * Track application errors
   */
  errorOccurred: (errorType, errorMessage, isFatal = false) => {
    trackEvent('exception', {
      description: `${errorType}: ${errorMessage}`,
      fatal: isFatal
    });
  }
};

/**
 * User Identification & Properties
 */
export const identifyUser = (userId, userProperties = {}) => {
  if (!isAnalyticsAvailable()) return;
  
  try {
    // Set user ID for cross-session tracking
    gtag('config', window.GA4_MEASUREMENT_ID || 'GA4-XXXXXXX', {
      user_id: userId
    });
    
    // Set user properties for segmentation
    gtag('set', 'user_properties', {
      user_role: userProperties.role || 'viewer',
      account_tier: userProperties.tier || 'free',
      compliance_frameworks: userProperties.frameworks?.join(',') || 'none',
      organization_size: userProperties.orgSize || 'unknown',
      industry: userProperties.industry || 'unknown',
      team_size: userProperties.teamSize || 1,
      active_integrations: userProperties.integrations?.join(',') || 'none'
    });
    
    console.debug('[Analytics] User identified:', userId, userProperties);
  } catch (error) {
    console.error('[Analytics] Error identifying user:', error);
  }
};

/**
 * Session tracking utilities
 */
export const SessionTracking = {
  /**
   * Log session start with device/browser info
   */
  logSessionStart: () => {
    if (!isAnalyticsAvailable()) return;
    
    const sessionData = {
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      platform: navigator.platform,
      referrer: document.referrer || 'direct',
      is_mobile: /iPhone|iPad|Android/i.test(navigator.userAgent)
    };
    
    trackEvent('session_start', {
      event_category: 'engagement',
      ...sessionData
    });
    
    console.debug('[Analytics] Session started:', sessionData);
  },
  
  /**
   * Track engagement time on specific sections
   */
  trackSectionTime: (() => {
    let currentSection = null;
    let sectionStartTime = null;
    
    return (sectionName) => {
      // Log time for previous section
      if (currentSection && sectionStartTime) {
        const timeSpent = Math.floor((Date.now() - sectionStartTime) / 1000);
        
        if (timeSpent > 0) {
          ComplianceEvents.sectionViewed(currentSection, timeSpent);
        }
      }
      
      // Start tracking new section
      currentSection = sectionName;
      sectionStartTime = sectionName ? Date.now() : null;
    };
  })()
};

/**
 * Conversion tracking for key business metrics
 */
export const ConversionEvents = {
  /**
   * Track demo to signup conversion
   */
  signupCompleted: (signupMethod, tier) => {
    trackEvent('sign_up', {
      method: signupMethod, // email, google, github, sso
      tier: tier,
      value: 10
    });
  },
  
  /**
   * Track trial start
   */
  trialStarted: (tier, duration) => {
    trackEvent('trial_started', {
      tier: tier,
      duration_days: duration,
      value: 20
    });
  },
  
  /**
   * Track upgrade events
   */
  accountUpgraded: (fromTier, toTier, revenue) => {
    trackEvent('purchase', {
      transaction_id: `upgrade_${Date.now()}`,
      value: revenue,
      currency: 'USD',
      items: [{
        item_name: `${toTier} Plan`,
        item_category: 'subscription',
        price: revenue
      }]
    });
  }
};

export default {
  trackPageView,
  ComplianceEvents,
  identifyUser,
  SessionTracking,
  ConversionEvents,
  isAnalyticsAvailable
};
