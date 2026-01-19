/**
 * Cost Forecasting Component
 * Predict future costs using historical data and ML-based time-series analysis
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Download,
  Settings,
  Calendar,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle2,
  Activity as ActivityIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, AreaChart } from 'recharts';
import { apiService } from '../services/apiService';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';

export const Forecasting = () => {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('12'); // months
  const [confidenceLevel, setConfidenceLevel] = useState('medium'); // low, medium, high
  const [showDetails, setShowDetails] = useState(false);
  const [exportFormat, setExportFormat] = useState(null);
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [showBudgetConfig, setShowBudgetConfig] = useState(false);

  useEffect(() => {
    loadForecast();
  }, [timeframe, confidenceLevel]);

  const loadForecast = async () => {
    try {
      setLoading(true);
      const response = await apiService.generateCostForecast({
        months: parseInt(timeframe),
        confidence_level: confidenceLevel,
      });
      setForecastData(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load forecast:', err);
      setError(err.message || 'Failed to generate cost forecast');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setExportFormat(format);
      await apiService.exportCostForecast(format);
      // File download handled by browser
    } catch (err) {
      console.error('Failed to export forecast:', err);
      setError('Failed to export forecast');
    } finally {
      setExportFormat(null);
    }
  };

  const handleSetBudgetAlert = async (monthlyBudget) => {
    try {
      await apiService.setBudgetAlert({
        monthly_limit: monthlyBudget,
        alert_threshold: 0.8, // Alert at 80% of budget
      });
      setBudgetAlert(monthlyBudget);
      setShowBudgetConfig(false);
    } catch (err) {
      console.error('Failed to set budget alert:', err);
      setError('Failed to set budget alert');
    }
  };

  if (loading && !forecastData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing historical data and generating forecast...</p>
        </div>
      </div>
    );
  }

  const totalProjectedCost = forecastData?.forecast?.reduce((sum, month) => sum + month.forecast_value, 0) || 0;
  const avgMonthlyCost = totalProjectedCost / (parseInt(timeframe) || 1);
  const hasAnomalies = forecastData?.anomalies?.length > 0;
  const confidenceInterval = confidenceLevel === 'high' ? 0.95 : confidenceLevel === 'medium' ? 0.80 : 0.65;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                Cost Forecasting
              </h1>
              <p className="text-gray-600 mt-1">Predict your future AWS costs with AI-powered forecasting</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBudgetConfig(!showBudgetConfig)}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                <Settings className="w-5 h-5 mr-2" />
                Budget Alert
              </button>
              <div className="relative group">
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  <Download className="w-5 h-5 mr-2" />
                  Export
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exportFormat === 'pdf'}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-lg"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exportFormat === 'csv'}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exportFormat === 'json'}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 last:rounded-b-lg"
                  >
                    Export as JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Budget Configuration */}
        {showBudgetConfig && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-4">Set Monthly Budget Alert</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-blue-900 mb-2">Monthly Budget Limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    id="budgetInput"
                    placeholder="e.g., 5000"
                    className="w-full pl-8 pr-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-blue-800 mt-1">You'll be alerted when spending reaches 80% of this budget</p>
              </div>
              <button
                onClick={() => {
                  const budget = document.getElementById('budgetInput').value;
                  if (budget) handleSetBudgetAlert(parseFloat(budget));
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Set Alert
              </button>
              <button
                onClick={() => setShowBudgetConfig(false)}
                className="px-6 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Period</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="3">Next 3 months</option>
              <option value="6">Next 6 months</option>
              <option value="12">Next 12 months</option>
              <option value="24">Next 24 months</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low (65% CI)</option>
              <option value="medium">Medium (80% CI)</option>
              <option value="high">High (95% CI)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Accuracy</label>
            <div className="flex items-center px-4 py-2 bg-gray-100 rounded-lg">
              <ActivityIcon className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-sm font-medium text-gray-900">
                {forecastData?.accuracy_score ? formatPercent(forecastData.accuracy_score) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Projected Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(totalProjectedCost)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Avg Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(avgMonthlyCost)}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-600">
            <div>
              <p className="text-gray-600 text-sm font-medium">Trend</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {forecastData?.trend === 'increasing' ? (
                  <span className="text-red-600">↑ Increasing</span>
                ) : forecastData?.trend === 'decreasing' ? (
                  <span className="text-green-600">↓ Decreasing</span>
                ) : (
                  <span className="text-gray-600">→ Stable</span>
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Anomalies</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{forecastData?.anomalies?.length || 0}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${hasAnomalies ? 'text-red-600' : 'text-gray-300'} opacity-20`} />
            </div>
          </div>
        </div>

        {/* Anomalies Alert */}
        {hasAnomalies && (
          <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-3">Anomalies Detected</h3>
                <div className="space-y-2">
                  {forecastData.anomalies.map((anomaly, idx) => (
                    <div key={idx} className="text-sm text-yellow-800">
                      <strong>{anomaly.month}:</strong> Unusual spike detected ({formatPercent(anomaly.deviation)} above trend)
                      {anomaly.reason && <span> - {anomaly.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Cost Forecast</h2>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={forecastData?.forecast || []}>
              <defs>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorUpperBound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="upper_bound"
                stroke="#ef4444"
                fill="url(#colorUpperBound)"
                name="Upper Bound (95% CI)"
                strokeDasharray="5 5"
              />
              <Area
                type="monotone"
                dataKey="forecast_value"
                stroke="#3b82f6"
                fill="url(#colorForecast)"
                name="Forecast"
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey="lower_bound"
                stroke="#10b981"
                fill="none"
                name="Lower Bound (95% CI)"
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 mt-4">
            Forecast based on {forecastData?.historical_months || 12} months of historical data. Confidence level: {confidenceLevel}.
          </p>
        </div>

        {/* Breakdown by Service */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Cost by Service</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart */}
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastData?.service_breakdown || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="projected_cost" fill="#3b82f6" name="Projected Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Service</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(forecastData?.service_breakdown || []).map((service, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{service.service}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(service.projected_cost)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatPercent(service.percentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Forecast Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between py-4 hover:bg-gray-50 rounded"
          >
            <h2 className="text-lg font-semibold text-gray-900">Monthly Breakdown</h2>
            {showDetails ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
          </button>

          {showDetails && (
            <div className="border-t border-gray-200 pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Month</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Forecast</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Lower Bound</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Upper Bound</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(forecastData?.forecast || []).map((month, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{month.month}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(month.forecast_value)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(month.lower_bound)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(month.upper_bound)}</td>
                        <td className="px-4 py-3 text-right">
                          {month.month_over_month_change > 0 ? (
                            <span className="text-red-600">+{formatPercent(month.month_over_month_change)}</span>
                          ) : month.month_over_month_change < 0 ? (
                            <span className="text-green-600">{formatPercent(month.month_over_month_change)}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Forecast Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How This Forecast Works</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>
              • <strong>Historical Analysis:</strong> We analyze your cost data from the last 12 months to identify patterns and trends.
            </li>
            <li>
              • <strong>Seasonality Detection:</strong> We detect recurring seasonal patterns (e.g., higher costs in certain months).
            </li>
            <li>
              • <strong>Anomaly Detection:</strong> Unusual spikes or drops are flagged and handled separately.
            </li>
            <li>
              • <strong>Confidence Intervals:</strong> The upper and lower bounds represent the forecast range at your chosen confidence level.
            </li>
            <li>
              • <strong>Accuracy Score:</strong> This reflects how well our model fits your historical data (higher is better).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Forecasting;
