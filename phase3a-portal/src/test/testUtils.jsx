/**
 * Test utilities and helpers
 * Phase 4: Testing & Quality Assurance
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with Router context
 * Use this instead of @testing-library/react's render when testing
 * components that use React Router hooks
 */
export function renderWithRouter(ui, { route = '/' } = {}) {
  window.history.pushState({}, 'Test page', route);
  
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
}

/**
 * Mock API response helper
 */
export const mockApiResponse = (data, options = {}) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    ...options,
  });
};

/**
 * Mock API error helper
 */
export const mockApiError = (message = 'API Error', status = 500) => {
  return Promise.reject({
    ok: false,
    status,
    message,
  });
};

/**
 * Wait for async operations
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

export default {
  renderWithRouter,
  mockApiResponse,
  mockApiError,
  waitForAsync,
};
