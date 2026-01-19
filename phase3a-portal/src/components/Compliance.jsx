/**
 * Compliance Component
 * Display compliance status, frameworks, and detailed findings
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { formatDate } from '../utils/formatters';

export const Compliance = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complianceData, setComplianceData] = useState({
    overall_status: 'passing',
    frameworks: [],
    findings: [],
    last_assessment: null,
  });
  const [expandedFindings, setExpandedFindings] = useState({});

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      const [status, findings] = await Promise.all([
        apiService.getComplianceStatus(),
        apiService.getComplianceFindings(),
      ]);
      setComplianceData({
        overall_status: status.data.status,
        frameworks: status.data.frameworks,
        findings: findings.data,
        last_assessment: status.data.last_assessment,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to load compliance data:', err);
      setError(err.message || 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      await apiService.downloadComplianceReport();
    } catch (err) {
      console.error('Failed to download report:', err);
      setError('Failed to download compliance report');
    }
  };

  const toggleFinding = (findingId) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [findingId]: !prev[findingId],
    }));
  };

  const frameworkStats = {
    passing: complianceData.frameworks.filter((f) => f.status === 'passing').length,
    warning: complianceData.frameworks.filter((f) => f.status === 'warning').length,
    failing: complianceData.frameworks.filter((f) => f.status === 'failing').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Compliance</h1>
              <p className="text-gray-600 mt-1">
                Track your compliance status across frameworks
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading compliance data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overall Status Card */}
            <div className="mb-8 bg-white rounded-lg shadow-lg border-l-4 border-green-600 p-6">
              <div className="flex items-center">
                <CheckCircle2 className="w-12 h-12 text-green-600 mr-4" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Overall Status: Passing
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Last assessment:{' '}
                    {complianceData.last_assessment
                      ? formatDate(complianceData.last_assessment)
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Framework Status Grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 uppercase font-semibold">
                      Passing
                    </p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      {frameworkStats.passing}
                    </p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-green-600 opacity-30" />
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 uppercase font-semibold">
                      Warning
                    </p>
                    <p className="text-3xl font-bold text-yellow-600 mt-2">
                      {frameworkStats.warning}
                    </p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-yellow-600 opacity-30" />
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 uppercase font-semibold">
                      Failing
                    </p>
                    <p className="text-3xl font-bold text-red-600 mt-2">
                      {frameworkStats.failing}
                    </p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-red-600 opacity-30" />
                </div>
              </div>
            </div>

            {/* Frameworks */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Compliance Frameworks
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {complianceData.frameworks.map((framework) => (
                  <div key={framework.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <Shield className="w-6 h-6 mr-3 text-gray-400" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {framework.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {framework.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {framework.passing_controls}/{framework.total_controls}{' '}
                            Controls
                          </p>
                          <div className="w-32 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-green-600 transition-all"
                              style={{
                                width: `${
                                  (framework.passing_controls /
                                    framework.total_controls) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            framework.status === 'passing'
                              ? 'bg-green-100 text-green-800'
                              : framework.status === 'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {framework.status.charAt(0).toUpperCase() +
                            framework.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Findings */}
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Findings ({complianceData.findings.length})
                </h2>
              </div>

              {complianceData.findings.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {complianceData.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="px-6 py-4 hover:bg-gray-50 transition"
                    >
                      <button
                        onClick={() => toggleFinding(finding.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1">
                            {finding.severity === 'critical' && (
                              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                            )}
                            {finding.severity === 'high' && (
                              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
                            )}
                            {finding.severity === 'medium' && (
                              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                            )}
                            {finding.severity === 'low' && (
                              <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">
                                {finding.title}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {finding.framework} • {finding.control_id}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                finding.severity === 'critical'
                                  ? 'bg-red-100 text-red-800'
                                  : finding.severity === 'high'
                                  ? 'bg-orange-100 text-orange-800'
                                  : finding.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {finding.severity.charAt(0).toUpperCase() +
                                finding.severity.slice(1)}
                            </span>
                            {expandedFindings[finding.id] ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {expandedFindings[finding.id] && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">
                              Description
                            </h4>
                            <p className="text-sm text-gray-700">
                              {finding.description}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">
                              Remediation
                            </h4>
                            <p className="text-sm text-gray-700">
                              {finding.remediation}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-xs text-gray-600 uppercase">
                                Found
                              </p>
                              <p className="text-sm font-medium text-gray-900 mt-1">
                                {formatDate(finding.discovered_at)}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-xs text-gray-600 uppercase">
                                Status
                              </p>
                              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                                {finding.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4 opacity-20" />
                    <p className="text-gray-600 font-medium">No findings</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Your infrastructure is fully compliant
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Compliance;
