/**
 * ChartComponents - Recharts Visualizations for Analytics
 * Phase 4: Enterprise Analytics
 */

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Color palette for charts
const COLORS = {
  primary: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'],
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

/**
 * Time Series Line Chart
 * For cost trends, usage over time, etc.
 */
export const TimeSeriesChart = ({ data, dataKeys, title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {dataKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS.primary[index % COLORS.primary.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Cost Breakdown Bar Chart
 * Compare costs across services, regions, accounts
 */
export const CostBreakdownChart = ({ data, dataKey = 'cost', categoryKey = 'name', title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={categoryKey}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value) => `$${value.toLocaleString()}`}
          />
          <Legend />
          <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Service Distribution Pie Chart
 * Show percentage breakdown of costs, usage, etc.
 */
export const DistributionPieChart = ({ data, dataKey = 'value', nameKey = 'name', title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Usage Trends Area Chart
 * Stacked area chart for multiple metrics
 */
export const UsageTrendsChart = ({ data, dataKeys, title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {dataKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={COLORS.primary[index % COLORS.primary.length]}
              fill={COLORS.primary[index % COLORS.primary.length]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Compliance Score Gauge
 * Radial bar chart showing compliance percentage
 */
export const ComplianceGauge = ({ score, title, height = 200 }) => {
  const data = [{ name: 'Score', value: score, fill: score >= 90 ? COLORS.success : score >= 70 ? COLORS.warning : COLORS.error }];
  
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <div className="flex flex-col items-center">
        <div className="text-4xl font-bold mb-2" style={{ color: data[0].fill }}>
          {score}%
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: data[0].fill }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Multi-Metric Bar Chart
 * Compare multiple metrics side-by-side
 */
export const MultiMetricChart = ({ data, metrics, title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="category" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {metrics.map((metric, index) => (
            <Bar
              key={metric.key}
              dataKey={metric.key}
              name={metric.name}
              fill={COLORS.primary[index % COLORS.primary.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Security Findings Heatmap
 * Show findings by severity and service
 */
export const SecurityHeatmap = ({ data, title, height = 400 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="category" dataKey="service" name="Service" />
          <YAxis type="category" dataKey="severity" name="Severity" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Findings" data={data} fill="#ef4444">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.severity === 'Critical'
                    ? COLORS.error
                    : entry.severity === 'High'
                    ? COLORS.warning
                    : COLORS.info
                }
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Budget vs Actual Chart
 * Compare budgeted vs actual spending
 */
export const BudgetComparisonChart = ({ data, title, height = 300 }) => {
  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value) => `$${value.toLocaleString()}`}
          />
          <Legend />
          <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {
  TimeSeriesChart,
  CostBreakdownChart,
  DistributionPieChart,
  UsageTrendsChart,
  ComplianceGauge,
  MultiMetricChart,
  SecurityHeatmap,
  BudgetComparisonChart,
};
