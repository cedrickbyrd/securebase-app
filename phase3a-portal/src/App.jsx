import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { initializeSessionTracking } from './utils/analytics';
import { isDemoMode } from './utils/demoData';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import SignupForm from './components/SignupForm';
import OnboardingProgress from './components/OnboardingProgress';
import Compliance from './components/Compliance';
import TexasExaminerPortal from './components/TexasExaminerPortal';
import SREDashboardWrapper from './components/SREDashboardWrapper';
import AlertManagement from './components/AlertManagement';
import LandingPage from './pages/LandingPage';
import ThankYou from './pages/ThankYou';
import './App.css';

function OnboardingRoute() {
  const [params] = useSearchParams();
  return (
    <OnboardingProgress
      jobId={params.get('jobId')}
      email={params.get('email')}
    />
  );
}

const DEMO_EMAIL = 'demo@securebase.tximhotep.com';
const DEMO_CUSTOMER_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_NAME = 'Acme Corporation';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    if (import.meta.env.VITE_DEMO_MODE === 'true' && !localStorage.getItem('sessionToken')) {
      // Seed demo session once so all subsequent isDemoMode() checks pass
      localStorage.setItem('demo_mode', 'true');
      localStorage.setItem('demo_user', JSON.stringify({
        email: DEMO_EMAIL,
        customerId: DEMO_CUSTOMER_ID,
        orgName: DEMO_ORG_NAME,
      }));
    }
    return !!localStorage.getItem('sessionToken') || isDemoMode();
  });

  useEffect(() => {
    initializeSessionTracking();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login"      element={<Login setAuth={setIsAuthenticated} />} />
        <Route path="/signup"     element={<SignupForm onSuccess={({ email, jobId }) =>
          window.location.href = `/onboarding?jobId=${jobId}&email=${encodeURIComponent(email)}`
        } />} />
        <Route path="/register"   element={<Navigate to="/signup" replace />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/dashboard"     element={isAuthenticated ? <Dashboard />       : <Navigate to="/login" />} />
        <Route path="/compliance"    element={isAuthenticated ? <Compliance />      : <Navigate to="/login" />} />
        <Route path="/fintech-portal" element={isAuthenticated ? <TexasExaminerPortal /> : <Navigate to="/login" />} />
        <Route path="/sre-dashboard" element={isAuthenticated ? <SREDashboardWrapper />   : <Navigate to="/login" />} />
        <Route path="/alerts"        element={isAuthenticated ? <AlertManagement />: <Navigate to="/login" />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
