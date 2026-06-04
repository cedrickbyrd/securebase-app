import React, { Suspense, lazy, useEffect } from 'react'; // Added Suspense & lazy
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useMFAStatus } from './lib/useMFAStatus';
import Login from './components/Login';
import Signup from './components/Signup';
import AcceptInvite from './components/AcceptInvite';
import SecureBaseLandingZone from './SecureBaseLandingZone';
import TrustCenter from './components/TrustCenter';
import SREDashboardWrapper from './components/SREDashboardWrapper';
import Alerts from './components/Alerts';
import Pricing from './components/Pricing';
import Checkout from './components/Checkout';
import ContactSales from './components/ContactSales';
import CookieConsent from './components/CookieConsent';
import { Loader } from 'lucide-react';
import { initializeAnalytics, SessionTracking, trackPageView } from './utils/analytics';
import ThankYou from './components/ThankYou';
import UTMRouter from './marketing/UTMRouter';
import BanksLandingPage from './marketing/BanksLandingPage';
import HealthcareLandingPage from './marketing/HealthcareLandingPage';
import DemoRedirect from './marketing/DemoRedirect';

// Internal marketing tool — admin-only
const LinkedInPostBuilder = lazy(() => import('./marketing/LinkedInPostBuilder'));

// 🚀 Phase 5 Optimization: Lazy load the Dashboard to protect Performance scores
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Loader className="animate-spin text-blue-600 w-8 h-8" />
  </div>
);

/** Fires a GA4 page view on every client-side route change. */
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    const pathWithQuery = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(pathWithQuery, document.title, window.location.href);
  }, [location.pathname, location.search, location.hash]);
  return null;
}

function App() {
  const { aal, isLoading } = useMFAStatus();

  useEffect(() => {
    initializeAnalytics();
    SessionTracking.logSessionStart();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader className="animate-spin text-blue-600 w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
            Authenticating SecureBase...
          </p>
        </div>
      </div>
    );
  }

  const isAuthenticated = aal && aal !== 'none';

  return (
    <Router>
      <UTMRouter />
      <RouteTracker />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Sales View */}
          <Route path="/trust" element={<TrustCenter />} />

          {/* Public Golden Sales Path — no auth required */}
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/contact-sales" element={<ContactSales />} />
          <Route path="/thank-you" element={<ThankYou />} />

          {/* Marketing vertical landing pages */}
          <Route path="/banks" element={<BanksLandingPage />} />
          <Route path="/healthcare" element={<HealthcareLandingPage />} />

          {/* Demo UTM passthrough — lead gate then redirect to demo subdomain */}
          <Route path="/demo" element={<DemoRedirect />} />

          {/* Zero-friction signup — public, no auth required */}
          <Route path="/signup" element={<Signup />} />

          {/* Invite activation — public, must be before wildcard catch-all */}
          <Route path="/accept-invite" element={<AcceptInvite />} />

          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login /> : <Navigate to="/" />} 
          />
          
          <Route 
            path="/" 
            element={isAuthenticated ? <SecureBaseLandingZone /> : <Navigate to="/login" />} 
          />

          {/* 🔐 Protected Admin Route for Phase 5 Observability */}
          <Route 
            path="/admin" 
            element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/login" />} 
          />

          {/* Internal LinkedIn post builder — admin only */}
          <Route
            path="/admin/linkedin"
            element={isAuthenticated ? <LinkedInPostBuilder /> : <Navigate to="/login" />}
          />

          {/* SRE Dashboard — routes to DemoDashboard in demo mode */}
          <Route
            path="/sre"
            element={isAuthenticated ? <SREDashboardWrapper /> : <Navigate to="/login" />}
          />

          {/* Alerts */}
          <Route
            path="/alerts"
            element={isAuthenticated ? <Alerts /> : <Navigate to="/login" />}
          />

          {/* Wildcard Catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      <CookieConsent />
    </Router>
  );
}

export default App;
