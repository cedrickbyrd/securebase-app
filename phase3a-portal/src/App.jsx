import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { initializeSessionTracking } from './utils/analytics';
import { isDemoMode } from './utils/demoData';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import OnboardingProgress from './components/OnboardingProgress';
import Compliance from './components/Compliance';
import TexasExaminerPortal from './components/TexasExaminerPortal';
import SREDashboardWrapper from './components/SREDashboardWrapper';
import AlertManagement from './components/AlertManagement';
import ExitIntentModal from './components/ExitIntentModal';
import LandingPage from './pages/LandingPage';
import DemoDashboard from './pages/DemoDashboard';
import ThankYou from './pages/ThankYou';
import Pricing from './pages/Pricing';
import Checkout from './pages/Checkout';
import ContactSales from './pages/ContactSales';
import ComplianceJumpstart from './pages/ComplianceJumpstart';
import Setup from './pages/Setup';
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

const MAIN_SITE_SIGNUP_URL = 'https://securebase.tximhotep.com/signup';

function ExternalSignupRedirect() {
  useEffect(() => {
    window.location.replace(MAIN_SITE_SIGNUP_URL);
  }, []);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>Redirecting to sign up&hellip;</p>
    </div>
  );
}

const DEMO_EMAIL = 'demo@securebase.tximhotep.com';
const DEMO_CUSTOMER_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_NAME = 'Acme Corporation';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    const demoParam = new URLSearchParams(window.location.search).get('demo') === 'true';
    if ((import.meta.env.VITE_DEMO_MODE === 'true' || demoParam) && !localStorage.getItem('sessionToken')) {
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
      {/* Exit-intent modal — rendered globally for all authenticated routes */}
      {isAuthenticated && <ExitIntentModal />}
      <Routes>
        <Route path="/login"      element={isAuthenticated ? <Navigate to={isDemoMode() ? "/demo-dashboard" : "/dashboard"} replace /> : <Login setAuth={setIsAuthenticated} />} />
        <Route path="/signup"     element={<ExternalSignupRedirect />} />
        <Route path="/register"   element={<ExternalSignupRedirect />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/dashboard"     element={isDemoMode() ? <Navigate to="/demo-dashboard" replace /> : (isAuthenticated ? <Dashboard /> : <Navigate to="/login" />)} />
        <Route path="/demo-dashboard" element={isAuthenticated ? <DemoDashboard /> : <Navigate to="/login" />} />
        <Route path="/compliance"    element={<Compliance isPublic={!isAuthenticated} />} />
        <Route path="/fintech-portal" element={isAuthenticated ? <TexasExaminerPortal /> : <Navigate to="/login" />} />
        <Route path="/sre-dashboard" element={isAuthenticated ? <SREDashboardWrapper />   : <Navigate to="/login" />} />
        <Route path="/alerts"        element={isAuthenticated ? <AlertManagement />: <Navigate to="/login" />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/contact-sales" element={<ContactSales setAuth={setIsAuthenticated} />} />
        <Route path="/thank-you" element={<ThankYou />} />
        {/* Compliance Jumpstart Pilot — public landing page and post-payment setup */}
        <Route path="/pilots/compliance-jumpstart" element={<ComplianceJumpstart />} />
        <Route path="/setup" element={<Setup />} />
        {/* Root: always show landing page in demo mode; otherwise redirect authenticated users to dashboard */}
        <Route path="/" element={isDemoMode() ? <LandingPage /> : (isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />)} />
      </Routes>
    </Router>
  );
}

export default App;
