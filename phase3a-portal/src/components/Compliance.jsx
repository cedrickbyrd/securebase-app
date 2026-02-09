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
      
      // Handle both wrapped and unwrapped API responses
      const statusData = status?.data || status;
      const findingsData = findings?.data || findings;
      
      setComplianceData({
        overall_status: statusData?.status || statusData?.overall_status || 'passing',
        frameworks: statusData?.frameworks || [],
        findings: Array.isArray(findingsData) ? findingsData : [],
        last_assessment: statusData?.last_assessment,
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
              <Download />
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
            {/* Overall Status */}
            <div className={styles.overallStatus}>
              <div className={styles.statusBadge}>
                <CheckCircle2 className={styles.statusIcon} />
                <div>
                  <h2 className={styles.statusTitle}>
                    Overall Status: {complianceData.overall_status.charAt(0).toUpperCase() + complianceData.overall_status.slice(1)}
                  </h2>
                  <p className={styles.statusSubtitle}>
                    Last assessment: {complianceData.last_assessment ? formatDate(complianceData.last_assessment) : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.passing}`}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>PASSING</span>
                  <CheckCircle2 className={styles.statIcon} />
                </div>
                <div className={styles.statValue}>{frameworkStats.passing}</div>
              </div>

              <div className={`${styles.statCard} ${styles.warning}`}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>WARNING</span>
                  <AlertTriangle className={styles.statIcon} />
                </div>
                <div className={styles.statValue}>{frameworkStats.warning}</div>
              </div>

              <div className={`${styles.statCard} ${styles.failing}`}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>FAILING</span>
                  <AlertCircle className={styles.statIcon} />
                </div>
                <div className={styles.statValue}>{frameworkStats.failing}</div>
              </div>
            </div>

            {/* Frameworks */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Compliance Frameworks</h2>
              <div className={styles.frameworksGrid}>
                {complianceData.frameworks.map((framework) => (
                  <div key={framework.id} className={styles.frameworkCard}>
                    <div className={styles.frameworkHeader}>
                      <Shield className={styles.frameworkIcon} />
                      <div className={styles.frameworkInfo}>
                        <h3 className={styles.frameworkName}>{framework.name}</h3>
                        <p className={styles.frameworkMeta}>
                          Last checked: {formatDate(framework.last_check)}
                        </p>
                      </div>
                    </div>
                    <div className={styles.frameworkFooter}>
                      <span className={`${styles.statusBadge} ${styles[framework.status]}`}>
                        {framework.status.toUpperCase()}
                      </span>
                      <span className={styles.score}>Score: {framework.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Compliance;
