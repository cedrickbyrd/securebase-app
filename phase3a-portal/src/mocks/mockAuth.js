// Mock authentication service for demo mode
// Accepts username: "demo" and password: "demo"

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
  }

  async login({ username, password }) {
    // Simulate network latency
    await new Promise(r => setTimeout(r, 250));

    if (username === 'demo' && password === 'demo') {
      return {
        token: this.demoToken,
        user: this.demoUser,
        expires_in: 3600
      };
    }

    // Fail for anything else
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  async logout() {
    await new Promise(r => setTimeout(r, 50));
    return { success: true };
  }

  async whoami(token) {
    await new Promise(r => setTimeout(r, 100));
    if (token === this.demoToken) return this.demoUser;
    return null;
  }
}
