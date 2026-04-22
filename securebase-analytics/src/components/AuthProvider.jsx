/**
 * AuthContext with Analytics Integration
 * 
 * This wraps your existing auth logic with user identification
 * and session tracking
 */

import React, { createContext, useContext, useEffect } from 'react';
import { identifyUser, SessionTracking, ConversionEvents } from '../utils/analytics';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Your existing auth logic here
  // const { user, aal, login, logout } = useYourAuthHook();
  
  // Example structure - replace with your actual auth state
  const user = {
    id: 'user_123',
    email: 'demo@securebase.com',
    role: 'admin', // admin, auditor, sre, viewer
    tier: 'team', // free, team, enterprise
    frameworks: ['SOC2', 'HIPAA'],
    orgSize: 'smb',
    industry: 'fintech',
    teamSize: 5,
    integrations: ['aws', 'github']
  };
  
  const aal = 'aal2'; // Your authentication assurance level
  
  // Track user identification when auth state changes
  useEffect(() => {
    if (user && aal && aal !== 'none') {
      identifyUser(user.id, {
        role: user.role,
        tier: user.tier,
        frameworks: user.frameworks,
        orgSize: user.orgSize,
        industry: user.industry,
        teamSize: user.teamSize,
        integrations: user.integrations
      });
      
      // Track session start on successful auth
      SessionTracking.logSessionStart();
    }
  }, [user, aal]);
  
  // Enhanced login with tracking
  const loginWithTracking = async (credentials, method = 'email') => {
    try {
      // Your existing login logic
      // const result = await login(credentials);
      
      // Track successful login
      ConversionEvents.signupCompleted(method, user?.tier || 'free');
      
      // return result;
    } catch (error) {
      // Track login failures
      ComplianceEvents.errorOccurred('login_failed', error.message, false);
      throw error;
    }
  };
  
  const value = {
    user,
    aal,
    isAuthenticated: aal && aal !== 'none',
    login: loginWithTracking,
    // logout,
    // ... other auth methods
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthProvider;
