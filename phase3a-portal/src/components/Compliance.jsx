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
import styles from './Compliance.module.css';

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
    <div className={styles.complianceContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTop}>
            <div className={styles.headerTitle}>
              <h1 className={styles.title}>Compliance</h1>
              <p className={styles.subtitle}>
                Track your compliance status across frameworks
              </p>
            </div>
            <button
              onClick={handleDownloadReport}
              className={styles.downloadButton}
            >
              <Download className="w-5 h-5 mr-2" />
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle className={styles.errorIcon} />
            <div className={styles.errorContent}>
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingContent}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Loading compliance data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overall Status Card */}
            <div className={styles.overallStatusCard}>
              <div className={styles.overallStatusContent}>
                <CheckCircle2 className={styles.overallStatusIcon} />
                <div className={styles.overallStatusText}>
                  <h2>
                    Overall Status: Passing
                  </h2>
                  <p>
                    Last assessment:{' '}
                    {complianceData.last_assessment
                      ? formatDate(complianceData.last_assessment)
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Framework Status Grid */}
            <div className={styles.frameworkStatsGrid}>
              <div className={`${styles.statCard} ${styles.passing}`}>
                <div className={styles.statCardContent}>
                  <div>
                    <p className={styles.statLabel}>
                      Passing
                    </p>
                    <p className={styles.statValue}>
                      {frameworkStats.passing}
                    </p>
                  </div>
                  <CheckCircle2 className={styles.statCardIcon} />
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.warning}`}>
                <div className={styles.statCardContent}>
                  <div>
                    <p className={styles.statLabel}>
                      Warning
                    </p>
                    <p className={styles.statValue}>
                      {frameworkStats.warning}
                    </p>
                  </div>
                  <AlertTriangle className={styles.statCardIcon} />
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.failing}`}>
                <div className={styles.statCardContent}>
                  <div>
                    <p className={styles.statLabel}>
                      Failing
                    </p>
                    <p className={styles.statValue}>
                      {frameworkStats.failing}
                    </p>
                  </div>
                  <AlertCircle className={styles.statCardIcon} />
                </div>
              </div>
            </div>

            {/* Frameworks */}
            <div className={styles.frameworksCard}>
              <div className={styles.frameworksHeader}>
                <h2>
                  Compliance Frameworks
                </h2>
              </div>
              <div className={styles.frameworksList}>
                {complianceData.frameworks.map((framework) => (
                  <div key={framework.id} className={styles.frameworkItem}>
                    <div className={styles.frameworkContent}>
                      <div className={styles.frameworkLeft}>
                        <Shield className={styles.frameworkIcon} />
                        <div className={styles.frameworkInfo}>
                          <h3>
                            {framework.name}
                          </h3>
                          <p>
                            {framework.description}
                          </p>
                        </div>
                      </div>
                      <div className={styles.frameworkRight}>
                        <div className={styles.frameworkProgress}>
                          <p>
                            {framework.passing_controls}/{framework.total_controls}{' '}
                            Controls
                          </p>
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
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
                          className={`${styles.statusBadge} ${
                            framework.status === 'passing'
                              ? styles.passing
                              : framework.status === 'warning'
                              ? styles.warning
                              : styles.failing
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
            <div className={styles.findingsCard}>
              <div className={styles.findingsHeader}>
                <h2>
                  Findings ({complianceData.findings.length})
                </h2>
              </div>

              {complianceData.findings.length > 0 ? (
                <div className={styles.findingsList}>
                  {complianceData.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className={styles.findingItem}
                    >
                      <button
                        onClick={() => toggleFinding(finding.id)}
                        className={styles.findingButton}
                      >
                        <div className={styles.findingTop}>
                          <div className={styles.findingLeft}>
                            {finding.severity === 'critical' && (
                              <AlertCircle className={`${styles.findingSeverityIcon} ${styles.critical}`} />
                            )}
                            {finding.severity === 'high' && (
                              <AlertTriangle className={`${styles.findingSeverityIcon} ${styles.high}`} />
                            )}
                            {finding.severity === 'medium' && (
                              <AlertTriangle className={`${styles.findingSeverityIcon} ${styles.medium}`} />
                            )}
                            {finding.severity === 'low' && (
                              <CheckCircle2 className={`${styles.findingSeverityIcon} ${styles.low}`} />
                            )}
                            <div className={styles.findingInfo}>
                              <h3>
                                {finding.title}
                              </h3>
                              <p className={styles.findingMeta}>
                                {finding.framework} • {finding.control_id}
                              </p>
                            </div>
                          </div>
                          <div className={styles.findingRight}>
                            <span
                              className={`${styles.severityBadge} ${styles[finding.severity]}`}
                            >
                              {finding.severity.charAt(0).toUpperCase() +
                                finding.severity.slice(1)}
                            </span>
                            {expandedFindings[finding.id] ? (
                              <ChevronUp className={styles.chevronIcon} />
                            ) : (
                              <ChevronDown className={styles.chevronIcon} />
                            )}
                          </div>
                        </div>
                      </button>

                      {expandedFindings[finding.id] && (
                        <div className={styles.findingDetails}>
                          <div className={styles.detailSection}>
                            <h4>
                              Description
                            </h4>
                            <p>
                              {finding.description}
                            </p>
                          </div>
                          <div className={styles.detailSection}>
                            <h4>
                              Remediation
                            </h4>
                            <p>
                              {finding.remediation}
                            </p>
                          </div>
                          <div className={styles.detailGrid}>
                            <div className={styles.detailGridItem}>
                              <p className={styles.detailLabel}>
                                Found
                              </p>
                              <p className={styles.detailValue}>
                                {formatDate(finding.discovered_at)}
                              </p>
                            </div>
                            <div className={styles.detailGridItem}>
                              <p className={styles.detailLabel}>
                                Status
                              </p>
                              <p className={styles.detailValue}>
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
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateContent}>
                    <CheckCircle2 className={styles.emptyStateIcon} />
                    <p className={styles.emptyStateTitle}>No findings</p>
                    <p className={styles.emptyStateText}>
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
