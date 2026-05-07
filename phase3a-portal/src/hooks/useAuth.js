/**
 * Portal Authentication Hook - Unified with Marketing Site
 * Sprint Day 2 - Issue 2: Replace Supabase with Lambda auth
 * 
 * This replaces the previous Supabase-based authentication with
 * the unified Lambda authentication that shares sessions with
 * the marketing site via secure httpOnly cookies.
 */

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// Use environment variable or fallback to production API
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || 'https://api.securebase.tximhotep.com';

// Feature flag to enable/disable unified auth (for safe rollout)
const USE_UNIFIED_AUTH = import.meta.env.VITE_USE_UNIFIED_AUTH !== 'false';

// Auth context
const AuthContext = createContext({});

// CSRF token management
const getCsrfToken = () => {
  const match = document.cookie.match(/securebase_csrf=([^;]+)/);
  return match ? match[1] : null;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    if (USE_UNIFIED_AUTH) {
      checkUnifiedSession();
    } else {
      // Fallback to legacy Supabase check
      checkLegacySession();
    }
  }, []);

  // Unified session check (Lambda/Cookie-based)
  const checkUnifiedSession = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/session/validate`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.user) {
          setUser(data.user);
          setSession({ expires_at: data.expires_at });
        } else {
          setUser(null);
          setSession(null);
        }
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Legacy Supabase session check (for rollback)
  const checkLegacySession = async () => {
    try {
      // This would check Supabase session
      // Keeping empty for now as Supabase is being removed
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Legacy session check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Unified login
  const signInWithEmail = async ({ email, password }) => {
    if (!USE_UNIFIED_AUTH) {
      throw new Error('Legacy auth not implemented');
    }

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
        if (data.mfa_required) {
          // Return MFA challenge info
          return { 
            data: null,
            error: null,
            mfa_required: true,
            pre_auth_token: data.pre_auth_token 
          };
        }

        // Login successful
        setUser(data.user);
        setSession({ expires_at: data.expires_at });
        return { data: { user: data.user }, error: null };
      } else {
        return { data: null, error: { message: data.error || 'Login failed' } };
      }
    } catch (error) {
      return { 
        data: null, 
        error: { message: 'Network error during login' } 
      };
    }
  };

  // MFA verification
  const verifyMFA = async (code, preAuthToken) => {
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
        setSession({ expires_at: data.expires_at });
        return { data: { user: data.user }, error: null };
      } else {
        return { data: null, error: { message: data.error || 'MFA verification failed' } };
      }
    } catch (error) {
      return { 
        data: null, 
        error: { message: 'Network error during MFA verification' } 
      };
    }
  };

  // Unified signup
  const signUp = async ({ email, password, options = {} }) => {
    if (!USE_UNIFIED_AUTH) {
      throw new Error('Legacy auth not implemented');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: options.data?.full_name,
          company_name: options.data?.company_name,
          ...options.data
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Auto-login after signup
        const loginResult = await signInWithEmail({ email, password });
        return loginResult;
      } else {
        return { data: null, error: { message: data.error || 'Signup failed' } };
      }
    } catch (error) {
      return { 
        data: null, 
        error: { message: 'Network error during signup' } 
      };
    }
  };

  // Unified logout
  const signOut = async () => {
    try {
      const csrfToken = getCsrfToken();
      
      await fetch(`${API_BASE_URL}/auth/logout/cookie`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSession(null);
      // Redirect to login
      window.location.href = '/login';
    }
  };

  // Make authenticated API calls
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const csrfToken = getCsrfToken();
    
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...options.headers
      }
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase())) {
      defaultOptions.headers['X-CSRF-Token'] = csrfToken;
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
      setUser(null);
      setSession(null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    return response;
  }, []);

  // Compatibility layer for components expecting Supabase-style API
  const auth = {
    user,
    session,
    signInWithEmail,
    signUp,
    signOut,
    verifyMFA,
    onAuthStateChange: (callback) => {
      // Compatibility for Supabase onAuthStateChange
      // In unified auth, we handle this differently
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  };

  // Context value with both old and new API
  const value = {
    // Supabase-compatible API
    auth,
    user,
    session,
    isAuthenticated: !!user,
    signInWithEmail,
    signUp,
    signOut,
    verifyMFA,
    
    // New unified API
    loading,
    authenticatedFetch,
    checkSession: USE_UNIFIED_AUTH ? checkUnifiedSession : checkLegacySession,
    
    // Feature flag
    isUnifiedAuth: USE_UNIFIED_AUTH
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// HOC for protected routes (compatible with existing code)
export const withAuth = (Component) => {
  return function ProtectedComponent(props) {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
      if (!loading && !user) {
        navigate('/login');
      }
    }, [loading, user, navigate]);
    
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }
    
    if (!user) {
      return null;
    }
    
    return <Component {...props} />;
  };
};

// For components that need to check roles
export const useRole = () => {
  const { user } = useAuth();
  
  const hasRole = (requiredRole) => {
    if (!user) return false;
    
    const roleHierarchy = {
      'admin': 3,
      'analyst': 2,
      'viewer': 1
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  };
  
  const canEdit = () => hasRole('analyst');
  const canAdmin = () => hasRole('admin');
  
  return { 
    hasRole, 
    canEdit, 
    canAdmin,
    currentRole: user?.role 
  };
};