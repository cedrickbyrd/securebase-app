/**
 * Dashboard Component - BEM Architecture
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

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    monthlyCharge: 0,
    monthlyUsage: {},
    recentInvoices: [],
    apiKeysCount: 0,
    complianceStatus: '',
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

      console.log('📊 Dashboard data received:', {
        metrics: metrics.data,
        invoices: invoices.data,
        apiKeys: apiKeys.data,
        compliance: compliance.data,
        tickets: tickets.data,
      });

      setDashboardData({
        monthlyCharge: invoices.data[0]?.total_amount || 0,
        monthlyUsage: metrics.data,
        recentInvoices: invoices.data,
        apiKeysCount: apiKeys.data.length,
        complianceStatus: compliance.data.status,
        pendingTickets: tickets.data.length,
      });

      console.log('✅ Dashboard state updated');
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
      <div className="sb-Dashboard sb-Dashboard--loading">
        <div className="sb-Dashboard__loadingContent">
          <div className="sb-Spinner"></div>
          <p className="sb-Dashboard__loadingText">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-Dashboard">
      {/* Header */}
      <div className="sb-Dashboard__header">
        <h1 className="sb-Dashboard__title">Dashboard</h1>
        <p className="sb-Dashboard__subtitle">Welcome back to SecureBase</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="sb-Alert sb-Alert--error">
          <AlertCircle className="sb-Alert__icon" />
          <div className="sb-Alert__content">
            <h3 className="sb-Alert__title">Error loading dashboard</h3>
            <p className="sb-Alert__text">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="sb-Dashboard__content">
        {/* Top Stats Grid */}
        <div className="sb-StatsGrid">
          {/* Monthly Charge */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Monthly Charge</p>
                <p className="sb-StatCard__value">
                  {formatCurrency(dashboardData.monthlyCharge)}
                </p>
              </div>
              <CreditCard className="sb-StatCard__icon sb-StatCard__icon--blue" />
            </div>
          </div>

          {/* API Keys */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Active API Keys</p>
                <p className="sb-StatCard__value">
                  {dashboardData.apiKeysCount}
                </p>
              </div>
              <Key className="sb-StatCard__icon sb-StatCard__icon--purple" />
            </div>
          </div>

          {/* Compliance Status */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Compliance Status</p>
                <div className="sb-StatCard__statusRow">
                  <CheckCircle2 className="sb-StatCard__statusIcon" />
                  <p className="sb-StatCard__statusText">{dashboardData.complianceStatus}</p>
                </div>
              </div>
              <Shield className="sb-StatCard__icon sb-StatCard__icon--green" />
            </div>
          </div>

          {/* Open Tickets */}
          <div className="sb-StatCard">
            <div className="sb-StatCard__content">
              <div className="sb-StatCard__info">
                <p className="sb-StatCard__label">Open Tickets</p>
                <p className="sb-StatCard__value">
                  {dashboardData.pendingTickets}
                </p>
              </div>
              <Ticket className="sb-StatCard__icon sb-StatCard__icon--orange" />
            </div>
          </div>
        </div>

        {/* Recent Invoices & Quick Actions */}
        <div className="sb-Dashboard__mainGrid">
          {/* Recent Invoices */}
          <div className="sb-InvoicesList">
            <div className="sb-InvoicesList__header">
              <h2 className="sb-InvoicesList__title">Recent Invoices</h2>
            </div>
            <div className="sb-InvoicesList__content">
              {dashboardData.recentInvoices.length > 0 ? (
                dashboardData.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="sb-InvoiceItem">
                    <div className="sb-InvoiceItem__content">
                      <div className="sb-InvoiceItem__details">
                        <p className="sb-InvoiceItem__number">{invoice.invoice_number}</p>
                        <p className="sb-InvoiceItem__date">
                          {formatDate(invoice.created_at)}
                        </p>
                      </div>
                      <div className="sb-InvoiceItem__summary">
                        <p className="sb-InvoiceItem__amount">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                        <span className={`sb-Badge sb-Badge--${invoice.status}`}>    
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sb-InvoicesList__empty">
                  <p className="u-text-muted">No invoices yet</p>
                </div>
              )}
            </div>
            <div className="sb-InvoicesList__footer">
              <a href="/invoices" className="sb-Link">
                View all invoices →
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="sb-QuickActions">
            <h3 className="sb-QuickActions__title">Quick Actions</h3>
            <div className="sb-QuickActions__list">
              <a href="/invoices/download" className="sb-ActionButton sb-ActionButton--blue">
                <Download className="sb-ActionButton__icon" />
                Download Invoice
              </a>
              <a href="/api-keys" className="sb-ActionButton sb-ActionButton--purple">
                <Plus className="sb-ActionButton__icon" />
                Create API Key
              </a>
              <a href="/compliance" className="sb-ActionButton sb-ActionButton--green">
                <Shield className="sb-ActionButton__icon" />
                View Compliance
              </a>
              <a href="/support" className="sb-ActionButton sb-ActionButton--orange">
                <Ticket className="sb-ActionButton__icon" />
                Submit Ticket
              </a>
            </div>
          </div>
        </div>

        {/* Usage Trends */}
        <div className="sb-UsagePanel">
          <div className="sb-UsagePanel__header">
            <TrendingUp className="sb-UsagePanel__headerIcon" />
            <h2 className="sb-UsagePanel__title">Usage This Month</h2>
          </div>
          <div className="sb-UsagePanel__grid">
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">AWS Accounts</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.account_count || 0}
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">CloudTrail Events</p>
              <p className="sb-UsageMetric__value">
                {(dashboardData.monthlyUsage.cloudtrail_events || 0).toLocaleString()}
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">Log Storage</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.log_storage_gb || 0} GB
              </p>
            </div>
            <div className="sb-UsageMetric">
              <p className="sb-UsageMetric__label">Data Transfer</p>
              <p className="sb-UsageMetric__value">
                {dashboardData.monthlyUsage.data_transfer_gb || 0} GB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
