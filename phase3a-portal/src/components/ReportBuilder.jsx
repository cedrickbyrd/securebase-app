/**
 * ReportBuilder Component - Phase 4
 * Drag-and-drop custom report configuration
 * Template-based report creation with field selection
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Eye,
  Copy,
  Download,
  Settings,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { analyticsService } from '../services/analyticsService';

export const ReportBuilder = ({ onSave, initialReport = null }) => {
  const [reportName, setReportName] = useState(initialReport?.name || '');
  const [description, setDescription] = useState(initialReport?.description || '');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedFields, setSelectedFields] = useState(initialReport?.fields || []);
  const [selectedFilters, setSelectedFilters] = useState(initialReport?.filters || {});
  const [selectedGroupBy, setSelectedGroupBy] = useState(initialReport?.groupBy || 'service');
  const [selectedDateRange, setSelectedDateRange] = useState(initialReport?.dateRange || '30d');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    fields: true,
    filters: false,
    grouping: false,
    formatting: false,
  });

  // Available fields for selection
  const availableFields = [
    { id: 'cost', label: 'Cost', type: 'currency', category: 'financial' },
    { id: 'usage', label: 'Usage', type: 'number', category: 'metrics' },
    { id: 'apiCalls', label: 'API Calls', type: 'number', category: 'metrics' },
    { id: 'service', label: 'Service Name', type: 'string', category: 'dimensions' },
    { id: 'region', label: 'Region', type: 'string', category: 'dimensions' },
    { id: 'account', label: 'Account', type: 'string', category: 'dimensions' },
    { id: 'complianceScore', label: 'Compliance Score', type: 'percent', category: 'compliance' },
    { id: 'violations', label: 'Violations', type: 'number', category: 'compliance' },
    { id: 'securityFindings', label: 'Security Findings', type: 'number', category: 'security' },
    { id: 'timestamp', label: 'Timestamp', type: 'datetime', category: 'dimensions' },
  ];

  // Filter operators by field type
  const filterOperators = {
    string: ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with'],
    number: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    currency: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    percent: ['equals', 'not_equals', 'greater_than', 'less_than'],
    datetime: ['equals', 'after', 'before', 'between'],
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templateList = await analyticsService.getTemplates();
      setTemplates(templateList);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setReportName(template.name);
    setDescription(template.description);
    setSelectedFields(template.fields || []);
    setSelectedFilters(template.filters || {});
    setSelectedGroupBy(template.groupBy || 'service');
    setSelectedDateRange(template.dateRange || '30d');
  };

  const handleFieldToggle = (field) => {
    setSelectedFields((prev) => {
      const exists = prev.find((f) => f.id === field.id);
      if (exists) {
        return prev.filter((f) => f.id !== field.id);
      } else {
        return [...prev, field];
      }
    });
  };

  const handleFieldReorder = (fieldId, direction) => {
    setSelectedFields((prev) => {
      const index = prev.findIndex((f) => f.id === fieldId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newFields = [...prev];
      [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
      return newFields;
    });
  };

  const handleAddFilter = () => {
    const filterId = `filter_${Date.now()}`;
    setSelectedFilters({
      ...selectedFilters,
      [filterId]: {
        field: availableFields[0].id,
        operator: 'equals',
        value: '',
      },
    });
  };

  const handleFilterChange = (filterId, key, value) => {
    setSelectedFilters({
      ...selectedFilters,
      [filterId]: {
        ...selectedFilters[filterId],
        [key]: value,
      },
    });
  };

  const handleRemoveFilter = (filterId) => {
    const { [filterId]: removed, ...remaining } = selectedFilters;
    setSelectedFilters(remaining);
  };

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = {
        fields: selectedFields.map((f) => f.id),
        filters: selectedFilters,
        groupBy: selectedGroupBy,
        dateRange: selectedDateRange,
      };

      const data = await analyticsService.getAnalytics(config);
      setPreviewData(data);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview failed:', err);
      setError('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!reportName.trim()) {
        setError('Report name is required');
        return;
      }

      if (selectedFields.length === 0) {
        setError('Select at least one field');
        return;
      }

      const reportConfig = {
        name: reportName,
        description,
        fields: selectedFields,
        filters: selectedFilters,
        groupBy: selectedGroupBy,
        dateRange: selectedDateRange,
      };

      const savedReport = await analyticsService.saveReport(reportConfig);

      if (onSave) {
        onSave(savedReport);
      }

      alert('Report saved successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save report');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Builder</h2>
          <p className="text-gray-600 mt-1">Create custom reports with drag-and-drop fields</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={loading || selectedFields.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !reportName.trim() || selectedFields.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Monthly Cost Analysis"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this report shows..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Fields Section */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('fields')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-lg font-semibold">Fields ({selectedFields.length})</h3>
              {expandedSections.fields ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections.fields && (
              <div className="px-6 pb-6 space-y-4">
                {/* Field Categories */}
                {['dimensions', 'metrics', 'financial', 'compliance', 'security'].map((category) => {
                  const categoryFields = availableFields.filter((f) => f.category === category);
                  if (categoryFields.length === 0) return null;

                  return (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                        {category}
                      </h4>
                      <div className="space-y-2">
                        {categoryFields.map((field) => {
                          const isSelected = selectedFields.find((f) => f.id === field.id);
                          return (
                            <label
                              key={field.id}
                              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => handleFieldToggle(field)}
                                className="h-4 w-4 text-blue-600 rounded"
                              />
                              <div className="flex-1">
                                <span className="font-medium">{field.label}</span>
                                <span className="text-sm text-gray-500 ml-2">({field.type})</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('filters')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-lg font-semibold">
                Filters ({Object.keys(selectedFilters).length})
              </h3>
              {expandedSections.filters ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {expandedSections.filters && (
              <div className="px-6 pb-6 space-y-4">
                {Object.entries(selectedFilters).map(([filterId, filter]) => {
                  const field = availableFields.find((f) => f.id === filter.field);
                  const operators = field ? filterOperators[field.type] : [];

                  return (
                    <div key={filterId} className="flex gap-3 items-start">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <select
                          value={filter.field}
                          onChange={(e) => handleFilterChange(filterId, 'field', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          {availableFields.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) => handleFilterChange(filterId, 'operator', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          {operators.map((op) => (
                            <option key={op} value={op}>
                              {op.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={filter.value}
                          onChange={(e) => handleFilterChange(filterId, 'value', e.target.value)}
                          placeholder="Value"
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveFilter(filterId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={handleAddFilter}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Filter
                </button>
              </div>
            )}
          </div>

          {/* Grouping Section */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('grouping')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-lg font-semibold">Grouping & Time Range</h3>
              {expandedSections.grouping ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {expandedSections.grouping && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group By
                  </label>
                  <select
                    value={selectedGroupBy}
                    onChange={(e) => setSelectedGroupBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="service">Service</option>
                    <option value="region">Region</option>
                    <option value="account">Account</option>
                    <option value="tag">Tag</option>
                    <option value="compliance">Compliance Framework</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select
                    value={selectedDateRange}
                    onChange={(e) => setSelectedDateRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="12m">Last 12 months</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Fields & Templates */}
        <div className="space-y-6">
          {/* Templates */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Templates</h3>
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-gray-500 text-sm">No templates available</p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-600">{template.description}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected Fields Order */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              Selected Fields ({selectedFields.length})
            </h3>
            {selectedFields.length === 0 ? (
              <p className="text-gray-500 text-sm">No fields selected</p>
            ) : (
              <div className="space-y-2">
                {selectedFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 font-medium">{field.label}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleFieldReorder(field.id, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFieldReorder(field.id, 'down')}
                        disabled={index === selectedFields.length - 1}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold">Report Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h4 className="font-semibold">{reportName}</h4>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
              {previewData && (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {selectedFields.map((field) => (
                          <th key={field.id} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.data?.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {selectedFields.map((field) => (
                            <td key={field.id} className="px-4 py-3 text-sm">
                              {row[field.id] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportBuilder;
