import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, clearStoredSessionToken } from '../services/apiService';
import { demoAwareApiService } from '../services/demoApiService';
import { logoutDemo } from '../services/jwtService';
import NotificationBell from './NotificationBell';
import { ToastContainer } from './NotificationToast';
import BRANDING from '../config/branding';
import { PORTAL_NARRATIVE } from '../content/portalNarrative';
import { useDemoCustomer } from '../hooks/useDemoCustomer';
import DemoCustomerIndicator from './DemoCustomerIndicator';
import { CUSTOMER_TIERS } from '../config/customerTiers';
import { trackPageView, trackPageEngagement, incrementPagesViewed, trackCTAClick, trackWave3HighValueAction } from '../utils/analytics';
import { fetchData, isDemoMode as checkDemoMode } from '../utils/fetchData';
import PersonalizedBanner from './PersonalizedBanner';
import { usePersonalization } from '../hooks/usePersonalization';
import ComplianceTrend from './ComplianceTrend';
import EvidencePackages from './EvidencePackages';
import { areAlertsConfigured } from './AlertSettings';
import './Dashboard.css';

const TEXAS_FINTECH_TIERS = new Set([CUSTOMER_TIERS.FINTECH_PRO, CUSTOMER_TIERS.FINTECH_ELITE]);
const SUPPORTED_FRAMEWORK_IDS = ['hipaa', 'soc2', 'pcidss'];

// Framework display metadata — no scores, no mock data
const FRAMEWORK_META = {
  hipaa:  { name: 'HIPAA',   description: 'Health Insurance Portability & Accountability Act', color: '#0f4c81', icon: '🏥' },
  soc2:   { name: 'SOC 2',   description: 'Service Organization Control 2',                    color: '#7c3aed', icon: '🔐' },
  pcidss: { name: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard',       color: '#0d9488', icon: '💳' },
};

function getTokenHeaders() {
  const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getCustomerTier() {
  return localStorage.getItem('customerTier') || '';
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(score, min = 0, max = 100) {
  return Math.max(min, Math.min(max, score));
}

function getHIPAAScore(source) {
  if (!source) return null;
  const raw = source.overallScore
    ?? source.overall_score
    ?? source.compliance_score
    ?? source.score
    ?? null;
  if (raw === null || raw === undefined) return null;
  return toSafeNumber(raw, null);
}

function getHighFindingsCount(source) {
  if (!source) return null;
  const raw = source.high_findings
    ?? source.highSeverityFindings
    ?? source.high_severity_findings
    ?? source.failing
    ?? null;
  if (raw === null || raw === undefined) return null;
  return toSafeNumber(raw, 0);
}

function getControlsPassingCount(source) {
  if (!source) return null;
  const raw = source.controls_passing
    ?? source.controlsPassing
    ?? source.passing
    ?? null;
  if (raw === null || raw === undefined) return null;
  return toSafeNumber(raw, 0);
}

// Returns [] when API has no data — callers must handle empty array
function normalizeFrameworks(payload) {
  const source = Array.isArray(payload) ? payload : payload?.data || [];
  if (!Array.isArray(source) || source.length === 0) return [];
  const normalized = source
    .map((framework) => {
      const id = String(framework.id || '').toLowerCase();
      const meta = FRAMEWORK_META[id];
      if (!meta) return null;
      return {
        id,
        ...meta,
        score: clampScore(toSafeNumber(framework.score, 0)),
        controls_passing: toSafeNumber(framework.controls_passing ?? framework.controlsPassing, 0),
        high_findings: toSafeNumber(framework.high_findings ?? framework.highFindings, 0),
      };
    })
    .filter(Boolean);
  return normalized;
}

function getLowestFramework(frameworks = []) {
  if (!Array.isArray(frameworks) || frameworks.length === 0) return null;
  return frameworks.reduce((lowest, current) => (current.score < lowest.score ? current : lowest), frameworks[0]);
}

function getScoreBadgeColor(score) {
  if (score < 75) return { background: '#fee2e2', color: '#b91c1c' };
  if (score < 90) return { background: '#fef3c7', color: '#92400e' };
  return { background: '#dcfce7', color: '#166534' };
}

function formatLastAssessed(lastAssessed) {
  if (!lastAssessed) return null;
  const assessedDate = new Date(lastAssessed);
  if (Number.isNaN(assessedDate.getTime())) return null;
  const elapsedMs = Date.now() - assessedDate.getTime();
  if (elapsedMs < 0) return assessedDate.toLocaleDateString();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
  return assessedDate.toLocaleDateString();
}

function normalizeHipaaFindingsForEvidence(payload) {
  const source = Array.isArray(payload) ? payload : payload?.findings || payload?.data || [];
  if (!Array.isArray(source)) return [];
  return source.map((finding) => ({
    severity: String(finding.severity || 'low').toLowerCase(),
    title: finding.title || 'Untitled finding',
    description: finding.description || finding.remediation || 'No description available.',
    control: finding.control || 'HIPAA control',
    status: String(finding.status || 'open').toLowerCase(),
  }));
}

function generateHipaaEvidenceReport(org, date, findings, score) {
  const openFindings = findings.filter((finding) => finding.status !== 'resolved');
  const resolvedFindings = findings.filter((finding) => finding.status === 'resolved');
  return `
HIPAA COMPLIANCE EVIDENCE PACKAGE
==================================
Organization: ${org}
Generated: ${date}
Overall Score: ${score !== null ? score + '%' : 'Not yet assessed'}

OPEN FINDINGS
-------------
${openFindings.map((finding) =>
  `[${String(finding.severity).toUpperCase()}] ${finding.title}\nControl: ${finding.control}\n${finding.description}`
).join('\n\n')}

RESOLVED CONTROLS
-----------------
${resolvedFindings.map((finding) =>
  `✓ ${finding.title} (${finding.control})`
).join('\n')}
`.trim();
}

function readStoredAlertSettings() {
  try {
    const raw = localStorage.getItem('alert_settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const personalization = usePersonalization();
  const [metrics, setMetrics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [texasCompliance, setTexasCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanPending, setScanPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showFirstRunOverlay, setShowFirstRunOverlay] = useState(false);
  const [animatedOverlayScore, setAnimatedOverlayScore] = useState(0);
  const [hipaaMetric, setHipaaMetric] = useState(null);
  const [frameworks, setFrameworks] = useState([]);
  const [frameworkProgressAnimated, setFrameworkProgressAnimated] = useState(false);
  const [hipaaMetricLoading, setHipaaMetricLoading] = useState(false);
  const [hipaaMetricError, setHipaaMetricError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [isExecutiveAdmin, setIsExecutiveAdmin] = useState(false);
  const { customer, customerIndex } = useDemoCustomer();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const startTimeRef = useRef(null);

  const effectiveTier = customer?.tier || getCustomerTier();
  const isHealthcareTier = effectiveTier === CUSTOMER_TIERS.HEALTHCARE;
  const hasTexasCompliance = TEXAS_FINTECH_TIERS.has(effectiveTier) || isDemoMode;
  const showsHIPAADashboard = effectiveTier === CUSTOMER_TIERS.HEALTHCARE || effectiveTier === CUSTOMER_TIERS.GOVERNMENT;

  // Scores are null until real API data arrives — never fabricated
  const hipaaLiveScore = getHIPAAScore(hipaaMetric || compliance);
  const hipaaHighFindings = getHighFindingsCount(hipaaMetric || compliance);
  const hipaaControlsPassing = getControlsPassingCount(hipaaMetric || compliance);
  const hipaaLastAssessed = formatLastAssessed(hipaaMetric?.last_assessed || compliance?.last_assessed);

  const firstRunTargetScore = hipaaLiveScore !== null ? clampScore(hipaaLiveScore) : null;
  const organizationName = customer?.name || customer?.orgName || localStorage.getItem('orgName') || 'Your Organization';
  const lowestFramework = getLowestFramework(frameworks);
  const lowestFrameworkBadgeColors = lowestFramework ? getScoreBadgeColor(lowestFramework.score) : null;
  const alertsConfigured = areAlertsConfigured(readStoredAlertSettings());

  const overlayRiskLevel = firstRunTargetScore === null
    ? { label: 'Pending', badgeBackground: '#f3f4f6', badgeColor: '#6b7280', detail: 'Assessment in progress' }
    : firstRunTargetScore >= 90
      ? { label: 'Low Risk', badgeBackground: '#d1fae5', badgeColor: '#065f46', detail: 'Strong baseline controls are active' }
      : firstRunTargetScore >= 75
        ? { label: 'Moderate Risk', badgeBackground: '#fef3c7', badgeColor: '#92400e', detail: 'Targeted remediation will improve posture' }
        : { label: 'High Risk', badgeBackground: '#fee2e2', badgeColor: '#991b1b', detail: 'Immediate remediation is recommended' };

  useEffect(() => {
    startTimeRef.current = Date.now();
    trackPageView('Dashboard', '/dashboard');
    incrementPagesViewed();
    const hasPendingScan = sessionStorage.getItem('scanPending') === 'true';
    if (hasPendingScan) {
      sessionStorage.removeItem('scanPending');
      setScanPending(true);
      setLoading(false);
    } else {
      loadDashboardData();
    }
    return () => {
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      trackPageEngagement('Dashboard', timeSpent);
    };
  }, []);

  const loadDashboardData = async () => {
    if (checkDemoMode()) {
      const mockMetrics = await fetchData('/metrics');
      setMetrics(mockMetrics);
      // Demo mode keeps its own data — frameworks stay empty for real users
      setLoading(false);
      return;
    }
    try {
      const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const requests = [
        apiService.getMetrics(),
        apiService.getInvoices(),
        apiService.getApiKeys(),
        apiService.getComplianceStatus(),
        apiService.getTickets({ status: 'open', limit: 5 }),
        fetch('/api/frameworks', { headers })
      ];
      if (hasTexasCompliance) requests.push(demoAwareApiService.getFintechComplianceStatus());
      const [metricsData, invoicesData, keysData, complianceData, ticketsData, frameworksResponse, texasData] = await Promise.all(requests);
      setMetrics(metricsData);
      const invoicesArray = invoicesData?.data || invoicesData;
      const keysArray = keysData?.data || keysData;
      const ticketsArray = ticketsData?.data || ticketsData;
      setInvoices(Array.isArray(invoicesArray) ? invoicesArray.slice(0, 3) : []);
      setApiKeys(Array.isArray(keysArray) ? keysArray : []);
      setCompliance(complianceData);
      setTickets(Array.isArray(ticketsArray) ? ticketsArray.slice(0, 5) : []);
      if (frameworksResponse?.ok) {
        const frameworksPayload = await frameworksResponse.json();
        setFrameworks(normalizeFrameworks(frameworksPayload));
      }
      // If API fails or returns empty, frameworks stays [] — blank state shows
      if (texasData) setTexasCompliance(texasData.data || texasData);

      const hasSeenFirstRun = localStorage.getItem('hipaa_first_run_seen') === 'true';
      if (metricsData && isHealthcareTier && !hasSeenFirstRun) {
        setShowFirstRunOverlay(true);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // frameworks stays [] — no mock fallback
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutDemo();
    clearStoredSessionToken();
    navigate('/login');
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      if (isHealthcareTier) {
        const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
        const findingsRes = await fetch('/api/hipaa/findings', {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        const findingsPayload = findingsRes.ok
          ? await findingsRes.json()
          : (hipaaMetric?.findings || compliance?.findings || []);
        const findings = normalizeHipaaFindingsForEvidence(findingsPayload);
        const reportDate = new Date().toISOString().split('T')[0];
        const report = generateHipaaEvidenceReport(
          organizationName,
          reportDate,
          findings,
          hipaaLiveScore !== null ? clampScore(hipaaLiveScore) : null
        );
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${organizationName}-HIPAA-Evidence-${reportDate}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
      const res = await fetch('/api/compliance/findings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to fetch compliance findings: ${res.status} ${res.statusText}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securebase-compliance-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download compliance report:', err);
      setDownloadError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCriticalAlert = (notification) => setToasts(prev => [...prev, notification]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const markFirstRunSeen = () => {
    localStorage.setItem('hipaa_first_run_seen', 'true');
    setShowFirstRunOverlay(false);
  };

  const handleFirstRunReview = () => {
    localStorage.setItem('active_framework', 'hipaa');
    navigate('/hipaa-dashboard');
    localStorage.setItem('hipaa_jump_to_findings', 'true');
    markFirstRunSeen();
  };

  const handleViewFrameworkDetails = (frameworkId) => {
    localStorage.setItem('active_framework', SUPPORTED_FRAMEWORK_IDS.includes(frameworkId) ? frameworkId : 'hipaa');
    navigate('/hipaa-dashboard');
  };

  const handleFirstRunExport = async () => {
    if (typeof handleDownloadReport === 'function') {
      await handleDownloadReport();
    }
    markFirstRunSeen();
  };

  useEffect(() => {
    if (!showFirstRunOverlay || firstRunTargetScore === null) {
      setAnimatedOverlayScore(0);
      return;
    }
    setAnimatedOverlayScore(0);
    const timer = setInterval(() => {
      setAnimatedOverlayScore((previous) => {
        const next = Math.min(firstRunTargetScore, previous + 3);
        if (next >= firstRunTargetScore) clearInterval(timer);
        return next;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [showFirstRunOverlay, firstRunTargetScore]);

  useEffect(() => {
    if (!isHealthcareTier) return undefined;
    let active = true;
    const loadHipaaMetric = async () => {
      setHipaaMetricLoading(true);
      setHipaaMetricError('');
      try {
        const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
        const response = await fetch('/api/hipaa/compliance', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`HIPAA metric request failed: ${response.status}`);
        const payload = await response.json();
        if (!active) return;
        setHipaaMetric(payload?.data || payload);
      } catch (error) {
        console.error('Failed to load HIPAA compliance metric.');
        if (active) setHipaaMetricError('Unable to load HIPAA data. Connect your AWS account to begin assessment.');
      } finally {
        if (active) setHipaaMetricLoading(false);
      }
    };
    loadHipaaMetric();
    return () => { active = false; };
  }, [isHealthcareTier]);

  useEffect(() => {
    let active = true;
    const currentUserEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
    const loadUserRole = async () => {
      try {
        const response = await fetch('/api/users', {
          method: 'GET',
          headers: getTokenHeaders(),
        });
        if (!response.ok) throw new Error(`users_fetch_failed:${response.status}`);
        const users = await response.json();
        const matched = (Array.isArray(users) ? users : []).find(
          (user) => String(user.email || '').toLowerCase() === currentUserEmail,
        );
        if (active) setIsExecutiveAdmin(String(matched?.role || '').toLowerCase() === 'admin');
      } catch {
        // No mock fallback — if we can't confirm admin role, don't show admin features
        if (active) setIsExecutiveAdmin(false);
      }
    };
    loadUserRole();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setFrameworkProgressAnimated(false);
    const timer = window.setTimeout(() => setFrameworkProgressAnimated(true), 10);
    return () => window.clearTimeout(timer);
  }, [frameworks]);

  // Scan step animation
  const [currentStep, setCurrentStep] = useState(0);
  useEffect(() => {
    if (!scanPending) return;
    if (currentStep >= 5) return;
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= 4) { clearInterval(timer); return 5; }
        return prev + 1;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [scanPending]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (scanPending) {
    return (
      <div className="dashboard-page">
        <PersonalizedBanner />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{PORTAL_NARRATIVE.dashboardHeadline}</h1>
              <p>Welcome back to {BRANDING.productShortName}</p>
            </div>
            <div className="header-right">
              <NotificationBell onCriticalAlert={handleCriticalAlert} />
              <button className="logout-button" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="dashboard-empty-state">
            <div style={{ maxWidth: '560px', margin: '0 auto', padding: '3rem 1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
                  Analyzing your AWS environment
                </h2>
                <p style={{ color: '#6b7280', lineHeight: '1.6', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto' }}>
                  SecureBase is running your first HIPAA compliance assessment. Results are typically ready in 10–15 minutes.
                </p>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />
              <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Building your HIPAA posture report
              </p>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                {[
                  'Auditing IAM policies & roles',
                  'Scanning S3 bucket configurations',
                  'Checking encryption at rest & transit',
                  'Mapping PHI data locations',
                  'Calculating HIPAA posture score',
                ].map((label, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep && currentStep < 5;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', fontSize: '0.9rem', color: isDone ? '#374151' : isActive ? '#1a73e8' : '#9ca3af' }}>
                      {isDone
                        ? <span style={{ color: '#10b981', fontWeight: '700', minWidth: '1.2rem' }}>✓</span>
                        : isActive
                          ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', minWidth: '1.2rem', color: '#1a73e8' }}>⟳</span>
                          : <span style={{ minWidth: '1.2rem', color: '#d1d5db' }}>⏳</span>
                      }
                      {label}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const userEmail = localStorage.getItem('userEmail');
                if (!userEmail) return null;
                const mailto = `mailto:${userEmail}?subject=SecureBase%20%E2%80%94%20Your%20HIPAA%20Scan%20is%20Ready&body=Your%20SecureBase%20HIPAA%20compliance%20scan%20has%20completed.%20Log%20in%20to%20view%20your%20results%3A%20https%3A%2F%2Fportal.securebase.tximhotep.com%2Fdashboard`;
                return (
                  <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>📬 Want a notification when it's ready?</p>
                    <a href={mailto} style={{ display: 'inline-block', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.875rem', color: '#374151', textDecoration: 'none', background: 'white' }}>
                      Send me an email notification
                    </a>
                  </div>
                );
              })()}
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>While you wait — explore what's coming:</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[['🛡️', 'HIPAA Posture Score'], ['⚠️', 'Open Findings & Remediation'], ['📄', 'Evidence Export Package']].map(([icon, title]) => (
                  <div key={title} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem 1.25rem', flex: '1 1 160px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.75rem' }}>{icon}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginTop: '0.5rem' }}>{title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <PersonalizedBanner />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{PORTAL_NARRATIVE.dashboardHeadline}</h1>
            <p>Welcome back to {BRANDING.productShortName}</p>
          </div>
          <div className="header-right">
            <NotificationBell onCriticalAlert={handleCriticalAlert} />
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="narrative-banner">
          <p className="narrative-banner__eyebrow">{PORTAL_NARRATIVE.platformTitle}</p>
          <h2>{PORTAL_NARRATIVE.dashboardSubheadline}</h2>
        </section>

        {isDemoMode && customer && customerIndex !== null && (
          <DemoCustomerIndicator customer={customer} customerIndex={customerIndex} />
        )}

        {/* Compliance Frameworks — only renders when real API data exists */}
        {isHealthcareTier && frameworks.length > 0 && (
          <section className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2>Compliance Frameworks</h2>
            </div>
            <div className="card-content">
              <div className="framework-cards-grid">
                {frameworks.map((framework) => (
                  <div key={framework.id} className="framework-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{framework.icon} {framework.name}</span>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 700 }}>Score: {framework.score}%</span>
                    </div>
                    <div className="framework-progress-bar">
                      <div
                        className="framework-progress-fill"
                        style={{ width: `${frameworkProgressAnimated ? framework.score : 0}%`, background: framework.color }}
                      />
                    </div>
                    <p style={{ margin: '0.4rem 0 0.75rem', fontSize: '0.82rem', color: '#6b7280' }}>
                      {framework.high_findings} high finding{framework.high_findings === 1 ? '' : 's'}
                    </p>
                    <button className="view-all-btn" onClick={() => handleViewFrameworkDetails(framework.id)}>
                      View Details →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Connect prompt — shows when healthcare tier but no framework data yet */}
        {isHealthcareTier && frameworks.length === 0 && !loading && (
          <section className="dashboard-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #1a73e8' }}>
            <div className="card-content" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>☁️</div>
              <h2 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Connect your AWS account to begin</h2>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Your HIPAA posture score, compliance frameworks, and findings will appear here once your AWS environment is connected.
              </p>
              <button
                onClick={() => navigate('/cloud-connection')}
                style={{ background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Connect AWS Account →
              </button>
            </div>
          </section>
        )}

        {/* Metrics Grid */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#e6f2ff' }}>💳</div>
            <div className="metric-content">
              <h3>Monthly Charge</h3>
              <p className="metric-value">${metrics?.monthlyCharge?.toLocaleString() || '0'}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#f0fdf4' }}>🔑</div>
            <div className="metric-content">
              <h3>Active API Keys</h3>
              <p className="metric-value">{apiKeys?.filter(k => k.status === 'active').length || 0}</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/compliance')}>
            <div className="metric-icon" style={{ background: compliance?.overall_status === 'passing' ? '#f0fdf4' : '#fff7ed' }}>
              {compliance?.overall_status === 'passing' ? '✅' : '⚠️'}
            </div>
            <div className="metric-content">
              <h3>Compliance Status</h3>
              <p className="metric-value">{compliance?.overall_status || '—'}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#fef2f2' }}>🎫</div>
            <div className="metric-content">
              <h3>Open Tickets</h3>
              <p className="metric-value">{tickets?.length || 0}</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/sre-dashboard')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/sre-dashboard')} aria-label="SRE Dashboard">
            <div className="metric-icon" style={{ background: '#eff6ff' }}>🖥️</div>
            <div className="metric-content"><h3>SRE Dashboard</h3><p className="metric-value">Infrastructure</p></div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/alerts')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/alerts')} aria-label="Alerts Settings">
            <div className="metric-icon" style={{ background: '#fef9c3' }}>🔔</div>
            <div className="metric-content">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                Alerts 🔔
                {!alertsConfigured && <span className="alerts-unconfigured-dot" aria-label="Alerts not configured" />}
              </h3>
              <p className="metric-value">Operations</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/evidence')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/evidence')} aria-label="Audit Evidence Packages" style={{ borderLeft: '3px solid #1e3a5f' }}>
            <div className="metric-icon" style={{ background: '#e8f0fe' }}>🔒</div>
            <div className="metric-content">
              <h3>Audit Evidence</h3>
              <p className="metric-value" style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>Download Packages →</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/compliance/trend')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/compliance/trend')} aria-label="Compliance Score Trend" style={{ borderLeft: '3px solid #0f4c81' }}>
            <div className="metric-icon" style={{ background: '#eff6ff' }}>📈</div>
            <div className="metric-content">
              <h3>Compliance Trend</h3>
              <p className="metric-value" style={{ color: '#0f4c81', fontSize: '0.9rem' }}>90-Day History →</p>
            </div>
          </div>

          <div className="metric-card clickable" onClick={() => navigate('/cloud-connection')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/cloud-connection')} aria-label="Cloud Connection">
            <div className="metric-icon" style={{ background: '#f0f4ff' }}>☁️</div>
            <div className="metric-content">
              <h3>Cloud Connection</h3>
              <p className="metric-value" style={{ color: '#3b5bdb', fontSize: '0.9rem' }}>Connect AWS Account →</p>
            </div>
          </div>

          {isHealthcareTier && (
            <div className="metric-card" style={{ border: '1px solid #dbeafe', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <div className="metric-icon" style={{ background: '#dbeafe' }}>🩺</div>
                <div className="metric-content">
                  <h3>Live HIPAA Score</h3>
                  <p className="metric-value" style={{ color: '#0f4c81' }}>
                    {hipaaMetricLoading
                      ? '...'
                      : hipaaLiveScore !== null
                        ? `${Math.round(clampScore(hipaaLiveScore))}%`
                        : '—'}
                  </p>
                </div>
              </div>
              {hipaaLiveScore !== null ? (
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ height: '100%', width: `${Math.round(clampScore(hipaaLiveScore))}%`, background: '#0f4c81', borderRadius: '999px' }} />
                </div>
              ) : (
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', marginBottom: '0.5rem' }} />
              )}
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                {hipaaLastAssessed ? `Last assessed: ${hipaaLastAssessed}` : 'Not yet assessed — connect your AWS account'}
              </p>
              {hipaaMetricError && <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#92400e' }}>{hipaaMetricError}</p>}
            </div>
          )}

          {hasTexasCompliance && (
            <div className="metric-card clickable" onClick={() => navigate('/fintech-portal')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/fintech-portal')} aria-label="Texas Examiner Portal">
              <div className="metric-icon" style={{ background: '#eff6ff' }}>⭐</div>
              <div className="metric-content">
                <h3>Texas DOB Compliance</h3>
                <p className="metric-value" style={{ color: '#10b981', fontSize: '0.95rem' }}>
                  {texasCompliance ? `${texasCompliance.passingControls}/${texasCompliance.totalControls} controls` : '—'}
                </p>
              </div>
            </div>
          )}

          {showsHIPAADashboard && (
            <div className="metric-card clickable" onClick={() => navigate('/hipaa-dashboard')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/hipaa-dashboard')} aria-label="HIPAA Dashboard">
              <div className="metric-icon" style={{ background: '#ecfdf5' }}>🏥</div>
              <div className="metric-content"><h3>HIPAA Compliance</h3><p className="metric-value" style={{ color: '#10b981', fontSize: '0.95rem' }}>View Dashboard →</p></div>
            </div>
          )}

          {isHealthcareTier && (
            <div className="metric-card clickable" onClick={() => navigate('/team')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/team')} aria-label="Team">
              <div className="metric-icon" style={{ background: '#eef2ff' }}>👥</div>
              <div className="metric-content"><h3>Team</h3><p className="metric-value" style={{ color: '#4338ca', fontSize: '0.95rem' }}>Manage Members →</p></div>
            </div>
          )}

          {isHealthcareTier && isExecutiveAdmin && (
            <div className="metric-card clickable" onClick={() => navigate('/executive')} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/executive')} aria-label="Executive View">
              <div className="metric-icon" style={{ background: '#e0f2fe' }}>📊</div>
              <div className="metric-content"><h3>Executive View</h3><p className="metric-value" style={{ color: '#0f4c81', fontSize: '0.95rem' }}>Board Summary →</p></div>
            </div>
          )}
        </section>

        {/* Two Column Layout */}
        <div className="dashboard-columns">
          <div className="dashboard-column">
            <section className="dashboard-card">
              <div className="card-header"><h2>Recent Invoices</h2><button className="view-all-btn">View All →</button></div>
              <div className="card-content">
                {invoices.length > 0 ? (
                  <div className="invoices-list">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="invoice-item">
                        <div className="invoice-info">
                          <p className="invoice-number">{invoice.invoice_number}</p>
                          <p className="invoice-date">{invoice.created_at || invoice.date ? new Date(invoice.created_at || invoice.date).toLocaleDateString() : '—'}</p>
                        </div>
                        <div className="invoice-amount">
                          <p className="amount">${(invoice.total_amount ?? invoice.amount ?? 0).toLocaleString()}</p>
                          <span className={`status-badge ${invoice.status}`}>{invoice.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-state">No invoices yet</p>}
              </div>
            </section>

            <section className="dashboard-card">
              <div className="card-header"><h2>API Keys</h2><button className="view-all-btn">Manage →</button></div>
              <div className="card-content">
                {apiKeys.length > 0 ? (
                  <div className="api-keys-list">
                    {apiKeys.slice(0, 3).map((key) => (
                      <div key={key.id} className="api-key-item">
                        <div className="key-info"><p className="key-name">{key.name}</p><p className="key-preview">{key.key_preview}</p></div>
                        <span className={`status-badge ${key.status}`}>{key.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-state">No API keys yet</p>}
              </div>
            </section>
          </div>

          <div className="dashboard-column">
            <section className="dashboard-card">
              <div className="card-header">
                <h2>Compliance Overview</h2>
                <button className="view-all-btn" onClick={() => navigate('/compliance')}>View Details →</button>
              </div>
              <div className="card-content">
                {compliance ? (
                  <div className="compliance-summary">
                    <div className="compliance-status">
                      <div className={`status-indicator ${compliance.overall_status}`}>
                        {compliance.overall_status === 'passing' ? '✅' : '⚠️'}
                      </div>
                      <div>
                        <p className="status-label">Overall Status</p>
                        <p className="status-value">{compliance.overall_status}</p>
                      </div>
                    </div>
                    <div className="compliance-stats">
                      <div className="stat"><span className="stat-value" style={{ color: '#10b981' }}>{compliance.passing || 0}</span><span className="stat-label">Passing</span></div>
                      <div className="stat"><span className="stat-value" style={{ color: '#f59e0b' }}>{compliance.warning || 0}</span><span className="stat-label">Warning</span></div>
                      <div className="stat"><span className="stat-value" style={{ color: '#ef4444' }}>{compliance.failing || 0}</span><span className="stat-label">Failing</span></div>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">Connect your AWS account to see compliance data</p>
                )}
              </div>
            </section>

            <section className="dashboard-card" style={{ borderLeft: '4px solid #1e3a5f' }}>
              <div className="card-header">
                <h2>Audit Evidence</h2>
                <div className="flex items-center gap-3">
                  <button className="view-all-btn" onClick={handleDownloadReport} disabled={downloading} aria-label="Download compliance findings report">
                    {downloading ? 'Generating…' : '⬇ Download Report'}
                  </button>
                  <button className="view-all-btn" onClick={() => navigate('/evidence')}>Full View →</button>
                </div>
              </div>
              {downloadError && (
                <p className="px-6 pt-3 text-sm text-red-600" role="alert" aria-live="polite">{downloadError}</p>
              )}
              <div className="card-content">
                <EvidencePackages embedded />
              </div>
            </section>

            <section className="dashboard-card">
              <div className="card-header"><h2>Recent Tickets</h2><button className="view-all-btn">View All →</button></div>
              <div className="card-content">
                {tickets.length > 0 ? (
                  <div className="tickets-list">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="ticket-item">
                        <div className="ticket-info">
                          <p className="ticket-title">{ticket.subject}</p>
                          <p className="ticket-meta">
                            <span className={`priority-badge ${ticket.priority}`}>{ticket.priority}</span>
                            <span className="ticket-date">{new Date(ticket.created_at).toLocaleDateString()}</span>
                          </p>
                        </div>
                        <span className={`status-badge ${ticket.status}`}>{ticket.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-state">No open tickets</p>}
              </div>
            </section>

            <section className="dashboard-card" style={{ borderLeft: '4px solid #0f4c81' }}>
              <div className="card-header">
                <h2>📈 Compliance Trend</h2>
                <button className="view-all-btn" onClick={() => navigate('/compliance/trend')}>Full View →</button>
              </div>
              <div className="card-content">
                <ComplianceTrend defaultFramework="HIPAA" days={90} compact={true} />
              </div>
            </section>

            {hasTexasCompliance && texasCompliance && (
              <section className="dashboard-card" style={{ borderLeft: '4px solid #1e3a5f' }}>
                <div className="card-header">
                  <h2>⭐ Texas DOB Compliance</h2>
                  <button className="view-all-btn" onClick={() => navigate('/fintech-portal')}>Access Examiner Portal →</button>
                </div>
                <div className="card-content">
                  <div>
                    <div className="compliance-status" style={{ marginBottom: '1rem' }}>
                      <div className="status-indicator passing" style={{ background: '#f0fdf4' }}>✅</div>
                      <div><p className="status-label">Texas DOB Status</p><p className="status-value" style={{ color: '#10b981' }}>{texasCompliance.passingControls}/{texasCompliance.totalControls} Controls Passing</p></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(texasCompliance.controls || []).slice(0, 3).map(ctrl => (
                        <div key={ctrl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: 6 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>✅ {ctrl.id}</span>
                          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{ctrl.name}</span>
                        </div>
                      ))}
                      {(texasCompliance.controls || []).length > 3 && <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', margin: '0.25rem 0 0' }}>+{(texasCompliance.controls || []).length - 3} more controls</p>}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {showsHIPAADashboard && lowestFramework && (
              <section className="dashboard-card" style={{ borderLeft: '4px solid #0f4c81' }}>
                <div className="card-header">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    📊 Compliance
                    <span
                      className="nav-score-badge"
                      style={{ background: lowestFrameworkBadgeColors.background, color: lowestFrameworkBadgeColors.color }}
                      title={`Lowest score: ${lowestFramework.name} (${lowestFramework.score}%)`}
                    >
                      {lowestFramework.score}%
                    </span>
                  </h2>
                  <button className="view-all-btn" onClick={() => handleViewFrameworkDetails(localStorage.getItem('active_framework') || 'hipaa')}>Open Compliance Dashboard →</button>
                </div>
                <div className="card-content">
                  <p className="empty-state">Connect your AWS account to see HIPAA safeguard breakdown</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {showFirstRunOverlay && firstRunTargetScore !== null && (
        <div className="hipaa-first-run-overlay" role="dialog" aria-modal="true" aria-label="HIPAA first run summary">
          <div className="hipaa-first-run-card">
            <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '0.5rem' }}>🎉</div>
            <h2 style={{ margin: 0, textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#111827' }}>Your HIPAA Assessment is Ready</h2>
            <p style={{ margin: '0.6rem 0 1.5rem', textAlign: 'center', fontSize: '0.82rem', color: '#6b7280' }}>
              {organizationName} · Healthcare Tier
            </p>
            <div style={{ background: 'linear-gradient(135deg, #0f4c81 0%, #1a73e8 100%)', borderRadius: '14px', padding: '1.5rem', color: '#fff', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.08em' }}>HIPAA POSTURE SCORE</p>
              <div style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, margin: '0.35rem 0 0.5rem' }}>{animatedOverlayScore}%</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ background: overlayRiskLevel.badgeBackground, color: overlayRiskLevel.badgeColor, borderRadius: '999px', padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {overlayRiskLevel.label}
                </span>
                <span style={{ fontSize: '0.82rem', opacity: 0.95 }}>{overlayRiskLevel.detail}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontWeight: 700, color: '#1f2937' }}>
                ⚠️ {hipaaHighFindings !== null ? hipaaHighFindings : '—'} High findings
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', border: '1px solid #e5e7eb', fontSize: '0.9rem', fontWeight: 700, color: '#1f2937' }}>
                ✓ {hipaaControlsPassing !== null ? hipaaControlsPassing : '—'} Controls passing
              </div>
            </div>
            <button onClick={handleFirstRunReview} style={{ width: '100%', background: '#0f4c81', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', marginBottom: '0.65rem' }}>
              Review Critical Findings →
            </button>
            <button onClick={handleFirstRunExport} style={{ width: '100%', background: '#fff', color: '#0f4c81', border: '2px solid #0f4c81', borderRadius: '10px', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              Download Evidence Package
            </button>
            <button onClick={markFirstRunSeen} style={{ display: 'block', margin: '0.9rem auto 0', background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>
              ✕ Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
