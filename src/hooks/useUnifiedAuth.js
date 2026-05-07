/**
 * Unified Authentication Hook
 * Sprint Day 2 - Issue 2: Frontend auth integration
 * 
 * Provides authentication functionality that works across
 * marketing site and portal using secure httpOnly cookies.
 */

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.securebase.tximhotep.com';

// Auth context
const AuthContext = createContext({});

// CSRF token management
let csrfToken = null;

const getCsrfToken = () => {
  // Read CSRF token from cookie (not httpOnly)
  const match = document.cookie.match(/securebase_csrf=([^;]+)/);
  return match ? match[1] : null;
};

export const UnifiedAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session/validate`, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.user) {
          setUser(data.user);
          csrfToken = getCsrfToken();
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      setError('Failed to check session');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        csrfToken = getCsrfToken();
        
        // Check if MFA is required
        if (data.mfa_required) {
          return { 
            success: true, 
            mfa_required: true,
            pre_auth_token: data.pre_auth_token 
          };
        }
        
        return { success: true, user: data.user };
      } else {
        setError(data.error || 'Login failed');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error during login';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyMFA = useCallback(async (code, preAuthToken) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ 
          mfa_code: code,
          pre_auth_token: preAuthToken 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        csrfToken = getCsrfToken();
        return { success: true, user: data.user };
      } else {
        setError(data.error || 'MFA verification failed');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Network error during MFA verification';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        // After signup, create session
        const sessionResponse = await fetch(`${API_BASE_URL}/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            temporary_token: data.temporary_token
          })
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setUser(sessionData.user);
          csrfToken = getCsrfToken();
          return { success: true, user: sessionData.user };
        }
      }
      
      setError(data.error || 'Signup failed');
      return { success: false, error: data.error };
    } catch (err) {
      const errorMsg = 'Network error during signup';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await fetch(`${API_BASE_URL}/auth/logout/cookie`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken || getCsrfToken()
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      csrfToken = null;
      setLoading(false);
      
      // Redirect to login page
      window.location.href = '/login';
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken || getCsrfToken()
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        csrfToken = getCsrfToken();
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (err) {
      console.error('Session refresh failed:', err);
      return { success: false };
    }
  }, []);

  // Make authenticated API calls with CSRF protection
  const apiCall = useCallback(async (url, options = {}) => {
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...options.headers
      }
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
      defaultOptions.headers['X-CSRF-Token'] = csrfToken || getCsrfToken();
    }

    // Add content-type for JSON bodies
    if (options.body && typeof options.body === 'object') {
      defaultOptions.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(
      url.startsWith('http') ? url : `${API_BASE_URL}${url}`,
      { ...defaultOptions, ...options }
    );

    // Handle 401 - session expired
    if (response.status === 401) {
      const refreshResult = await refreshSession();
      if (refreshResult.success) {
        // Retry original request
        return apiCall(url, options);
      } else {
        // Session refresh failed, redirect to login
        setUser(null);
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    return response;
  }, [refreshSession]);

  const value = {
    user,
    loading,
    error,
    login,
    verifyMFA,
    signup,
    logout,
    checkSession,
    refreshSession,
    apiCall,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useUnifiedAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth must be used within UnifiedAuthProvider');
  }
  return context;
};

// HOC for protected routes
export const withAuth = (Component) => {
  return function ProtectedComponent(props) {
    const { user, loading } = useUnifiedAuth();
    
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }
    
    if (!user) {
      window.location.href = '/login';
      return null;
    }
    
    return <Component {...props} />;
  };
};

// Utility to check if user has required role
export const useRole = () => {
  const { user } = useUnifiedAuth();
  
  const hasRole = useCallback((requiredRole) => {
    if (!user) return false;
    
    // Role hierarchy: admin > analyst > viewer
    const roleHierarchy = {
      'admin': 3,
      'analyst': 2,
      'viewer': 1
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  }, [user]);
  
  return { hasRole, currentRole: user?.role };
};