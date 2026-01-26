/**
 * Dashboard Component
 * Main landing page for authenticated customers
 * Shows summary of invoices, API keys, compliance status
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Key,
  Shield,
  Ticket,
  TrendingUp,
  Download,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { formatCurrency, formatDate } from '../utils/formatters';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    monthlyCharge: 0,
    monthlyUsage: {},
    recentInvoices: [],
    apiKeysCount: 0,
    complianceStatus: [],
    pendingTickets: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [
        metrics,
        invoices,
        apiKeys,
        compliance,
        tickets,
      ] = await Promise.all([
        apiService.getMetrics(),
        apiService.getInvoices({ limit: 5 }),
        apiService.getApiKeys(),
        apiService.getComplianceStatus(),
        apiService.getSupportTickets({ status: 'open' }),
      ]);

      setDashboardData({
        monthlyCharge: invoices.data[0]?.total_amount || 0,
        monthlyUsage: metrics.data,
        recentInvoices: invoices.data,
        apiKeysCount: apiKeys.data.length,
        complianceStatus: compliance.data.status,
        pendingTickets: tickets.data.length,
      });

      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back to SecureBase</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error loading dashboard</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Monthly Charge */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Charge</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(dashboardData.monthlyCharge)}
                </p>
              </div>
              <CreditCard className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </div>

          {/* API Keys */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active API Keys</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {dashboardData.apiKeysCount}
                </p>
              </div>
              <Key className="w-10 h-10 text-purple-600 opacity-20" />
            </div>
          </div>

          {/* Compliance Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Compliance Status</p>
                <div className="flex items-center mt-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mr-2" />
                  <p className="text-xl font-semibold text-green-600">Passing</p>
                </div>
              </div>
              <Shield className="w-10 h-10 text-green-600 opacity-20" />
            </div>
          </div>

          {/* Open Tickets */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Tickets</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {dashboardData.pendingTickets}
                </p>
              </div>
              <Ticket className="w-10 h-10 text-orange-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Recent Invoices & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {dashboardData.recentInvoices.length > 0 ? (
                dashboardData.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(invoice.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-600">No invoices yet</p>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <a href="/invoices" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                View all invoices →
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a
                href="/invoices/download"
                className="flex items-center px-4 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition font-medium"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Invoice
              </a>
              <a
                href="/api-keys"
                className="flex items-center px-4 py-3 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create API Key
              </a>
              <a
                href="/compliance"
                className="flex items-center px-4 py-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition font-medium"
              >
                <Shield className="w-5 h-5 mr-2" />
                View Compliance
              </a>
              <a
                href="/support"
                className="flex items-center px-4 py-3 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition font-medium"
              >
                <Ticket className="w-5 h-5 mr-2" />
                Submit Ticket
              </a>
            </div>
          </div>
        </div>

        {/* Usage Trends */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-6">
            <TrendingUp className="w-6 h-6 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Usage This Month</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">AWS Accounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboardData.monthlyUsage.account_count || 0}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">CloudTrail Events</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {(dashboardData.monthlyUsage.cloudtrail_events || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Log Storage</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboardData.monthlyUsage.log_storage_gb || 0} GB
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Data Transfer</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {dashboardData.monthlyUsage.data_transfer_gb || 0} GB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
