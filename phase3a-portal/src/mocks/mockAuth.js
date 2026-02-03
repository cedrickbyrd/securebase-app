// Mock authentication service for demo mode
// Accepts username: "demo" and password: "demo"
// Includes basic rate limiting to prevent abuse

export class MockAuthService {
  constructor() {
    // Demo user record (safe to ship - obviously not real secret)
    this.demoUser = {
      id: 'demo-user-001',
      username: 'demo',
      name: 'Demo User',
      email: 'demo@securebase.io',
      roles: ['demo']
    };
    this.demoToken = 'demo-token-000';
    
    // Rate limiting: track failed attempts per IP/session
    this.failedAttempts = new Map();
    this.MAX_ATTEMPTS = 5;
    this.LOCKOUT_DURATION = 60000; // 1 minute in ms
  }

  _getClientId() {
    // Use session storage to track attempts (simple client-side rate limiting)
    return 'demo-session';
  }

  _isRateLimited() {
    const clientId = this._getClientId();
    const attempts = this.failedAttempts.get(clientId);
    
    if (!attempts) return false;
    
    const { count, lastAttempt } = attempts;
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    
    // Reset if lockout period has passed
    if (timeSinceLastAttempt > this.LOCKOUT_DURATION) {
      this.failedAttempts.delete(clientId);
      return false;
    }
    
    return count >= this.MAX_ATTEMPTS;
  }

  _recordFailedAttempt() {
    const clientId = this._getClientId();
    const current = this.failedAttempts.get(clientId) || { count: 0, lastAttempt: 0 };
    
    this.failedAttempts.set(clientId, {
      count: current.count + 1,
      lastAttempt: Date.now()
    });
  }

  _clearFailedAttempts() {
    const clientId = this._getClientId();
    this.failedAttempts.delete(clientId);
  }

  async login({ username, password }) {
    // Simulate network latency
    await new Promise(r => setTimeout(r, 250));

    // Check rate limiting
    if (this._isRateLimited()) {
      const err = new Error('Too many failed attempts. Please try again in 1 minute.');
      err.status = 429;
      throw err;
    }

    // Validate credentials
    if (username === 'demo' && password === 'demo') {
      this._clearFailedAttempts();
      return {
        token: this.demoToken,
        user: this.demoUser,
        expires_in: 3600
      };
    }

    // Record failed attempt and fail
    this._recordFailedAttempt();
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  async logout() {
    await new Promise(r => setTimeout(r, 50));
    this._clearFailedAttempts();
    return { success: true };
  }

  async whoami(token) {
    await new Promise(r => setTimeout(r, 100));
    if (token === this.demoToken) return this.demoUser;
    return null;
  }

  // Utility method to check rate limit status
  getRateLimitInfo() {
    const clientId = this._getClientId();
    const attempts = this.failedAttempts.get(clientId);
    
    if (!attempts) {
      return { remaining: this.MAX_ATTEMPTS, isLocked: false };
    }

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    const isLocked = this._isRateLimited();
    
    return {
      remaining: Math.max(0, this.MAX_ATTEMPTS - attempts.count),
      isLocked,
      unlockTime: isLocked ? new Date(attempts.lastAttempt + this.LOCKOUT_DURATION) : null
    };
  }
}
