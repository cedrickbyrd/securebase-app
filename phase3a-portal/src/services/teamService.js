/**
 * Team Management Service
 * API integration for Phase 4 Team Collaboration & RBAC
 */

import api from './api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.aws';

/**
 * User Management APIs
 */

// Create a new user
export const createUser = async (userData, sessionToken) => {
  const response = await api.post(`${API_BASE}/users`, userData, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// Get list of users
export const getUsers = async (filters, sessionToken) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`${API_BASE}/users?${params}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Get user by ID
export const getUser = async (userId, sessionToken) => {
  const response = await api.get(`${API_BASE}/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Update user profile
export const updateUser = async (userId, userData, sessionToken) => {
  const response = await api.put(`${API_BASE}/users/${userId}`, userData, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// Update user role
export const updateUserRole = async (userId, role, sessionToken) => {
  const response = await api.put(`${API_BASE}/users/${userId}/role`, { role }, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// Update user status
export const updateUserStatus = async (userId, status, sessionToken) => {
  const response = await api.put(`${API_BASE}/users/${userId}/status`, { status }, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

// Delete user
export const deleteUser = async (userId, sessionToken) => {
  const response = await api.delete(`${API_BASE}/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Reset user password
export const resetUserPassword = async (userId, sessionToken) => {
  const response = await api.post(`${API_BASE}/users/${userId}/reset-password`, {}, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Unlock user account
export const unlockUserAccount = async (userId, sessionToken) => {
  const response = await api.post(`${API_BASE}/users/${userId}/unlock`, {}, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

/**
 * Session Management APIs
 */

// Login with email and password
export const login = async (email, password) => {
  const response = await api.post(`${API_BASE}/auth/login`, {
    email,
    password
  });
  return response.data;
};

// Verify MFA code
export const verifyMFA = async (preAuthToken, mfaCode) => {
  const response = await api.post(`${API_BASE}/auth/mfa/verify`, {
    pre_auth_token: preAuthToken,
    mfa_code: mfaCode
  });
  return response.data;
};

// Setup MFA
export const setupMFA = async (userId, sessionToken) => {
  const response = await api.post(`${API_BASE}/auth/mfa/setup`, { user_id: userId }, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Refresh session
export const refreshSession = async (refreshToken) => {
  const response = await api.post(`${API_BASE}/auth/refresh`, {
    refresh_token: refreshToken
  });
  return response.data;
};

// Logout
export const logout = async (sessionToken) => {
  const response = await api.post(`${API_BASE}/auth/logout`, {
    session_token: sessionToken
  });
  return response.data;
};

// Get session info
export const getSessionInfo = async (sessionToken) => {
  const response = await api.get(`${API_BASE}/auth/session`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

/**
 * Activity Feed APIs
 */

// Get activity feed
export const getActivityFeed = async (filters, sessionToken) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`${API_BASE}/activity?${params}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Get user activity
export const getUserActivity = async (userId, filters, sessionToken) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`${API_BASE}/activity/user/${userId}?${params}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

// Get resource activity
export const getResourceActivity = async (resourceType, resourceId, filters, sessionToken) => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`${API_BASE}/activity/resource/${resourceType}/${resourceId}?${params}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    }
  });
  return response.data;
};

/**
 * Helper functions
 */

// Store session in local storage
export const storeSession = (sessionData) => {
  localStorage.setItem('session_token', sessionData.session_token);
  localStorage.setItem('refresh_token', sessionData.refresh_token);
  localStorage.setItem('user', JSON.stringify(sessionData.user));
  localStorage.setItem('expires_at', sessionData.expires_at);
};

// Get stored session
export const getStoredSession = () => {
  const sessionToken = localStorage.getItem('session_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const expiresAt = localStorage.getItem('expires_at');
  
  return {
    sessionToken,
    refreshToken,
    user,
    expiresAt
  };
};

// Clear stored session
export const clearSession = () => {
  localStorage.removeItem('session_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('expires_at');
};

// Check if session is expired
export const isSessionExpired = () => {
  const expiresAt = localStorage.getItem('expires_at');
  if (!expiresAt) return true;
  
  return new Date(expiresAt) < new Date();
};

// Get user role from stored session
export const getUserRole = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return user?.role || null;
};

// Check if user has permission
export const hasPermission = (requiredRole) => {
  const userRole = getUserRole();
  if (!userRole) return false;
  
  const roleHierarchy = {
    admin: 4,
    manager: 3,
    analyst: 2,
    viewer: 1
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

export default {
  // User management
  createUser,
  getUsers,
  getUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  resetUserPassword,
  unlockUserAccount,
  
  // Session management
  login,
  verifyMFA,
  setupMFA,
  refreshSession,
  logout,
  getSessionInfo,
  
  // Activity feed
  getActivityFeed,
  getUserActivity,
  getResourceActivity,
  
  // Helper functions
  storeSession,
  getStoredSession,
  clearSession,
  isSessionExpired,
  getUserRole,
  hasPermission
};
