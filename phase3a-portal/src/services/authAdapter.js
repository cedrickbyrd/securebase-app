// Auth adapter: choose MockAuthService in demo mode, otherwise use existing real client
import { MockAuthService } from '../mocks/mockAuth';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

let authClient;

if (USE_MOCK) {
  authClient = new MockAuthService();
} else {
  // In production builds without mock mode, we'll use MockAuthService as fallback
  // since there's no real auth service yet. When a real service is implemented,
  // it should be imported here conditionally.
  authClient = new MockAuthService();
}

export default authClient;
