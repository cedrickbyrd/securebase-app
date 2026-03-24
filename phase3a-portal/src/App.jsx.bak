import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import SignupForm from './components/SignupForm';
import OnboardingProgress from './components/OnboardingProgress';
import Compliance from './components/Compliance';
import SREDashboard from './components/SREDashboard';
import AlertManagement from './components/AlertManagement';
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return !!localStorage.getItem('sessionToken');
  });

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
        <Route path="/sre-dashboard" element={isAuthenticated ? <SREDashboard />   : <Navigate to="/login" />} />
        <Route path="/alerts"        element={isAuthenticated ? <AlertManagement />: <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;