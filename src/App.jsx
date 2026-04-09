import React, { Suspense, lazy, useEffect } from 'react'; // Added Suspense & lazy
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useMFAStatus } from './lib/useMFAStatus';
import Login from './components/Login';
import Signup from './components/Signup';
import AuthCallback from './pages/AuthCallback';
import SecureBaseLandingZone from './SecureBaseLandingZone';
import TrustCenter from './components/TrustCenter';
import SREDashboardWrapper from './components/SREDashboardWrapper';
import Alerts from './components/Alerts';
import Pricing from './components/Pricing';
import Checkout from './components/Checkout';
import { Loader } from 'lucide-react';
import { initializeAnalytics, SessionTracking } from './utils/analytics';

// 🚀 Phase 5 Optimization: Lazy load the Dashboard to protect Performance scores
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Loader className="animate-spin text-blue-600 w-8 h-8" />
  </div>
);

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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Sales View */}
          <Route path="/trust" element={<TrustCenter />} />

          {/* Public Golden Sales Path — no auth required */}
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/checkout" element={<Checkout />} />

          {/* Zero-friction signup — public, no auth required */}
          <Route path="/signup" element={<Signup />} />

          {/* Supabase OAuth / magic-link callback handler */}
          <Route path="/auth/callback" element={<AuthCallback />} />

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
    </Router>
  );
}

export default App;
