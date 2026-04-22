/**
 * React hook for analytics tracking
 * Provides easy-to-use hooks for component-level tracking
 */

import { useEffect, useCallback, useRef } from 'react';
import { trackPageView, ComplianceEvents, SessionTracking } from '../utils/analytics';

/**
 * Track page views automatically when component mounts
 * @param {string} pageName - Human-readable page name
 * @param {object} metadata - Additional page metadata
 */
export const usePageTracking = (pageName, metadata = {}) => {
  useEffect(() => {
    const path = window.location.pathname;
    trackPageView(path, pageName, metadata);
  }, [pageName, metadata]);
};

/**
 * Track section engagement time
 * Automatically tracks how long user spends in a section
 * 
 * @param {string} sectionName - Name of the section
 * @returns {object} - Section ref to attach to element
 * 
 * @example
 * const sectionRef = useSectionTracking('compliance_dashboard');
 * return <div ref={sectionRef}>...</div>
 */
export const useSectionTracking = (sectionName) => {
  const sectionRef = useRef(null);
  const startTimeRef = useRef(null);
  
  useEffect(() => {
    startTimeRef.current = Date.now();
    SessionTracking.trackSectionTime(sectionName);
    
    return () => {
      if (startTimeRef.current) {
        const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (timeSpent > 0) {
          ComplianceEvents.sectionViewed(sectionName, timeSpent);
        }
      }
      SessionTracking.trackSectionTime(null);
    };
  }, [sectionName]);
  
  return sectionRef;
};

/**
 * Track user interactions with debouncing
 * Useful for tracking frequently-fired events like typing or scrolling
 * 
 * @param {Function} trackingFn - Function to call for tracking
 * @param {number} delay - Debounce delay in ms
 * 
 * @example
 * const trackSearch = useDebouncedTracking(
 *   (query) => ComplianceEvents.dashboardSearchUsed(query, results.length),
 *   500
 * );
 */
export const useDebouncedTracking = (trackingFn, delay = 300) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      trackingFn(...args);
    }, delay);
  }, [trackingFn, delay]);
};

/**
 * Track feature usage (fires only once per feature per session)
 * 
 * @param {string} featureName - Name of the feature
 * @returns {Function} - Function to call when feature is used
 * 
 * @example
 * const trackFilterUsage = useFeatureTracking('advanced_filters');
 * // Call when user interacts with feature
 * trackFilterUsage();
 */
export const useFeatureTracking = (featureName) => {
  const hasTrackedRef = useRef(false);
  
  return useCallback(() => {
    if (!hasTrackedRef.current) {
      ComplianceEvents.featureDiscovered(featureName);
      hasTrackedRef.current = true;
    }
  }, [featureName]);
};

/**
 * Track performance metrics for long-running operations
 * 
 * @returns {object} - Performance tracking utilities
 * 
 * @example
 * const { startTimer, endTimer } = usePerformanceTracking();
 * 
 * const handleScan = async () => {
 *   const timerId = startTimer('policy_scan');
 *   await runScan();
 *   endTimer(timerId, { policyType: 'SOC2' });
 * };
 */
export const usePerformanceTracking = () => {
  const timersRef = useRef({});
  
  const startTimer = useCallback((operationName) => {
    const timerId = `${operationName}_${Date.now()}`;
    timersRef.current[timerId] = {
      name: operationName,
      startTime: performance.now()
    };
    return timerId;
  }, []);
  
  const endTimer = useCallback((timerId, metadata = {}) => {
    const timer = timersRef.current[timerId];
    if (!timer) return;
    
    const duration = performance.now() - timer.startTime;
    const durationSeconds = Math.floor(duration / 1000);
    
    // Track as custom event
    ComplianceEvents.sectionViewed(
      `performance_${timer.name}`,
      durationSeconds
    );
    
    console.debug(`[Performance] ${timer.name}: ${durationSeconds}s`, metadata);
    
    delete timersRef.current[timerId];
  }, []);
  
  return { startTimer, endTimer };
};

/**
 * Track scroll depth for long pages
 * Useful for understanding how far users read in documentation or reports
 * 
 * @param {number} threshold - Percentage threshold to track (default: 25)
 */
export const useScrollTracking = (threshold = 25) => {
  const trackedDepthsRef = useRef(new Set());
  
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const scrollPercentage = ((scrollTop + windowHeight) / documentHeight) * 100;
      
      // Track at 25%, 50%, 75%, 100%
      const depths = [25, 50, 75, 100];
      depths.forEach(depth => {
        if (scrollPercentage >= depth && !trackedDepthsRef.current.has(depth)) {
          trackedDepthsRef.current.add(depth);
          
          ComplianceEvents.sectionViewed(
            `scroll_depth_${depth}`,
            Math.floor(scrollPercentage)
          );
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
};

/**
 * Track form interactions and abandonment
 * 
 * @param {string} formName - Name of the form
 * @returns {object} - Form tracking handlers
 * 
 * @example
 * const { onFieldFocus, onFormSubmit } = useFormTracking('remediation_form');
 * 
 * <form onSubmit={onFormSubmit}>
 *   <input onFocus={() => onFieldFocus('description')} />
 * </form>
 */
export const useFormTracking = (formName) => {
  const startTimeRef = useRef(null);
  const fieldsInteractedRef = useRef(new Set());
  
  const onFieldFocus = useCallback((fieldName) => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    fieldsInteractedRef.current.add(fieldName);
  }, []);
  
  const onFormSubmit = useCallback((success = true) => {
    const timeSpent = startTimeRef.current 
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;
    
    ComplianceEvents.sectionViewed(
      `form_${formName}_${success ? 'completed' : 'abandoned'}`,
      timeSpent
    );
    
    // Reset
    startTimeRef.current = null;
    fieldsInteractedRef.current.clear();
  }, [formName]);
  
  useEffect(() => {
    // Track abandonment on unmount if form was started but not submitted
    return () => {
      if (startTimeRef.current && fieldsInteractedRef.current.size > 0) {
        onFormSubmit(false);
      }
    };
  }, [onFormSubmit]);
  
  return { onFieldFocus, onFormSubmit };
};

export default {
  usePageTracking,
  useSectionTracking,
  useDebouncedTracking,
  useFeatureTracking,
  usePerformanceTracking,
  useScrollTracking,
  useFormTracking
};
