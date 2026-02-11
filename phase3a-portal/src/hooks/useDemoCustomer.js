/**
 * Demo Customer Rotation Hook
 * 
 * Manages which demo customer is displayed to each visitor using a time-based rotation system.
 * Rotates customers every 15 minutes globally, providing diversity across demo sessions.
 * 
 * Features:
 * - Time-based rotation: Changes customer every 15 minutes
 * - Session persistence: Same customer throughout user's session
 * - Fallback support: Can switch to backend counter when available
 */

import { useState, useEffect } from 'react';
import { mockCustomers } from '../mocks/mockData';

const ROTATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEMO_COUNTER_API = import.meta.env.VITE_DEMO_COUNTER_API;
const USE_BACKEND_COUNTER = import.meta.env.VITE_DEMO_COUNTER_ENABLED === 'true';

/**
 * Get customer index using time-based rotation
 * Formula: floor(currentTime / 15min) % 5
 * This ensures all visitors in the same 15-minute window see the same customer
 */
const getTimeBasedCustomerIndex = () => {
  return Math.floor(Date.now() / ROTATION_INTERVAL_MS) % 5;
};

/**
 * Fetch customer index from backend counter (when available)
 */
const fetchBackendCustomerIndex = async () => {
  try {
    const response = await fetch(DEMO_COUNTER_API);
    if (!response.ok) {
      throw new Error('Backend counter unavailable');
    }
    const data = await response.json();
    return data.customerIndex;
  } catch (error) {
    console.warn('Failed to fetch backend counter, falling back to time-based:', error);
    return null;
  }
};

/**
 * Custom hook to get the current demo customer
 * 
 * @returns {Object} Current demo customer object
 */
export const useDemoCustomer = () => {
  const [customer, setCustomer] = useState(null);
  const [customerIndex, setCustomerIndex] = useState(null);

  useEffect(() => {
    const initializeCustomer = async () => {
      // Check session storage first for persistence
      const storedIndex = sessionStorage.getItem('demoCustomerIndex');
      
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        setCustomerIndex(index);
        setCustomer(mockCustomers[index]);
        return;
      }

      // Try backend counter if enabled
      let index = null;
      if (USE_BACKEND_COUNTER && DEMO_COUNTER_API) {
        index = await fetchBackendCustomerIndex();
      }

      // Fallback to time-based rotation
      if (index === null) {
        index = getTimeBasedCustomerIndex();
      }

      // Store in session for persistence
      sessionStorage.setItem('demoCustomerIndex', index.toString());
      setCustomerIndex(index);
      setCustomer(mockCustomers[index]);
    };

    initializeCustomer();
  }, []);

  return {
    customer,
    customerIndex,
    rotationMethod: USE_BACKEND_COUNTER ? 'backend-counter' : 'time-based',
    allCustomers: mockCustomers
  };
};

/**
 * Get next rotation time (for display purposes)
 */
export const getNextRotationTime = () => {
  const now = Date.now();
  const currentWindowStart = Math.floor(now / ROTATION_INTERVAL_MS) * ROTATION_INTERVAL_MS;
  const nextRotation = currentWindowStart + ROTATION_INTERVAL_MS;
  return new Date(nextRotation);
};

/**
 * Get customer name by index (for display)
 */
export const getCustomerNameByIndex = (index) => {
  if (index >= 0 && index < mockCustomers.length) {
    return mockCustomers[index].name;
  }
  return 'Unknown Customer';
};
