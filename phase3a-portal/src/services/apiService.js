const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

class ApiService {
  constructor() { this.baseURL = API_BASE; }

  request = async (endpoint, options = {}) => {
    // Read token from sessionStorage only (not localStorage) to limit XSS exposure.
    // HttpOnly cookies are sent automatically via credentials:'include'.
    const sessionToken = sessionStorage.getItem('sessionToken');
    const config = {
      credentials: 'include', // send HttpOnly JWT cookie on same-origin requests
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        ...options.headers,
      },
      ...options,
    };
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      if (response.status === 401) {
        if (sessionToken) {
          sessionStorage.removeItem('sessionToken');
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  };

  get    = async (endpoint, options = {}) => this.request(endpoint, { ...options, method: 'GET' });
  post   = async (endpoint, data, options = {}) => this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });
  put    = async (endpoint, data, options = {}) => this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) });
  delete = async (endpoint, options = {}) => this.request(endpoint, { ...options, method: 'DELETE' });

  authenticate = async (email, password, totp_code = null) => {
    const payload = { email, password };
    if (totp_code) payload.totp_code = totp_code;
    try {
      const response = await this.post('/auth/login', payload);
      if (response.token) {
        // Store in sessionStorage (cleared when the tab closes) rather than
        // localStorage to reduce the XSS attack surface.
        sessionStorage.setItem('sessionToken', response.token);
        localStorage.setItem('userEmail', response.user?.email || email);
        localStorage.setItem('userRole', response.user?.role || 'user');
      }
      return response;
    } catch (error) {
      throw new Error(
        error.message.includes('fetch')
          ? 'Network error. Please check your connection and try again.'
          : 'Invalid credentials. Please check your email and password.'
      );
    }
  };

  register  = async (email, password) => this.post('/auth/register', { email, password });
  setupMFA  = async (email) => this.post('/auth/mfa/setup', { email });
  verifyMFA = async (email, totp_code) => this.post('/auth/mfa/verify', { email, totp_code });

  getMetrics          = async () => this.get('/billing/metrics');
  getDashboardData    = async () => this.get('/billing/dashboard');
  getUserProfile      = async () => this.get('/user/profile');
  getInvoices         = async () => this.get('/billing/invoices');
  getApiKeys          = async () => this.get('/api-keys');
  getComplianceStatus = async () => this.get('/compliance/status');
  getTickets          = async (params) => this.get('/tickets', { params });
  createTicket        = async (ticketData) => this.post('/tickets', ticketData);

  // Texas Fintech Compliance (fintech_pro / fintech_elite tiers)
  getFintechComplianceStatus = async (customerId) => {
    const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : '';
    return this.get(`/fintech/compliance-status${query}`);
  };
  getFintechTransactions = async ({ customerId, startDate, endDate, limit = 50, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (customerId) params.set('customer_id', customerId);
    if (startDate)  params.set('start_date', startDate);
    if (endDate)    params.set('end_date', endDate);
    params.set('limit', limit);
    params.set('offset', offset);
    return this.get(`/fintech/transactions?${params.toString()}`);
  };

  // Signup & Onboarding — FIX: getOnboardingStatus now uses jobId not customer_id
  signup              = async (payload) => this.post('/signup', payload);
  verifyEmail         = async (token, email) => this.post('/verify-email', { token, email });
  getOnboardingStatus = async (jobId) => this.get(`/onboarding/status?jobId=${encodeURIComponent(jobId)}`);
  resendVerification  = async (email) => this.post('/signup/resend-verification', { email });
}

export const apiService = new ApiService();
export default apiService;