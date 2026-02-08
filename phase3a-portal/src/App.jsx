import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import Compliance from './components/Compliance';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    // Check if user has a valid session on mount
    const demoToken = sessionStorage.getItem('demo_token');
    const sessionToken = localStorage.getItem('sessionToken');
    return !!(demoToken || sessionToken);
  });

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
        <Route path="/signup" element={<Signup />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/compliance" 
          element={isAuthenticated ? <Compliance /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
