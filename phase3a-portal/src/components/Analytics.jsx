/**
 * Analytics Component - Phase 4
 * Advanced analytics and custom reporting dashboard
 * Provides multi-dimensional data visualization, filtering, and export
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Filter,
  Calendar,
  FileText,
  Mail,
  Share2,
  Clock,
  DollarSign,
  Shield,
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { analyticsService } from '../services/analyticsService';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  TimeSeriesChart,
  CostBreakdownChart,
  DistributionPieChart,
  UsageTrendsChart,
  ComplianceGauge,
  MultiMetricChart,
  SecurityHeatmap,
  BudgetComparisonChart,
} from './charts/ChartComponents';

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDateRange, setSelectedDateRange] = useState('30d');
  const [selectedDimension, setSelectedDimension] = useState('service');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Date range options
  const dateRanges = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '12m', label: 'Last 12 months' },
    { value: 'custom', label: 'Custom range' },
  ];

  // Dimension options for grouping
  const dimensions = [
    { value: 'service', label: 'By Service' },
    { value: 'region', label: 'By Region' },
    { value: 'tag', label: 'By Tag' },
    { value: 'account', label: 'By Account' },
    { value: 'compliance', label: 'By Compliance Framework' },
  ];

  useEffect(() => {
    loadAnalyticsData();
    loadSavedReports();
  }, [selectedDateRange, selectedDimension]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await analyticsService.getAnalytics({
        dateRange: selectedDateRange,
        dimension: selectedDimension,
      });

      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedReports = async () => {
    try {
      const reports = await analyticsService.getSavedReports();
      setSavedReports(reports);
    } catch (err) {
      console.error('Failed to load saved reports:', err);
    }
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);
      const blob = await analyticsService.exportReport({
        dateRange: selectedDateRange,
        dimension: selectedDimension,
        format,
      });

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${selectedDateRange}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportModal(false);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReport = async (scheduleData) => {
    try {
      await analyticsService.scheduleReport({
        dateRange: selectedDateRange,
        dimension: selectedDimension,
        ...scheduleData,
      });

      setShowScheduleModal(false);
      alert('Report scheduled successfully');
    } catch (err) {
      console.error('Failed to schedule report:', err);
      setError('Failed to schedule report');
    }
  };

  const handleSaveReport = async () => {
    try {
      const name = prompt('Enter report name:');
      if (!name) return;

      await analyticsService.saveReport({
        name,
        dateRange: selectedDateRange,
        dimension: selectedDimension,
        config: {
          filters: {},
          metrics: [],
        },
      });

      await loadSavedReports();
      alert('Report saved successfully');
    } catch (err) {
      console.error('Failed to save report:', err);
      setError('Failed to save report');
    }
  };

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">
            Advanced data visualization and custom reporting
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Clock className="h-4 w-4" />
            Schedule
          </button>
          <button
            onClick={handleSaveReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileText className="h-4 w-4" />
            Save Report
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          {/* Date Range Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {dateRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dimension Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group By
            </label>
            <select
              value={selectedDimension}
              onChange={(e) => setSelectedDimension(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {dimensions.map((dim) => (
                <option key={dim.value} value={dim.value}>
                  {dim.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={loadAnalyticsData}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {['overview', 'cost', 'security', 'compliance', 'usage'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={DollarSign}
            label="Total Cost"
            value={formatCurrency(analyticsData.summary?.totalCost || 0)}
            change={analyticsData.summary?.costChange || 0}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <StatCard
            icon={Activity}
            label="API Calls"
            value={(analyticsData.summary?.apiCalls || 0).toLocaleString()}
            change={analyticsData.summary?.apiCallsChange || 0}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            icon={Shield}
            label="Compliance Score"
            value={`${analyticsData.summary?.complianceScore || 0}%`}
            change={analyticsData.summary?.complianceChange || 0}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Active Resources"
            value={(analyticsData.summary?.activeResources || 0).toLocaleString()}
            change={analyticsData.summary?.resourcesChange || 0}
            iconBg="bg-orange-100"
            iconColor="text-orange-600"
          />
        </div>
      )}

      {/* Main Content Area - Charts and Data */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Overview</h2>
            <div className="h-64 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chart visualization will be implemented with Recharts</p>
                <p className="text-sm mt-1">Multi-dimensional data visualization</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cost' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Cost Analysis</h2>
            <div className="h-64 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Cost breakdown by service, region, or tag</p>
                <p className="text-sm mt-1">Time-series cost trends</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Security Analytics</h2>
            <div className="h-64 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Security findings and violation trends</p>
                <p className="text-sm mt-1">GuardDuty and Security Hub metrics</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Compliance Status</h2>
            <div className="h-64 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Compliance score trends by framework</p>
                <p className="text-sm mt-1">Control pass/fail metrics</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Usage Metrics</h2>
            <div className="h-64 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <div className="text-center text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>API usage and resource utilization</p>
                <p className="text-sm mt-1">Request volume and latency trends</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved Reports */}
      {savedReports.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Saved Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map((report) => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{report.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.dateRange} • {report.dimension}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Created {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          loading={loading}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleReport}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, change, iconBg, iconColor }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-lg ${iconBg}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <div className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {change >= 0 ? '+' : ''}{change}%
      </div>
    </div>
    <div className="mt-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  </div>
);

// Export Modal Component
const ExportModal = ({ onClose, onExport, loading }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 className="text-xl font-semibold mb-4">Export Report</h2>
      <p className="text-gray-600 mb-6">Choose export format:</p>
      <div className="space-y-3">
        {['pdf', 'csv', 'excel', 'json'].map((format) => (
          <button
            key={format}
            onClick={() => onExport(format)}
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
      >
        Cancel
      </button>
    </div>
  </div>
);

// Schedule Modal Component
const ScheduleModal = ({ onClose, onSchedule }) => {
  const [frequency, setFrequency] = useState('weekly');
  const [recipients, setRecipients] = useState('');
  const [format, setFormat] = useState('pdf');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Schedule Report</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipients (comma-separated emails)
            </label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="user@example.com, team@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSchedule({ frequency, recipients: recipients.split(',').map(e => e.trim()), format })}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Schedule
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
