import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { initializeSessionTracking, trackVirtualPageView } from './utils/analytics';
import { isDemoMode } from './utils/demoData';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import AcceptInvite from './components/AcceptInvite';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import OnboardingProgress from './components/OnboardingProgress';
import Compliance from './components/Compliance';
import TexasExaminerPortal from './components/TexasExaminerPortal';
import SREDashboardWrapper from './components/SREDashboardWrapper';
import AlertSettings from './components/AlertSettings';
import HIPAADashboard from './components/HIPAADashboard';
import TeamManagement from './components/TeamManagement';
import AdminDashboard from './components/admin/AdminDashboard';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import ExitIntentModal from './components/ExitIntentModal';
import DemoBanner from './components/DemoBanner';
import EvidencePackages from './components/EvidencePackages';
import CloudConnection from './components/CloudConnection';
import ComplianceTrend from './components/ComplianceTrend';
import Signup from './components/Signup';
import LandingPage from './pages/LandingPage';
import DemoDashboard from './pages/DemoDashboard';
import ThankYou from './pages/ThankYou';
import Pricing from './pages/Pricing';
import Checkout from './pages/Checkout';
import ContactSales from './pages/ContactSales';
import ComplianceJumpstart from './pages/ComplianceJumpstart';
import HIPAAReadiness from './pages/HIPAAReadiness';
import Setup from './pages/Setup';
import MarketplaceRedirect from './pages/MarketplaceRedirect';
import './App.css';

function OnboardingRoute() {
  const [params] = useSearchParams();
  return <OnboardingProgress jobId={params.get('jobId')} email={params.get('email')} />;
}

const DEMO_EMAIL       = 'demo@securebase.tximhotep.com';
const DEMO_CUSTOMER_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_NAME    = 'Acme Corporation';

// Full-page wrapper for ComplianceTrend
function ComplianceTrendPage() {
  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1.5rem' }}>
      <ComplianceTrend defaultFramework="HIPAA" days={90} compact={false} />
    </div>
  );
}

const ONBOARDING_EXEMPT_PATHS = [
  '/cloud-connection', '/login', '/accept-invite', '/forgot-password',
  '/reset-password', '/onboarding', '/admin',
];

function AppInner({ isAuthenticated, setIsAuthenticated, needsOnboarding, setNeedsOnboarding }) {
  const location = useLocation();

  useEffect(() => {
    const pathWithQuery = `${location.pathname}${location.search}${location.hash}`;
    trackVirtualPageView(pathWithQuery, document.title, window.location.href);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!isAuthenticated || isDemoMode()) return;
    const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
    if (userRole === 'admin') return;
    if (ONBOARDING_EXEMPT_PATHS.some(p => location.pathname.startsWith(p))) return;

    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/cloud-connection/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) { setNeedsOnboarding(true); return; }
        return res.json();
      })
      .then(data => {
        if (data && data.connected === false) setNeedsOnboarding(true);
        if (data && data.connected === true) setNeedsOnboarding(false);
      })
      .catch(() => { /* non-blocking: default to allowing access on network error/timeout */ })
      .finally(() => clearTimeout(timeoutId));

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [isAuthenticated, location.pathname, setNeedsOnboarding]);

  return (
    <>
      <DemoBanner />
      {isAuthenticated && <ExitIntentModal />}
      <Routes>
        {/* ─ Auth ─ */}
        <Route path="/login"           element={isAuthenticated ? <Navigate to={isDemoMode() ? '/demo-dashboard' : '/dashboard'} replace /> : <Login setAuth={setIsAuthenticated} />} />
        <Route path="/accept-invite"   element={<AcceptInvite   setAuth={setIsAuthenticated} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword  />} />
        <Route path="/signup"          element={<Signup />} />
        <Route path="/register"        element={<Signup />} />
        <Route path="/onboarding"      element={<OnboardingRoute />} />

        {/* ─ Protected ─ */}
        <Route path="/dashboard"           element={isDemoMode() ? <Navigate to="/demo-dashboard" replace /> : isAuthenticated ? (needsOnboarding ? <Navigate to="/cloud-connection" replace /> : <Dashboard />) : <Navigate to="/login" />} />
        <Route path="/demo-dashboard"      element={isAuthenticated ? <DemoDashboard />                                                                  : <Navigate to="/login" />} />
        <Route path="/compliance"          element={<Compliance isPublic={!isAuthenticated} />} />
        <Route path="/compliance/trend"    element={isAuthenticated ? <ComplianceTrendPage />                                                            : <Navigate to="/login" />} />
        <Route path="/fintech-portal"      element={isAuthenticated ? <TexasExaminerPortal />                                                             : <Navigate to="/login" />} />
        <Route path="/hipaa-dashboard"     element={isAuthenticated ? <HIPAADashboard />                                                                  : <Navigate to="/login" />} />
        <Route path="/team"                element={isAuthenticated ? <TeamManagement />                                                                   : <Navigate to="/login" />} />
        <Route path="/sre-dashboard"       element={isAuthenticated ? <SREDashboardWrapper />                                                             : <Navigate to="/login" />} />
        <Route path="/alerts"              element={isAuthenticated ? <AlertSettings />                                                                  : <Navigate to="/login" />} />
        <Route path="/executive"           element={isAuthenticated ? <ExecutiveDashboard />                                                              : <Navigate to="/login" />} />
        <Route path="/evidence"            element={isAuthenticated ? <EvidencePackages />                                                                : <Navigate to="/login" />} />
        <Route path="/cloud-connection"    element={isAuthenticated ? <CloudConnection />                                                                  : <Navigate to="/login" />} />
        <Route path="/admin"               element={isAuthenticated ? ((localStorage.getItem('userRole') || '').toLowerCase() === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" />} />

        {/* ─ Public ─ */}
        <Route path="/pricing"                      element={<Pricing />} />
        <Route path="/checkout"                     element={<Checkout />} />
        <Route path="/contact-sales"                element={<ContactSales setAuth={setIsAuthenticated} />} />
        <Route path="/thank-you"                    element={<ThankYou />} />
        <Route path="/pilots/compliance-jumpstart"  element={<ComplianceJumpstart />} />
        <Route path="/pilots/hipaa-readiness"       element={<HIPAAReadiness />} />
        <Route path="/setup"                        element={<Setup />} />
        <Route path="/marketplace-redirect"         element={<MarketplaceRedirect setAuth={setIsAuthenticated} />} />
        <Route path="/"                             element={isDemoMode() ? <LandingPage /> : (isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />)} />
      </Routes>
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    const demoParam = new URLSearchParams(window.location.search).get('demo') === 'true';
    if ((import.meta.env.VITE_DEMO_MODE === 'true' || demoParam) && !localStorage.getItem('sessionToken')) {
      localStorage.setItem('demo_mode', 'true');
      localStorage.setItem('demo_user', JSON.stringify({ email: DEMO_EMAIL, customerId: DEMO_CUSTOMER_ID, orgName: DEMO_ORG_NAME }));
    }
    return !!sessionStorage.getItem('sessionToken') || !!localStorage.getItem('sessionToken') || isDemoMode();
  });

  const [needsOnboarding, setNeedsOnboarding] = React.useState(false);

  useEffect(() => { initializeSessionTracking(); }, []);

  return (
    <Router>
      <AppInner
        isAuthenticated={isAuthenticated}
        setIsAuthenticated={setIsAuthenticated}
        needsOnboarding={needsOnboarding}
        setNeedsOnboarding={setNeedsOnboarding}
      />
    </Router>
  );
}

export default App;
