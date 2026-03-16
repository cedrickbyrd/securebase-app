import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import SignupForm from './components/SignupForm';
import OnboardingProgress from './components/OnboardingProgress';
import Compliance from './components/Compliance';
import SREDashboard from './components/SREDashboard';
import AlertManagement from './components/AlertManagement';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    // Check if user has a valid session on mount
    const sessionToken = localStorage.getItem('sessionToken');
    return !!sessionToken;
  });

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/register" element={<SignupForm />} />
        <Route
          path="/onboarding"
          element={isAuthenticated ? <OnboardingProgress /> : <Navigate to="/login" />}
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/compliance" 
          element={isAuthenticated ? <Compliance /> : <Navigate to="/login" />} 
        />
        <Route
          path="/sre-dashboard"
          element={isAuthenticated ? <SREDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/alerts"
          element={isAuthenticated ? <AlertManagement /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
