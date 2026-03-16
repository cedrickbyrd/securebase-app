import { MockAuthService } from '../mocks/mockAuth';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.securebase.tximhotep.com';

class RealAuthService {
  async login(email, password, totp_code) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, totp_code })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  async register(email, password) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  async setupMFA(email) {
    const res = await fetch(`${API_URL}/auth/mfa/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }

  async verifyMFA(email, totp_code) {
    const res = await fetch(`${API_URL}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, totp_code })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  }
}

const authClient = USE_MOCK ? new MockAuthService() : new RealAuthService();
export default authClient;
