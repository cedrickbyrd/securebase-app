/**
 * RBAC Service - API Client for Team Collaboration & RBAC
 *
 * Handles user management, roles, permissions, and audit logging.
 * Auth uses AWS Lambda JWT via API Gateway — no Supabase.
 * Token is stored as `sessionToken` via apiService helpers.
 *
 * @module rbacService
 */

import {
  getStoredSessionToken,
  clearStoredSessionToken,
  persistSessionToken,
  apiService,
} from './apiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

const PERMISSION_MATRIX = {
  admin: {
    users:      ['create', 'read', 'update', 'delete'],
    compliance: ['create', 'read', 'update', 'delete'],
    invoices:   ['create', 'read', 'update', 'delete'],
    audit_logs: ['create', 'read', 'update', 'delete'],
    tickets:    ['create', 'read', 'update', 'delete'],
    dashboard:  ['create', 'read', 'update', 'delete'],
    api_keys:   ['create', 'read', 'update', 'delete'],
    reports:    ['create', 'read', 'update', 'delete'],
    settings:   ['create', 'read', 'update', 'delete'],
  },
  manager: {
    users:      ['create', 'read', 'update'],
    compliance: ['create', 'read', 'update'],
    invoices:   ['create', 'read', 'update'],
    audit_logs: ['read'],
    tickets:    ['create', 'read', 'update'],
    dashboard:  ['create', 'read', 'update'],
    api_keys:   ['create', 'read', 'update'],
    reports:    ['create', 'read', 'update'],
    settings:   ['read', 'update'],
  },
  analyst: {
    compliance: ['read'],
    invoices:   ['read'],
    audit_logs: ['read'],
    tickets:    ['read'],
    dashboard:  ['read'],
    reports:    ['read'],
  },
  viewer: {
    dashboard:  ['read'],
    compliance: ['read'],
  },
};

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Decode a JWT payload without a library (base64url → JSON).
 * NOTE: This only decodes the payload — it does NOT verify the signature.
 * Signature verification is the backend's responsibility. Never use decoded
 * claims for security decisions that bypass the backend.
 * @private
 */
const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

/**
 * Make an authenticated API request using the stored session token.
 * @private
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = getStoredSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorBody = {};
      try { errorBody = await response.json(); } catch { /* ignore */ }
      throw new Error(errorBody.message || `API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Failed:', error);
    throw error;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current user by decoding the stored JWT payload.
 * @returns {Object|null} User object with email, role, tenant_id, org_name, plan, pilot_tier
 */
export const getCurrentUser = () => {
  const token = getStoredSessionToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    email:      payload.email      || null,
    role:       payload.role       || null,
    tenant_id:  payload.tenant_id  || null,
    org_name:   payload.org_name   || null,
    plan:       payload.plan       || null,
    pilot_tier: payload.pilot_tier || null,
  };
};

/**
 * Get current user role.
 * Fast path: localStorage.getItem('userRole') (set by apiService.authenticate on every login).
 * apiService.authenticate always writes userRole to localStorage when a token is received,
 * so this value stays in sync with the active session token.
 * Fallback: decode from JWT (handles edge cases where localStorage was cleared externally).
 * @returns {string|null} User role
 */
export const getCurrentUserRole = () => {
  const fastPath = localStorage.getItem('userRole');
  if (fastPath) return fastPath;
  const user = getCurrentUser();
  return user?.role || null;
};

/**
 * Check if the current user has a given permission.
 * @param {string} resourceType - Resource type (users, invoices, compliance, etc.)
 * @param {string} action - Action (create, read, update, delete)
 * @returns {boolean} Whether the current user has permission
 */
export const hasPermission = (resourceType, action) => {
  const role = getCurrentUserRole();
  if (!role) return false;
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return false;
  const resourcePermissions = rolePermissions[resourceType];
  if (!resourcePermissions) return false;
  return resourcePermissions.includes(action);
};

/**
 * Get authentication token.
 * @returns {string|null} Session token
 */
export const getAuthToken = () => getStoredSessionToken();

/**
 * Store auth token.
 * @param {string} token - JWT token
 */
export const storeAuthToken = (token) => persistSessionToken(token);

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get list of users for current customer.
 * @param {Object} filters - Filter criteria (role, status, search)
 * @returns {Promise<Object>} List of users and metadata
 */
export const getUsers = async (filters = {}) => {
  const queryString = new URLSearchParams(filters).toString();
  return apiRequest(`/users${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get single user by ID.
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} User details
 */
export const getUser = async (userId) => {
  return apiRequest(`/users/${userId}`);
};

/**
 * Create new user.
 * @param {Object} userData - User data (email, name, role)
 * @returns {Promise<Object>} Created user with temp password
 */
export const createUser = async (userData) => {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

/**
 * Update user details.
 * @param {string} userId - User UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
export const updateUser = async (userId, updates) => {
  return apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Update user role.
 * @param {string} userId - User UUID
 * @param {string} newRole - New role (admin, manager, analyst, viewer)
 * @returns {Promise<Object>} Updated user
 */
export const updateUserRole = async (userId, newRole) => {
  return apiRequest(`/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role: newRole }),
  });
};

/**
 * Delete user (soft delete).
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
export const deleteUser = async (userId) => {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  });
};

/**
 * Reset user password.
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} New temporary password
 */
export const resetUserPassword = async (userId) => {
  return apiRequest(`/users/${userId}/reset-password`, {
    method: 'POST',
  });
};

/**
 * Unlock user account.
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
export const unlockUser = async (userId) => {
  return apiRequest(`/users/${userId}/unlock`, {
    method: 'POST',
  });
};

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * User login — delegates to apiService.authenticate which handles token
 * storage, userRole, and userEmail in localStorage.
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Auth token or MFA challenge
 */
export const login = async (email, password) => {
  return apiService.authenticate(email, password);
};

/**
 * Verify MFA code.
 * @param {string} sessionId - Temporary session ID
 * @param {string} mfaCode - 6-digit TOTP code
 * @returns {Promise<Object>} Auth token
 */
export const verifyMFA = async (sessionId, mfaCode) => {
  return apiRequest('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, totp_code: mfaCode }),
  });
};

/**
 * Setup MFA for user.
 * @param {string} userId - User email
 * @returns {Promise<Object>} QR code URL and secret
 */
export const setupMFA = async (userId) => {
  return apiRequest('/auth/mfa/setup', {
    method: 'POST',
    body: JSON.stringify({ email: userId }),
  });
};

/**
 * Logout current user.
 * Clears stored session token and localStorage role/email keys.
 * @returns {Promise<void>}
 */
export const logout = async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Log but proceed — local cleanup must always happen even if the server
    // fails to invalidate the session (e.g. network error, already expired).
    console.warn('Server-side logout failed; proceeding with local cleanup:', err?.message);
  }
  clearStoredSessionToken();
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
};

// ============================================================================
// ROLES & PERMISSIONS FUNCTIONS
// ============================================================================

/**
 * Get available roles.
 * Real endpoint not yet implemented — returns placeholder data.
 * @returns {Promise<Array>} List of roles
 */
export const getRoles = async () => {
  return [
    { id: 'admin',   name: 'Admin',   description: 'Full access to all resources' },
    { id: 'manager', name: 'Manager', description: 'Manage team and view reports' },
    { id: 'analyst', name: 'Analyst', description: 'View and analyze data' },
    { id: 'viewer',  name: 'Viewer',  description: 'Basic read-only access' },
  ];
};

/**
 * Get user permissions.
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} List of permissions
 */
export const getUserPermissions = async (userId) => {
  return apiRequest(`/users/${userId}/permissions`);
};

// ============================================================================
// AUDIT LOG FUNCTIONS
// ============================================================================

/**
 * Get audit log events.
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @returns {Promise<Object>} Audit events and metadata
 */
export const getAuditLogs = async (filters = {}, page = 1) => {
  const queryString = new URLSearchParams({ ...filters, page }).toString();
  return apiRequest(`/activity?${queryString}`);
};

/**
 * Export audit logs as a file blob.
 * @param {string} format - Export format (csv, pdf)
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Blob>} File blob
 */
export const exportAuditLogs = async (format, filters = {}) => {
  const token = getStoredSessionToken();
  const queryString = new URLSearchParams({ ...filters, format }).toString();
  const response = await fetch(`${API_BASE_URL}/activity/export?${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  return await response.blob();
};

export default {
  // User Management
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
  resetUserPassword,
  unlockUser,

  // Authentication
  login,
  verifyMFA,
  setupMFA,
  logout,

  // Roles & Permissions
  getRoles,
  getUserPermissions,
  hasPermission,

  // Audit Logs
  getAuditLogs,
  exportAuditLogs,

  // Utilities
  getCurrentUser,
  getCurrentUserRole,
  getAuthToken,
  storeAuthToken,
};
