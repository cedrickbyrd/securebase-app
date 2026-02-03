/**
 * Phase 3a Portal Application
 * Customer-facing portal for SecureBase
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Key,
  Shield,
  Ticket,
  Webhook,
  LogOut,
  Menu,
  X,
  Bell,
  Activity,
  Users,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Invoices from './components/Invoices';
import ApiKeys from './components/ApiKeys';
import Compliance from './components/Compliance';
import SupportTickets from './components/SupportTickets';
import { Forecasting } from './components/Forecasting';
import Webhooks from './components/Webhooks';
import TeamManagement from './components/TeamManagement';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminDashboard from './components/AdminDashboard';
import DemoBanner from './components/DemoBanner';
import './App.css';

const Navigation = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('sessionToken');

  if (!isAuthenticated) {
    return null;
  }

  // Check if user has admin role (from localStorage or token)
  // NOTE: This is for UI visibility only. Server-side authorization via JWT/API key
  // is the actual security boundary. Backend API must verify admin/executive roles.
  const userRole = localStorage.getItem('userRole') || 'customer';
  const isAdmin = userRole === 'admin' || userRole === 'executive';
  const canManageTeam = isAdmin || userRole === 'manager';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/invoices', label: 'Invoices', icon: CreditCard },
    { path: '/forecast', label: 'Cost Forecast', icon: TrendingUp },
    { path: '/api-keys', label: 'API Keys', icon: Key },
    { path: '/compliance', label: 'Compliance', icon: Shield },
    { path: '/webhooks', label: 'Webhooks', icon: Webhook },
    { path: '/support', label: 'Support', icon: Ticket },
  ];

  // Add team management for admin/manager roles
  if (canManageTeam) {
    navItems.push({ path: '/team', label: 'Team', icon: Users });
  }

  // Add admin-only navigation items
  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin Dashboard', icon: Activity });
  }

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white pt-8 border-r border-gray-800">
        <div className="px-6 mb-8">
          <h1 className="text-2xl font-bold text-white">SecureBase</h1>
          <p className="text-xs text-gray-400 mt-1">Customer Portal</p>
        </div>

        <nav className="space-y-2 px-4">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center px-4 py-3 rounded-lg transition ${
                isActive(path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-8 left-4 right-4">
          <button
            onClick={() => {
              localStorage.removeItem('sessionToken');
              window.location.href = `${import.meta.env.BASE_URL}login`;
            }}
            className="w-full flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Navigation Header */}
      <div className="md:hidden bg-gray-900 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-xl font-bold">SecureBase</h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-white"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="md:hidden bg-gray-800 text-white px-4 py-4">
          <nav className="space-y-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center px-4 py-3 rounded-lg transition ${
                  isActive(path)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => {
              localStorage.removeItem('sessionToken');
              window.location.href = `${import.meta.env.BASE_URL}login`;
            }}
            className="w-full mt-4 flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      )}
    </>
  );
};

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('sessionToken');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [, setDemoData] = useState(null);
  const isAuthenticated = !!localStorage.getItem('sessionToken');
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  useEffect(() => {
    // Close mobile nav on route change
    setNavOpen(false);
    
    // Load demo data if in demo mode
    if (isDemoMode) {
      fetch('/demo-data.json')
        .then(res => res.json())
        .then(data => {
          setDemoData(data);
          // Store demo data globally for components to use
          window.demoData = data;
          // Auto-login for demo mode
          if (!localStorage.getItem('sessionToken')) {
            localStorage.setItem('sessionToken', 'demo-token-12345');
            localStorage.setItem('userRole', 'customer');
          }
        })
        .catch(err => console.error('Failed to load demo data:', err));
    }
  }, [isDemoMode]);

  return (
    <BrowserRouter basename={import.meta.env.MODE === 'production' ? '/securebase-app' : '/'}>
      {/* Demo Banner (appears above everything) */}
      <DemoBanner />
      
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar Navigation */}
        <Navigation isOpen={navOpen} setIsOpen={setNavOpen} />

        {/* Main Content */}
        <main className={isAuthenticated ? 'md:ml-64 flex-1' : 'w-full'}>
          {/* Header Bar */}
          {isAuthenticated && (
            <div className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <div></div>
                <div className="flex items-center gap-4">
                  <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    SB
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Routes */}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forecast"
              element={
                <ProtectedRoute>
                  <Forecasting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/api-keys"
              element={
                <ProtectedRoute>
                  <ApiKeys />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <Compliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/webhooks"
              element={
                <ProtectedRoute>
                  <Webhooks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <SupportTickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <TeamManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
