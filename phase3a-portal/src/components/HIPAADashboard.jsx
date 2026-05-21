import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sreService } from '../services/sreService';
import { trackPageView, trackHIPAARoute } from '../utils/analytics';
import { logoutDemo } from '../services/jwtService';
import { buildDeterministicFallbackId, getAvatarColor, getInitials } from '../utils/teamUtils';
import './Dashboard.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Delay (ms) before the export download triggers — gives the UX spinner time to render */
const EXPORT_GENERATION_DELAY_MS = 1200;
const FINDING_FILTERS = ['all', 'critical', 'high', 'medium', 'low', 'resolved', 'mine'];
const MOCK_USERS = [
  { id: 'u001', name: 'Matthew Matturro', email: 'Matthew.matturro@trinetx.com', role: 'admin', avatar_initials: 'MM', joined_at: '2026-04-01T00:00:00Z' },
  { id: 'u002', name: 'Sarah Chen', email: 'sarah.chen@trinetx.com', role: 'analyst', avatar_initials: 'SC', joined_at: '2026-04-15T00:00:00Z' },
  { id: 'u003', name: 'David Park', email: 'david.park@trinetx.com', role: 'auditor', avatar_initials: 'DP', joined_at: '2026-05-01T00:00:00Z' },
];
const MOCK_FINDINGS = [
  {
    id: 'f001',
    severity: 'critical',
    title: 'Unencrypted PHI in S3 Bucket',
    description: 'S3 bucket "trinetx-patient-data" does not have server-side encryption enabled.',
    control: 'HIPAA §164.312(a)(2)(iv)',
    status: 'open',
    remediation_steps: [
      'Navigate to S3 console and select the bucket',
      'Go to Properties → Default encryption',
      'Enable SSE-S3 or SSE-KMS encryption',
      'Apply bucket policy to deny unencrypted uploads'
    ]
  },
  {
    id: 'f002',
    severity: 'high',
    title: 'MFA Not Enforced for Admin Users',
    description: '3 IAM admin users do not have MFA enabled, violating access control requirements.',
    control: 'HIPAA §164.312(d)',
    status: 'open',
    remediation_steps: [
      'Go to IAM → Users and identify users without MFA',
      'Enforce MFA via IAM policy or AWS Organizations SCP',
      'Notify affected users to enroll their MFA device'
    ]
  },
  {
    id: 'f003',
    severity: 'high',
    title: 'CloudTrail Logging Disabled in us-west-2',
    description: 'AWS CloudTrail is not enabled in the us-west-2 region, creating an audit gap.',
    control: 'HIPAA §164.312(b)',
    status: 'in_progress',
    remediation_steps: [
      'Open CloudTrail in the AWS console',
      'Create a new trail covering all regions',
      'Enable log file validation and S3 delivery'
    ]
  }
];

const MOCK_HISTORY = [
  { date: '2026-04-01', score: 71, controls_passing: 36, high_findings: 7 },
  { date: '2026-04-08', score: 74, controls_passing: 38, high_findings: 6 },
  { date: '2026-04-15', score: 76, controls_passing: 39, high_findings: 5 },
  { date: '2026-04-22', score: 79, controls_passing: 40, high_findings: 5 },
  { date: '2026-04-29', score: 81, controls_passing: 41, high_findings: 4 },
  { date: '2026-05-06', score: 83, controls_passing: 42, high_findings: 4 },
  { date: '2026-05-13', score: 84, controls_passing: 42, high_findings: 4 },
];

const DEFAULT_FRAMEWORK = 'hipaa';
const SUPPORTED_FRAMEWORK_IDS = ['hipaa', 'soc2', 'pcidss'];

const MOCK_FRAMEWORKS = [
  { id: 'hipaa', name: 'HIPAA', description: 'Health Insurance Portability & Accountability Act', score: 84, controls_passing: 42, high_findings: 4, color: '#0f4c81', icon: '🏥' },
  { id: 'soc2', name: 'SOC 2', description: 'Service Organization Control 2', score: 76, controls_passing: 38, high_findings: 6, color: '#7c3aed', icon: '🔐' },
  { id: 'pcidss', name: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard', score: 91, controls_passing: 54, high_findings: 1, color: '#0d9488', icon: '💳' },
];

const MOCK_SOC2_FINDINGS = [
  { id: 's001', severity: 'high', title: 'Insufficient Access Review Process', description: 'Quarterly access reviews are not being conducted for privileged accounts.', control: 'SOC 2 CC6.2', status: 'open', remediation_steps: ['Define access review policy', 'Schedule quarterly reviews in calendar', 'Document review outcomes in audit log'] },
  { id: 's002', severity: 'high', title: 'Missing Incident Response Plan', description: 'No formal incident response plan exists or has been tested in the last 12 months.', control: 'SOC 2 CC7.3', status: 'open', remediation_steps: ['Draft incident response policy', 'Assign IRP owner', 'Conduct tabletop exercise'] },
  { id: 's003', severity: 'medium', title: 'Change Management Controls Not Documented', description: 'Software deployment process lacks formal change approval documentation.', control: 'SOC 2 CC8.1', status: 'in_progress', remediation_steps: ['Implement change request ticketing', 'Require approval sign-off before deploys'] },
];

const MOCK_PCIDSS_FINDINGS = [
  { id: 'p001', severity: 'critical', title: 'Cardholder Data Stored Unencrypted in Logs', description: 'Application logs contain truncated PANs that exceed PCI-DSS retention requirements.', control: 'PCI-DSS Req 3.4', status: 'open', remediation_steps: ['Audit all log outputs for PAN data', 'Implement log scrubbing middleware', 'Rotate and purge existing affected logs'] },
  { id: 'p002', severity: 'medium', title: 'Firewall Rule Review Overdue', description: 'Network firewall rules have not been reviewed in over 6 months.', control: 'PCI-DSS Req 1.3', status: 'in_progress', remediation_steps: ['Schedule firewall rule audit', 'Remove unused/overly permissive rules', 'Document approved ruleset'] },
];

const MOCK_SOC2_HISTORY = [
  { date: '2026-04-01', score: 68, controls_passing: 32, high_findings: 9 },
  { date: '2026-04-15', score: 71, controls_passing: 34, high_findings: 8 },
  { date: '2026-05-01', score: 74, controls_passing: 36, high_findings: 7 },
  { date: '2026-05-13', score: 76, controls_passing: 38, high_findings: 6 },
];

const MOCK_PCIDSS_HISTORY = [
  { date: '2026-04-01', score: 85, controls_passing: 50, high_findings: 3 },
  { date: '2026-04-15', score: 87, controls_passing: 51, high_findings: 2 },
  { date: '2026-05-01', score: 89, controls_passing: 53, high_findings: 2 },
  { date: '2026-05-13', score: 91, controls_passing: 54, high_findings: 1 },
];

const FRAMEWORK_STANDARD_REFERENCES = {
  hipaa: '45 CFR Parts 160 and 164',
  soc2: 'AICPA Trust Services Criteria',
  pcidss: 'PCI DSS v4.0',
};

const FRAMEWORK_FALLBACKS = {
  hipaa: {
    findings: MOCK_FINDINGS,
    history: MOCK_HISTORY,
  },
  soc2: {
    findings: MOCK_SOC2_FINDINGS,
    history: MOCK_SOC2_HISTORY,
  },
  pcidss: {
    findings: MOCK_PCIDSS_FINDINGS,
    history: MOCK_PCIDSS_HISTORY,
  },
};

const MOCK_ALERT = {
  id: 'alert001',
  type: 'critical',
  message: 'New critical finding detected: "Unencrypted PHI in S3 Bucket" (HIPAA §164.312)',
  timestamp: new Date().toISOString(),
  read: false,
};

const AUTO_REMEDIABLE = {
  'Unencrypted PHI in S3 Bucket': { type: 's3_encryption', label: 'Enable S3 Encryption' },
  'MFA Not Enforced for Admin Users': { type: 'iam_mfa', label: 'Enforce MFA via SCP' },
  'CloudTrail Logging Disabled in us-west-2': { type: 'cloudtrail_enable', label: 'Enable CloudTrail' },
  'Cardholder Data Stored Unencrypted in Logs': { type: 'log_scrub', label: 'Enable Log Scrubbing' },
  'Firewall Rule Review Overdue': { type: 'firewall_review', label: 'Initiate Rule Review' },
};

const REMEDIATION_DETAILS = {
  s3_encryption: {
    bullets: [
      'Enable SSE-KMS encryption on affected S3 bucket',
      'Apply bucket policy to deny unencrypted uploads',
    ],
    successLabel: 'S3 encryption enabled',
  },
  iam_mfa: {
    bullets: [
      'Enforce MFA for IAM admin principals via SCP update',
      'Flag non-compliant admin users for immediate enrollment',
    ],
    successLabel: 'MFA enforcement enabled',
  },
  cloudtrail_enable: {
    bullets: [
      'Enable multi-region CloudTrail trail for audit events',
      'Turn on log file validation and secure delivery to S3',
    ],
    successLabel: 'CloudTrail enabled',
  },
  log_scrub: {
    bullets: [
      'Enable log scrubbing pattern set for cardholder data fields',
      'Apply retention update to remove previously exposed records',
    ],
    successLabel: 'Log scrubbing enabled',
  },
  firewall_review: {
    bullets: [
      'Initiate firewall rule review workflow with approvers',
      'Queue stale rules for disable/remove recommendation',
    ],
    successLabel: 'Firewall review initiated',
  },
};

const MOCK_REMEDIATION_LOG = [
  { id: 'job001', type: 'cloudtrail_enable', label: 'CloudTrail enabled', framework: 'HIPAA', status: 'complete', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
];

function getMockSchedule() {
  const fallbackEmail = localStorage.getItem('userEmail') || 'user@example.com';
  return {
    cadence: 'weekly',
    next_run: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    email_notify: true,
    notify_email: fallbackEmail,
  };
}

function getStoredActiveFramework() {
  const framework = String(localStorage.getItem('active_framework') || DEFAULT_FRAMEWORK).toLowerCase();
  return SUPPORTED_FRAMEWORK_IDS.includes(framework) ? framework : DEFAULT_FRAMEWORK;
}

function normalizeFrameworkOverview(payload) {
  const source = Array.isArray(payload) ? payload : payload?.data || [];
  if (!Array.isArray(source) || source.length === 0) return MOCK_FRAMEWORKS;
  return source
    .map((framework) => {
      const id = String(framework.id || '').toLowerCase();
      const fallback = MOCK_FRAMEWORKS.find((item) => item.id === id);
      if (!fallback) return null;
      return {
        ...fallback,
        name: framework.name || fallback.name,
        score: toNumber(framework.score, fallback.score),
        controls_passing: toNumber(framework.controls_passing ?? framework.controlsPassing, fallback.controls_passing),
        high_findings: toNumber(framework.high_findings ?? framework.highFindings, fallback.high_findings),
      };
    })
    .filter(Boolean);
}

function getFrameworkMeta(frameworkId, frameworks = MOCK_FRAMEWORKS) {
  return frameworks.find((framework) => framework.id === frameworkId)
    || MOCK_FRAMEWORKS[0]
    || { id: DEFAULT_FRAMEWORK, name: 'HIPAA', description: '', score: 0, controls_passing: 0, high_findings: 0, color: '#0f4c81', icon: '🏥' };
}

function buildFrameworkComplianceFallback(frameworkId, frameworks = MOCK_FRAMEWORKS) {
  const framework = getFrameworkMeta(frameworkId, frameworks);
  return normalizeCompliancePayload({
    overallScore: framework.score,
    controlsPassing: framework.controls_passing,
    highFindings: framework.high_findings,
    findings: FRAMEWORK_FALLBACKS[frameworkId]?.findings || MOCK_FINDINGS,
    lastAssessmentDate: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function ScoreBadge({ score }) {
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 12px',
        borderRadius: '999px',
        background: color + '20',
        color,
        fontWeight: 700,
        fontSize: '0.9rem'
      }}
    >
      {score}%
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    passing: { bg: '#d1fae5', color: '#065f46', label: 'Passing' },
    warning: { bg: '#fef3c7', color: '#92400e', label: 'Warning' },
    failing: { bg: '#fee2e2', color: '#991b1b', label: 'Failing' },
    active: { bg: '#d1fae5', color: '#065f46', label: 'Active' },
    pending_renewal: { bg: '#fef3c7', color: '#92400e', label: 'Pending Renewal' },
    completed: { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
    open: { bg: '#fee2e2', color: '#991b1b', label: 'Open' },
    in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
    authorized: { bg: '#d1fae5', color: '#065f46', label: 'Authorized' },
    denied: { bg: '#fee2e2', color: '#991b1b', label: 'Denied' }
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#374151', label: status };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 999, background: s.bg, color: s.color, fontWeight: 600, fontSize: '0.78rem' }}>
      {s.label}
    </span>
  );
}

function ProgressBar({ value, color = '#10b981' }) {
  return (
    <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(iso) {
  if (!iso) return 'Unknown';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'Unknown';
  const diffMinutes = Math.floor((Date.now() - then) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function readPendingAlerts() {
  try {
    const raw = localStorage.getItem('pending_alerts');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistPendingAlerts(alerts) {
  localStorage.setItem('pending_alerts', JSON.stringify(alerts));
}

function readRemediationLog() {
  try {
    const raw = localStorage.getItem('remediation_log');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem('remediation_log', JSON.stringify(MOCK_REMEDIATION_LOG));
      return MOCK_REMEDIATION_LOG;
    }
    return parsed;
  } catch {
    localStorage.setItem('remediation_log', JSON.stringify(MOCK_REMEDIATION_LOG));
    return MOCK_REMEDIATION_LOG;
  }
}

function alertBannerIcon(type) {
  if (type === 'critical') return '🚨';
  if (type === 'high') return '⚠️';
  return '📉';
}

function hasConfiguredAlertSettings() {
  try {
    const raw = localStorage.getItem('alert_settings');
    if (!raw) return false;
    const settings = JSON.parse(raw);
    const hasSlack = Boolean(String(settings?.slack_webhook || '').trim());
    const hasEmail = Boolean(settings?.email_notify && String(settings?.notify_email || '').trim());
    return hasSlack || hasEmail;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TABS = ['overview', 'safeguards', 'phi', 'findings', 'evidence'];
const TAB_LABELS = {
  overview: '📋 Overview',
  safeguards: '🛡️ Safeguards',
  phi: '🔒 PHI Controls',
  findings: '⚠️ Findings',
  evidence: '📄 Evidence Export'
};

export default function HIPAADashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const findingsRef = useRef(null);
  const [findings, setFindings] = useState([]);
  const [history, setHistory] = useState(MOCK_HISTORY);
  const [schedule, setSchedule] = useState(getMockSchedule());
  const [frameworks, setFrameworks] = useState(MOCK_FRAMEWORKS);
  const [activeFramework, setActiveFramework] = useState(getStoredActiveFramework());
  const [teamMembers, setTeamMembers] = useState(MOCK_USERS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [statusToastId, setStatusToastId] = useState('');
  const [assignmentToast, setAssignmentToast] = useState({ id: '', message: '' });
  const [scheduleSavedToast, setScheduleSavedToast] = useState(false);
  const [jumpToFindingsOnLoad, setJumpToFindingsOnLoad] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const currentUserEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
  const effectiveTier = (localStorage.getItem('customerTier') || 'healthcare').toLowerCase();
  const isHealthcareTier = effectiveTier === 'healthcare';
  const currentUser = teamMembers.find((user) => String(user.email || '').toLowerCase() === currentUserEmail);
  const currentUserRole = currentUser?.role || 'admin';
  const activeFrameworkMeta = getFrameworkMeta(activeFramework, frameworks);
  const frameworkName = activeFrameworkMeta.name;
  const frameworkIcon = activeFrameworkMeta.icon;

  const handleLogout = async () => {
    await logoutDemo();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'https://securebase.tximhotep.com/pricing';
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSafeguard, setActiveSafeguard] = useState('administrative');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      try {
        const frameworksRes = await fetch('/api/frameworks', { headers });
        if (!frameworksRes.ok) throw new Error(`frameworks_fetch_failed:${frameworksRes.status}`);
        const frameworksData = await frameworksRes.json();
        const normalizedFrameworks = normalizeFrameworkOverview(frameworksData);
        setFrameworks(normalizedFrameworks.length > 0 ? normalizedFrameworks : MOCK_FRAMEWORKS);
      } catch (frameworksError) {
        console.error('Framework overview fetch failed, using fallback frameworks.', frameworksError);
        setFrameworks(MOCK_FRAMEWORKS);
      }

      let compliancePayload;
      try {
        const complianceRes = await fetch(`/api/${activeFramework}/compliance`, { headers });
        if (!complianceRes.ok) throw new Error(`framework_compliance_fetch_failed:${complianceRes.status}`);
        const complianceData = await complianceRes.json();
        compliancePayload = normalizeCompliancePayload(complianceData?.data || complianceData);
      } catch (_) {
        if (activeFramework === 'hipaa') {
          compliancePayload = normalizeCompliancePayload(await sreService.getHIPAACompliance());
        } else {
          compliancePayload = buildFrameworkComplianceFallback(activeFramework);
        }
      }

      setData(compliancePayload);

      if (!isHealthcareTier) {
        setFindings(compliancePayload?.findings || []);
        return;
      }

      try {
        const findingsRes = await fetch(`/api/${activeFramework}/findings`, { headers });
        if (!findingsRes.ok) throw new Error(`framework_findings_fetch_failed:${findingsRes.status}`);
        const findingsData = await findingsRes.json();
        const normalizedFindings = normalizeFindings(findingsData);
        const fallbackFindings = FRAMEWORK_FALLBACKS[activeFramework]?.findings || MOCK_FINDINGS;
        setFindings(normalizedFindings.length > 0 ? normalizedFindings : fallbackFindings);
      } catch (error) {
        console.error('Framework findings fetch failed, using fallback findings.', error);
        const fallbackFindings = normalizeFindings(compliancePayload?.findings || []);
        const frameworkFallbackFindings = FRAMEWORK_FALLBACKS[activeFramework]?.findings || MOCK_FINDINGS;
        setFindings(fallbackFindings.length > 0 ? fallbackFindings : frameworkFallbackFindings);
      }

      try {
        const usersRes = await fetch('/api/users', { headers });
        if (!usersRes.ok) {
          const usersError = new Error(`users_fetch_failed:${usersRes.status}`);
          usersError.status = usersRes.status;
          throw usersError;
        }
        const usersData = await usersRes.json();
        const normalizedUsers = normalizeUsers(usersData);
        setTeamMembers(normalizedUsers.length > 0 ? normalizedUsers : MOCK_USERS);
      } catch (usersError) {
        if ([404, 500].includes(usersError?.status)) {
          setTeamMembers(MOCK_USERS);
        } else {
          console.error('Users fetch failed, using fallback users.', usersError);
          setTeamMembers(MOCK_USERS);
        }
      }

      try {
        const historyRes = await fetch(`/api/${activeFramework}/compliance/history`, { headers });
        if (!historyRes.ok) throw new Error(`framework_history_fetch_failed:${historyRes.status}`);
        const historyData = await historyRes.json();
        const normalizedHistory = normalizeHistory(historyData);
        const frameworkFallbackHistory = FRAMEWORK_FALLBACKS[activeFramework]?.history || MOCK_HISTORY;
        setHistory(normalizedHistory.length > 0 ? normalizedHistory : frameworkFallbackHistory);
      } catch (historyError) {
        console.error('Framework compliance history fetch failed, using fallback history.', historyError);
        setHistory(FRAMEWORK_FALLBACKS[activeFramework]?.history || MOCK_HISTORY);
      }

      try {
        const scheduleRes = await fetch(`/api/${activeFramework}/schedule`, { headers });
        if (!scheduleRes.ok) throw new Error(`framework_schedule_fetch_failed:${scheduleRes.status}`);
        const scheduleData = await scheduleRes.json();
        setSchedule(normalizeSchedule(scheduleData));
      } catch (scheduleError) {
        console.error('Framework schedule fetch failed, using fallback schedule.', scheduleError);
        const persistedSchedule = readScheduleFromLocalStorage(activeFramework);
        setSchedule(normalizeSchedule(persistedSchedule || getMockSchedule()));
      }
    } catch (err) {
      console.error('Failed to load compliance data:', err);
      setError('Failed to load compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeFramework, isHealthcareTier]);

  useEffect(() => {
    trackPageView('HIPAA Dashboard', '/hipaa-dashboard');
    trackHIPAARoute('/hipaa-dashboard', 'view');
    loadData();
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem('active_framework', activeFramework);
    setActiveFilter('all');
  }, [activeFramework]);

  useEffect(() => {
    if (!isHealthcareTier) return;
    const shouldJumpToFindings = localStorage.getItem('hipaa_jump_to_findings') === 'true';
    if (shouldJumpToFindings) {
      localStorage.removeItem('hipaa_jump_to_findings');
      setActiveFramework(DEFAULT_FRAMEWORK);
      setJumpToFindingsOnLoad(true);
      setActiveFilter('critical');
      setActiveTab('findings');
    }
  }, [isHealthcareTier]);

  useEffect(() => {
    if (!jumpToFindingsOnLoad || activeTab !== 'findings') return;
    const timer = setTimeout(() => {
      findingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setJumpToFindingsOnLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, jumpToFindingsOnLoad]);

  useEffect(() => {
    const existing = readPendingAlerts();
    if (existing.length === 0 && localStorage.getItem('pending_alerts_seeded') !== 'true') {
      persistPendingAlerts([MOCK_ALERT]);
      localStorage.setItem('pending_alerts_seeded', 'true');
      setPendingAlerts([MOCK_ALERT]);
      return;
    }
    setPendingAlerts(existing.filter((alert) => !alert.read));
  }, []);

  const dismissPendingAlert = (alertId) => {
    const remaining = readPendingAlerts().filter((alert) => alert.id !== alertId);
    persistPendingAlerts(remaining);
    setPendingAlerts(remaining.filter((alert) => !alert.read));
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackHIPAARoute(`/hipaa-dashboard#${tab}`, 'tab_change');
  };

  const handleExport = () => {
    setExporting(true);
    trackHIPAARoute('/hipaa-dashboard', 'evidence_export');

    setTimeout(() => {
      const report = generateAuditorReport(data, activeFrameworkMeta);
      const blob = new Blob([report], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(activeFrameworkMeta.name || 'HIPAA').replace(/\s+/g, '-')}-Compliance-Report-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExporting(false);
    }, EXPORT_GENERATION_DELAY_MS);
  };

  const handleDownloadEvidence = () => {
    const orgName = localStorage.getItem('orgName') || 'Organization';
    const date = new Date().toISOString().split('T')[0];
    const content = generateEvidenceReport(orgName, date, findings, data?.overallScore ?? 0, activeFrameworkMeta);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orgName}-${activeFrameworkMeta.id.toUpperCase()}-Evidence-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStatusUpdate = async (id, status) => {
    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    setFindings((previousFindings) => previousFindings.map((finding) => (finding.id === id ? { ...finding, status } : finding)));
    setStatusToastId(id);
    window.setTimeout(() => setStatusToastId(''), 2000);

    try {
      await fetch(`/api/${activeFramework}/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error('Failed to update finding status in API; retaining optimistic UI state.', error);
      // Optimistic update is intentionally retained even when the PATCH request fails.
    }
  };

  const handleAssignFinding = async (id, assignedTo) => {
    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const assignedUser = teamMembers.find((user) => user.id === assignedTo);
    const assignedLabel = assignedUser?.name || 'Unassigned';

    setFindings((previousFindings) => previousFindings.map((finding) => (
      finding.id === id ? { ...finding, assigned_to: assignedTo || null } : finding
    )));
    setAssignmentToast({ id, message: `✓ Assigned to ${assignedLabel}` });
    window.setTimeout(() => setAssignmentToast({ id: '', message: '' }), 2000);

    try {
      await fetch(`/api/${activeFramework}/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      });
    } catch (error) {
      console.error('Failed to assign finding in API; retaining optimistic UI state.', error);
    }
  };

  const handleSaveSchedule = async ({ cadence, email_notify, notify_email }) => {
    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    const payload = { cadence, email_notify, notify_email };

    try {
      const res = await fetch(`/api/${activeFramework}/schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`framework schedule save failed: ${res.status}`);
    } catch (scheduleSaveError) {
      console.error('Failed to save schedule to API; saving fallback to localStorage.', scheduleSaveError);
      localStorage.setItem(`${activeFramework}_schedule`, JSON.stringify(payload));
    }

    setSchedule({
      ...payload,
      next_run: calculateNextRunIso(cadence),
    });
    setScheduleSavedToast(true);
    window.setTimeout(() => setScheduleSavedToast(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{frameworkIcon}</div>
          <p style={{ color: '#6b7280' }}>Loading {frameworkName} compliance data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: '#dc2626', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={loadData} style={btnPrimary}>Retry</button>
        <button onClick={() => navigate('/dashboard')} style={{ ...btnSecondary, marginLeft: 12 }}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${activeFrameworkMeta.color} 0%, #1a73e8 100%)`, color: '#fff', padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 8, fontSize: '0.85rem' }}
              >
                ← Dashboard
              </button>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>{frameworkIcon} {frameworkName} Compliance Dashboard</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 8px', fontSize: '0.75rem', marginRight: 8, fontWeight: 600 }}>Now viewing: Healthcare Tier</span>
                HealthCorp Medical Systems · Last assessment: {formatDate(data.lastAssessmentDate)}
              </p>
            </div>
            <div className="framework-switcher">
              {frameworks.map((framework) => {
                const isActive = framework.id === activeFramework;
                return (
                  <button
                    key={framework.id}
                    className={`framework-tab ${isActive ? 'active' : ''}`}
                    style={isActive ? { background: framework.color } : undefined}
                    onClick={() => setActiveFramework(framework.id)}
                    type="button"
                  >
                    <span>{framework.icon}</span>
                    <span>{framework.name}</span>
                    <span className="framework-score-badge">{framework.score}%</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {isHealthcareTier && (
                <button
                  onClick={() => navigate('/team')}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 8,
                    padding: '0.6rem 1.1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  👥 Team
                </button>
              )}
              {isHealthcareTier && (
                <button
                  onClick={() => navigate('/alerts')}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 8,
                    padding: '0.6rem 1.1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  Alerts 🔔
                  {!hasConfiguredAlertSettings() && <span className="alerts-unconfigured-dot" aria-label="Alerts not configured" />}
                </button>
              )}
              {isHealthcareTier && (
                <button
                  onClick={handleDownloadEvidence}
                  style={{
                    background: '#fff',
                    color: '#0f4c81',
                    border: '2px solid #0f4c81',
                    borderRadius: 8,
                    padding: '0.6rem 1.2rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Download Evidence Package
                </button>
              )}
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.75rem 1.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{data.overallScore}%</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>Overall Score</div>
              </div>
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.75rem 1.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'capitalize', lineHeight: 1 }}>{data.riskLevel}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>Risk Level</div>
              </div>
              <button
                onClick={handleLogout}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px 8px 0 0',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  background: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: activeTab === tab ? '#0f4c81' : '#fff',
                  transition: 'background 0.15s'
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        {pendingAlerts.map((alert) => (
          <div key={alert.id} className={`alert-banner ${alert.type}`}>
            <span>{alertBannerIcon(alert.type)} {alert.message}</span>
            <button
              type="button"
              onClick={() => dismissPendingAlert(alert.id)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: '1rem', cursor: 'pointer' }}
              aria-label={`Dismiss alert ${alert.id}`}
            >
              ✕
            </button>
          </div>
        ))}
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'safeguards' && <SafeguardsTab data={data} activeSafeguard={activeSafeguard} setActiveSafeguard={setActiveSafeguard} />}
        {activeTab === 'phi' && <PHITab data={data} />}
        {activeTab === 'findings' && (
          <FindingsTab
            data={data}
            findings={findings}
            history={history}
            schedule={schedule}
            frameworkMeta={activeFrameworkMeta}
            findingsRef={findingsRef}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onStatusUpdate={handleStatusUpdate}
            onAssignFinding={handleAssignFinding}
            onSaveSchedule={handleSaveSchedule}
            statusToastId={statusToastId}
            assignmentToast={assignmentToast}
            scheduleSavedToast={scheduleSavedToast}
            isHealthcareTier={isHealthcareTier}
            activeFramework={activeFramework}
            teamMembers={teamMembers}
            currentUserEmail={currentUserEmail}
            currentUserRole={currentUserRole}
          />
        )}
        {activeTab === 'evidence' && <EvidenceTab data={data} onExport={handleExport} exporting={exporting} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({ data }) {
  const { safeguards, baaCompliance, training, riskAssessment } = data;

  const safeguardCards = [
    { key: 'administrative', label: 'Administrative', icon: '📋', color: '#4f46e5' },
    { key: 'physical', label: 'Physical', icon: '🏢', color: '#0891b2' },
    { key: 'technical', label: 'Technical', icon: '⚙️', color: '#7c3aed' }
  ];

  // Count open BAA renewals
  const pendingBaa = (baaCompliance.vendors || []).filter(v => v.status === 'pending_renewal').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Score cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {safeguardCards.map(card => {
          const sg = safeguards[card.key];
          return (
            <div key={card.key} style={{ ...cardStyle, borderTop: `4px solid ${card.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>{card.icon}</span>
                <ScoreBadge score={Math.round(sg.percentage)} />
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#111827' }}>{card.label} Safeguards</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>{sg.passed}/{sg.total} controls passing</p>
              <div style={{ marginTop: 10 }}>
                <ProgressBar value={sg.percentage} color={card.color} />
              </div>
            </div>
          );
        })}
        <div style={{ ...cardStyle, borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '1.5rem' }}>📝</span>
            {pendingBaa > 0
              ? <StatusPill status="pending_renewal" />
              : <StatusPill status="active" />}
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#111827' }}>BAA Status</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
            {baaCompliance.vendors.length} vendors · {pendingBaa > 0 ? `${pendingBaa} renewal pending` : 'All active'}
          </p>
        </div>
        <div style={{ ...cardStyle, borderTop: `4px solid ${training.completionRate >= 90 ? '#10b981' : '#f59e0b'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '1.5rem' }}>🎓</span>
            <ScoreBadge score={training.completionRate} />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#111827' }}>Training Completion</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>{training.completedStaff}/{training.totalStaff} staff · {training.overdueStaff} overdue</p>
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={training.completionRate} color={training.completionRate >= 90 ? '#10b981' : '#f59e0b'} />
          </div>
        </div>
      </div>

      {/* Risk assessment + BAA summary side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        {/* Risk Assessment */}
        <div style={cardStyle}>
          <h2 style={sectionHead}>Risk Assessment</h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={infoBox}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Status</div>
              <StatusPill status={riskAssessment.status} />
            </div>
            <div style={infoBox}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Completed</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(riskAssessment.completedDate)}</div>
            </div>
            <div style={infoBox}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Next Scheduled</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(riskAssessment.nextScheduled)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ ...infoBox, flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Open Risks</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>{riskAssessment.openRisks}</div>
            </div>
            <div style={{ ...infoBox, flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Mitigated</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{riskAssessment.mitigatedRisks}</div>
            </div>
          </div>
        </div>

        {/* BAA Summary */}
        <div style={cardStyle}>
          <h2 style={sectionHead}>Business Associate Agreements</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {baaCompliance.vendors.map(v => (
              <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: '#f9fafb', borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{v.name}</span>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                    Expires: {formatDate(v.expiresDate)}
                  </div>
                </div>
                <StatusPill status={v.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Training modules */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>Security Awareness Training</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {training.modules.map(m => (
            <div key={m.name} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{m.name}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: m.completion >= 90 ? '#10b981' : '#f59e0b' }}>{m.completion}%</span>
              </div>
              <ProgressBar value={m.completion} color={m.completion >= 90 ? '#10b981' : '#f59e0b'} />
            </div>
          ))}
        </div>
        <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
          Next training deadline: <strong>{formatDate(training.nextDeadline)}</strong> · {training.overdueStaff} staff overdue
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Safeguards
// ---------------------------------------------------------------------------

function SafeguardsTab({ data, activeSafeguard, setActiveSafeguard }) {
  const { safeguards } = data;

  const categories = [
    { key: 'administrative', label: 'Administrative (§164.308)', icon: '📋', color: '#4f46e5' },
    { key: 'physical', label: 'Physical (§164.310)', icon: '🏢', color: '#0891b2' },
    { key: 'technical', label: 'Technical (§164.312)', icon: '⚙️', color: '#7c3aed' }
  ];

  const sg = safeguards[activeSafeguard];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Category selector */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveSafeguard(cat.key)}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: 8,
              border: `2px solid ${activeSafeguard === cat.key ? cat.color : '#e5e7eb'}`,
              background: activeSafeguard === cat.key ? cat.color + '15' : '#fff',
              color: activeSafeguard === cat.key ? cat.color : '#374151',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <ScoreBadge score={Math.round(sg.percentage)} />
          <div>
            <span style={{ fontWeight: 700, color: '#111827' }}>{sg.passed}</span>
            <span style={{ color: '#6b7280' }}> / {sg.total} controls passing</span>
          </div>
        </div>
        <ProgressBar value={sg.percentage} color={sg.percentage >= 90 ? '#10b981' : sg.percentage >= 75 ? '#f59e0b' : '#ef4444'} />
      </div>

      {/* Control list */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>Controls</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(sg.controls || []).map(ctrl => (
            <div key={ctrl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: 8, gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#6b7280', marginRight: 8 }}>{ctrl.id}</span>
                <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{ctrl.name}</span>
              </div>
              <StatusPill status={ctrl.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: PHI Controls
// ---------------------------------------------------------------------------

function PHITab({ data }) {
  const { phiEncryption, phiLocations, phiAccessLog } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Encryption status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Encryption at Rest', ok: phiEncryption.atRest, icon: '💾' },
          { label: 'Encryption in Transit', ok: phiEncryption.inTransit, icon: '🔐' },
          { label: 'KMS Key Verified', ok: phiEncryption.verified, icon: '🔑' },
          { label: 'Access Logging', ok: data.phi.accessLogging, icon: '📝' },
          { label: 'Audit Trail', ok: data.phi.auditTrail, icon: '🔍' }
        ].map(item => (
          <div key={item.label} style={{ ...cardStyle, textAlign: 'center', borderTop: `4px solid ${item.ok ? '#10b981' : '#ef4444'}` }}>
            <div style={{ fontSize: '2rem', marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: item.ok ? '#10b981' : '#ef4444' }}>
              {item.ok ? '✓ Enabled' : '✗ Disabled'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* PHI data locations */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>PHI Data Locations</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {phiLocations.map(loc => (
            <div key={loc.service} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#111827' }}>{loc.service}</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{loc.region}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>{loc.kmsKeyId}</span>
              <StatusPill status={loc.encrypted ? 'passing' : 'failing'} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent PHI access events */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>Recent PHI Access Log</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
          Last 7 days · All accesses logged per §164.312(b) Audit Controls
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Timestamp', 'User', 'Action', 'Resource', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(phiAccessLog || []).map((evt, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.78rem' }}>{formatDateTime(evt.timestamp)}</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500, color: '#374151' }}>{evt.user}</td>
                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize', color: '#374151' }}>{evt.action}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#374151' }}>{evt.resource}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}><StatusPill status={evt.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Findings
// ---------------------------------------------------------------------------

function FindingsTab({
  data,
  findings,
  history,
  schedule,
  frameworkMeta,
  findingsRef,
  activeFilter,
  setActiveFilter,
  onStatusUpdate,
  onAssignFinding,
  onSaveSchedule,
  statusToastId,
  assignmentToast,
  scheduleSavedToast,
  isHealthcareTier,
  activeFramework,
  teamMembers,
  currentUserEmail,
  currentUserRole,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [remediationStates, setRemediationStates] = useState({});
  const [remediationLog, setRemediationLog] = useState(readRemediationLog());
  const findingsListRef = useRef(null);
  const currentUserId = teamMembers.find((user) => String(user.email || '').toLowerCase() === currentUserEmail)?.id;
  const counts = getFilterCounts(findings, currentUserId);
  const filteredFindings = filterFindings(findings, activeFilter, currentUserId);
  const openFindings = findings.filter((finding) => finding.status !== 'resolved');
  const ownershipRows = teamMembers.map((member) => ({
    user: member,
    findingCount: openFindings.filter((finding) => finding.assigned_to === member.id).length,
  }));
  const unassignedFindingsCount = openFindings.filter((finding) => !finding.assigned_to).length;
  const showOwnershipWidget = ['admin', 'analyst'].includes(String(currentUserRole || '').toLowerCase());

  useEffect(() => {
    localStorage.setItem('remediation_log', JSON.stringify(remediationLog.slice(0, 10)));
  }, [remediationLog]);

  const upsertRemediationLogEntry = (entry) => {
    setRemediationLog((previous) => {
      const next = [entry, ...previous.filter((item) => item.id !== entry.id)];
      return next.slice(0, 10);
    });
  };

  const handleAutoRemediationConfirm = async (finding) => {
    const remediationMeta = AUTO_REMEDIABLE[finding.title];
    if (!remediationMeta) return;

    setRemediationStates((prev) => ({
      ...prev,
      [finding.id]: { phase: 'running', progress: 0, type: remediationMeta.type, label: remediationMeta.label },
    }));

    let jobId = `job_${Date.now()}`;
    try {
      const response = await fetch(`/api/remediation/${encodeURIComponent(activeFramework)}/findings/${encodeURIComponent(finding.id)}/autofix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken')
            ? { Authorization: `Bearer ${sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken')}` }
            : {}),
        },
      });
      if (response.ok) {
        const payload = await response.json();
        jobId = payload?.job_id || jobId;
      } else {
        throw new Error(`remediation_failed:${response.status}`);
      }
    } catch {
      setRemediationStates((prev) => {
        const { [finding.id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    const frameworkLabel = String(frameworkMeta?.name || activeFramework || 'HIPAA').toUpperCase();
    upsertRemediationLogEntry({
      id: jobId,
      type: remediationMeta.type,
      label: `${REMEDIATION_DETAILS[remediationMeta.type]?.successLabel || remediationMeta.label} queued`,
      framework: frameworkLabel,
      status: 'running',
      timestamp: new Date().toISOString(),
    });

    window.setTimeout(() => {
      setRemediationStates((prev) => ({
        ...prev,
        [finding.id]: {
          phase: 'running',
          progress: 100,
          type: remediationMeta.type,
          label: remediationMeta.label,
          jobId,
        },
      }));
    }, 30);

    window.setTimeout(() => {
      onStatusUpdate(finding.id, 'resolved');
      setRemediationStates((prev) => ({
        ...prev,
        [finding.id]: {
          phase: 'success',
          progress: 100,
          type: remediationMeta.type,
          label: remediationMeta.label,
          jobId,
        },
      }));

      upsertRemediationLogEntry({
        id: jobId,
        type: remediationMeta.type,
        label: REMEDIATION_DETAILS[remediationMeta.type]?.successLabel || remediationMeta.label,
        framework: frameworkLabel,
        status: 'complete',
        timestamp: new Date().toISOString(),
      });

      window.setTimeout(() => {
        setRemediationStates((prev) => {
          const { [finding.id]: _, ...rest } = prev;
          return rest;
        });
      }, 5000);
    }, 3000);
  };

  if (!isHealthcareTier) {
    return (
      <div style={cardStyle}>
        <h2 style={sectionHead}>Findings</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Compliance findings workflow is available for healthcare tier customers.
        </p>
      </div>
    );
  }

  return (
    <div ref={findingsRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={cardStyle}>
          <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 4 }}>Overall Score</div>
          <div style={{ color: '#0f4c81', fontSize: '1.8rem', fontWeight: 800 }}>{data?.overallScore ?? 0}%</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 4 }}>Controls Passing</div>
          <div style={{ color: '#166534', fontSize: '1.8rem', fontWeight: 800 }}>{toNumber(data?.controlsPassing, 0)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 4 }}>High Findings</div>
          <div style={{ color: '#b45309', fontSize: '1.8rem', fontWeight: 800 }}>{toNumber(data?.highFindings, 0)}</div>
        </div>
        {showOwnershipWidget && (
          <div className="ownership-widget">
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.4rem' }}>👥 Remediation Ownership</div>
            {ownershipRows.map(({ user, findingCount }) => (
              <div key={user.id} className="ownership-row">
                <span className="avatar-circle avatar-mini" style={{ background: getAvatarColor(user.name || user.email) }}>
                  {user.avatar_initials || getInitials(user.name || user.email)}
                </span>
                <span style={{ color: '#374151' }}>{findingCount} finding{findingCount === 1 ? '' : 's'}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setActiveFilter('all');
                findingsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="view-all-btn"
              style={{ marginTop: '0.4rem' }}
            >
              {unassignedFindingsCount} unassigned → Assign
            </button>
          </div>
        )}
      </div>

      <ComplianceReport
        history={history}
        findings={findings}
        score={toNumber(data?.overallScore, 0)}
        frameworkMeta={frameworkMeta}
      />

      <div ref={findingsListRef} className="findings-filter-bar">
        {FINDING_FILTERS.map((filter) => (
          <button
            key={filter}
            className={`filter-pill ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filterLabel(filter)} ({counts[filter] ?? 0})
          </button>
        ))}
      </div>

      {filteredFindings.map((finding) => {
        const isExpanded = expandedId === finding.id;
        const assignedUser = teamMembers.find((member) => member.id === finding.assigned_to);
        const autoRemediation = AUTO_REMEDIABLE[finding.title];
        const remediationState = remediationStates[finding.id];
        const canAutoRemediate = Boolean(autoRemediation) && finding.status !== 'resolved';
        const remediationDescription = autoRemediation ? REMEDIATION_DETAILS[autoRemediation.type] : null;
        return (
          <div key={finding.id} className="finding-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={severityBadgeStyle(finding.severity)}>{finding.severity}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>{finding.control}</span>
              </div>
              <span style={statusBadgeStyle(finding.status)}>{statusLabel(finding.status)}</span>
            </div>

            <h3 style={{ margin: '0.75rem 0 0.35rem', fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{finding.title}</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{finding.description}</p>

            <div className="assign-dropdown">
              <span>Assigned to:</span>
              <select
                aria-label={`Assign owner for ${finding.title}`}
                className="assign-select"
                value={finding.assigned_to || ''}
                onChange={(event) => onAssignFinding(finding.id, event.target.value)}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((user) => (
                  <option key={user.id} value={user.id}>
                    [{user.avatar_initials || getInitials(user.name || user.email)}] {user.name}
                  </option>
                ))}
              </select>
              {finding.assigned_to && (
                <span style={{ color: '#374151', fontSize: '0.78rem' }}>
                  {assignedUser ? `${assignedUser.avatar_initials || getInitials(assignedUser.name || assignedUser.email)} ${assignedUser.name}` : 'Unassigned'}
                </span>
              )}
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {finding.status === 'open' && (
                <button onClick={() => onStatusUpdate(finding.id, 'in_progress')} style={inlineActionButtonStyle}>
                  Mark In Progress
                </button>
              )}
              {(finding.status === 'open' || finding.status === 'in_progress') && (
                <button onClick={() => onStatusUpdate(finding.id, 'resolved')} style={inlineActionButtonStyle}>
                  Mark Resolved
                </button>
              )}
              {statusToastId === finding.id && <span className="status-toast">✓ Status updated</span>}
              {assignmentToast.id === finding.id && <span className="status-toast">{assignmentToast.message}</span>}
            </div>

            {canAutoRemediate && !remediationState?.phase && (
              <button
                type="button"
                className="auto-remediate-btn"
                style={{ marginTop: '0.7rem' }}
                onClick={() => {
                  setRemediationStates((prev) => ({
                    ...prev,
                    [finding.id]: { phase: 'confirm', progress: 0, type: autoRemediation.type, label: autoRemediation.label },
                  }));
                }}
              >
                ⚡ Auto-Remediate
              </button>
            )}

            {remediationState?.phase === 'confirm' && remediationDescription && (
              <div className="remediation-confirm-panel">
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#111827' }}>⚡ Auto-Remediate: {autoRemediation.label}</div>
                <div style={{ color: '#374151', marginBottom: '0.5rem' }}>
                  This will apply the following change to your AWS account:
                </div>
                <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem', color: '#374151' }}>
                  {remediationDescription.bullets.map((bullet) => (
                    <li key={`${finding.id}-${bullet}`}>{bullet}</li>
                  ))}
                </ul>
                <div style={{ color: '#92400e', marginBottom: '0.6rem', fontWeight: 600 }}>⚠ This action cannot be undone automatically.</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="auto-remediate-btn" onClick={() => handleAutoRemediationConfirm(finding)}>
                    Confirm &amp; Apply
                  </button>
                  <button
                    type="button"
                    style={inlineActionButtonStyle}
                    onClick={() => {
                      setRemediationStates((prev) => {
                        const { [finding.id]: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {remediationState?.phase === 'running' && (
              <div style={{ marginTop: '0.7rem' }}>
                <div style={{ color: '#0f4c81', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚡ Remediation in progress... [{Math.round(remediationState.progress)}%]
                </div>
                <div className="remediation-progress-bar">
                  <div className="remediation-progress-fill" style={{ width: `${remediationState.progress}%` }} />
                </div>
              </div>
            )}

            {remediationState?.phase === 'success' && (
              <div className="remediation-success" style={{ marginTop: '0.75rem' }}>
                ✅ Remediation complete — {REMEDIATION_DETAILS[remediationState.type]?.successLabel || remediationState.label}
                <div style={{ marginTop: '0.2rem', fontWeight: 500 }}>Finding marked as resolved.</div>
              </div>
            )}

            <button
              onClick={() => setExpandedId(isExpanded ? null : finding.id)}
              style={{ marginTop: '0.8rem', background: 'none', border: 'none', color: '#0f4c81', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', padding: 0 }}
            >
              {isExpanded ? '▼ Hide Remediation Steps' : '▶ View Remediation Steps'}
            </button>

            <div className={`remediation-steps ${isExpanded ? 'expanded' : ''}`}>
              <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', color: '#374151', fontSize: '0.85rem', lineHeight: 1.7 }}>
                {(finding.remediation_steps || []).map((step, index) => (
                  <li key={`${finding.id}-step-${index}`}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        );
      })}

      {filteredFindings.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
          No findings match this filter.
        </div>
      )}

      <AssessmentScheduler
        schedule={schedule}
        onSave={onSaveSchedule}
        showSaveToast={scheduleSavedToast}
      />

      <section className="activity-log">
        <div className="activity-log-header">⚡ Remediation Activity</div>
        {remediationLog.slice(0, 10).map((entry) => (
          <div key={entry.id} className="activity-log-row">
            <span>{entry.status === 'complete' ? '✅' : entry.status === 'failed' ? '❌' : '⏳'}</span>
            <span style={{ flex: 1, color: '#374151' }}>{entry.label}</span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>{entry.framework}</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatRelativeTime(entry.timestamp)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sprint 3: Compliance report + schedule
// ---------------------------------------------------------------------------

function ComplianceReport({ history, findings, score, frameworkMeta }) {
  const [tooltip, setTooltip] = useState(null);
  const orgName = localStorage.getItem('orgName') || 'Organization';
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const points = Array.isArray(history) && history.length > 0 ? history : MOCK_HISTORY;
  const chart = buildTrendChart(points);
  const trend = getTrendSummary(points);

  const handleDownloadReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;
    reportWindow.document.write(generateComplianceReportHTML(orgName, now, points, findings, score, frameworkMeta));
    reportWindow.document.close();
    reportWindow.print();
  };

  return (
    <section className="trend-chart-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
        <h2 style={{ ...sectionHead, margin: 0 }}>{frameworkMeta?.name || 'HIPAA'} Compliance Report</h2>
        <button style={btnPrimary} onClick={handleDownloadReport}>Download Compliance Report (PDF)</button>
      </div>

      <div style={{ position: 'relative' }}>
        <svg width="100%" height="180" viewBox="0 0 720 180" role="img" aria-label={`${frameworkMeta?.name || 'HIPAA'} compliance score trend`}>
          <g>
            {[25, 50, 75, 100].map((value) => {
              const y = chart.yFor(value);
              return <line key={value} x1="48" x2="700" y1={y} y2={y} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />;
            })}
          </g>
          <g>
            {[0, 25, 50, 75, 100].map((value) => (
              <text key={value} x="8" y={chart.yFor(value) + 4} fontSize="11" fill="#9ca3af">{value}</text>
            ))}
          </g>
          <path d={chart.areaPath} fill="rgba(26, 115, 232, 0.08)" />
          <path d={chart.linePath} fill="none" stroke="#1a73e8" strokeWidth="2.5" />
          {chart.points.map((point) => (
            <g key={point.key}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#0f4c81"
                stroke="white"
                strokeWidth="2"
                onMouseEnter={() => setTooltip({ x: point.x, y: point.y, label: point.label, score: point.score })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          ))}
          <g>
            {chart.points.map((point) => (
              <text key={`${point.key}-label`} x={point.x - 16} y="172" fontSize="11" fill="#9ca3af">{point.shortDate}</text>
            ))}
          </g>
        </svg>
        {tooltip && (
          <div className="chart-tooltip" style={{ left: `${Math.max(0, tooltip.x - 54)}px`, top: `${Math.max(0, tooltip.y - 42)}px` }}>
            {tooltip.label} · {tooltip.score}%
          </div>
        )}
      </div>

      <div className="trend-stats">
        <span className={`trend-pill ${trend.scoreDelta >= 0 ? '' : 'negative'}`}>
          {trend.scoreDelta >= 0 ? '↑' : '↓'} {Math.abs(trend.scoreDelta)} pts since {trend.sinceDate}
        </span>
        <span className={`trend-pill ${trend.highFindingDelta >= 0 ? '' : 'negative'}`}>
          {trend.highFindingDelta >= 0 ? '↓' : '↑'} {Math.abs(trend.highFindingDelta)} {trend.highFindingDelta >= 0 ? 'fewer' : 'more'} high findings
        </span>
        <span className={`trend-pill ${trend.controlsDelta >= 0 ? '' : 'negative'}`}>
          {trend.controlsDelta >= 0 ? '↑' : '↓'} {Math.abs(trend.controlsDelta)} {trend.controlsDelta >= 0 ? 'more' : 'fewer'} controls passing
        </span>
      </div>
    </section>
  );
}

function AssessmentScheduler({ schedule, onSave, showSaveToast }) {
  const [editing, setEditing] = useState(false);
  const [cadence, setCadence] = useState('weekly');
  const [emailNotify, setEmailNotify] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(localStorage.getItem('userEmail') || 'user@example.com');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = normalizeSchedule(schedule || getMockSchedule());
    setCadence(next.cadence);
    setEmailNotify(next.email_notify);
    setNotifyEmail(next.notify_email || localStorage.getItem('userEmail') || 'user@example.com');
  }, [schedule]);

  const nextRunPreview = calculateNextRunIso(cadence);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      cadence,
      email_notify: emailNotify,
      notify_email: emailNotify ? notifyEmail : '',
    });
    setSaving(false);
    setEditing(false);
  };

  return (
    <section className="schedule-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ ...sectionHead, margin: 0 }}>🗓 Assessment Schedule</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{ border: 'none', background: 'none', color: '#0f4c81', fontWeight: 700, cursor: 'pointer' }}
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.5rem 1rem', fontSize: '0.92rem' }}>
          <strong style={{ color: '#6b7280' }}>Cadence:</strong><span>{labelCadence(schedule?.cadence)}</span>
          <strong style={{ color: '#6b7280' }}>Next Run:</strong><span>{formatDate(schedule?.next_run)}</span>
          <strong style={{ color: '#6b7280' }}>Notify:</strong><span>{schedule?.email_notify ? (schedule?.notify_email || 'Enabled') : 'Disabled'}</span>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <div className="cadence-group" role="group" aria-label="Cadence">
            {['weekly', 'monthly', 'quarterly'].map((value) => (
              <button
                key={value}
                type="button"
                className={`cadence-btn ${cadence === value ? 'active' : ''}`}
                onClick={() => setCadence(value)}
              >
                {labelCadence(value)}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.84rem' }}>
            Next assessment will run on: <strong style={{ color: '#111827' }}>{formatDate(nextRunPreview)}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <label className="toggle-switch">
              <input type="checkbox" checked={emailNotify} onChange={(event) => setEmailNotify(event.target.checked)} />
              <span className="toggle-slider" />
            </label>
            <span style={{ fontSize: '0.9rem', color: '#374151' }}>Email me when new findings are detected</span>
          </div>

          {emailNotify && (
            <input
              type="email"
              value={notifyEmail}
              onChange={(event) => setNotifyEmail(event.target.value)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '0.6rem 0.75rem',
                fontSize: '0.9rem',
                marginBottom: '0.85rem',
              }}
            />
          )}

          <button type="button" style={{ ...btnPrimary, width: '100%' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
          <div style={{ marginTop: '0.6rem' }}>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                const next = normalizeSchedule(schedule || getMockSchedule());
                setCadence(next.cadence);
                setEmailNotify(next.email_notify);
                setNotifyEmail(next.notify_email || localStorage.getItem('userEmail') || 'user@example.com');
              }}
              style={{ border: 'none', background: 'none', color: '#6b7280', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showSaveToast && <div style={{ marginTop: '0.75rem' }}><span className="status-toast">✓ Schedule saved</span></div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tab: Evidence Export
// ---------------------------------------------------------------------------

function EvidenceTab({ data, onExport, exporting }) {
  const { safeguards, baaCompliance, training, riskAssessment, phiLocations } = data;
  const totalPassingControls =
    safeguards.administrative.passed + safeguards.physical.passed + safeguards.technical.passed;

  const sections = [
    { icon: '📋', title: 'Safeguard Controls', desc: `${totalPassingControls} passing controls across Administrative, Physical, and Technical categories` },
    { icon: '📝', title: 'BAA Agreements', desc: `${baaCompliance.vendors.length} executed BAAs on file (AWS, Datadog, PagerDuty)` },
    { icon: '🎓', title: 'Training Records', desc: `${training.completionRate}% completion rate — ${training.completedStaff}/${training.totalStaff} staff trained` },
    { icon: '🔍', title: 'Risk Assessment', desc: `Completed ${formatDate(riskAssessment.completedDate)} — ${riskAssessment.mitigatedRisks} risks mitigated` },
    { icon: '🔒', title: 'PHI Encryption Evidence', desc: `AES-256 at rest, TLS 1.3 in transit — all ${phiLocations.length} PHI stores verified` },
    { icon: '📄', title: 'PHI Access Audit Log', desc: 'Last 7-day access log with user, action, resource, and authorization status' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#111827' }}>Auditor Evidence Package</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
              Download a comprehensive HTML report suitable for compliance audits and executive reviews.
            </p>
          </div>
          <button
            onClick={onExport}
            disabled={exporting}
            style={{ ...btnPrimary, opacity: exporting ? 0.7 : 1 }}
          >
            {exporting ? '⏳ Generating…' : '⬇️ Download Evidence Report'}
          </button>
        </div>

        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#374151', fontWeight: 600 }}>Included Sections</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {sections.map(s => (
            <div key={s.title} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, borderLeft: '4px solid #1d4ed8' }}>
        <h3 style={{ margin: '0 0 0.5rem', color: '#1d4ed8' }}>📌 Auditor Notes</h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.7 }}>
          <li>This report is generated from live compliance data and is current as of the download timestamp.</li>
          <li>PHI access logs shown here are a 7-day sample; full logs are retained in CloudWatch for 365 days per §164.312(b).</li>
          <li>BAA documents are maintained in the SecureBase Evidence Vault (S3, Object Lock, 7-year retention).</li>
          <li>For OCR breach notification purposes, contact compliance@healthcorp.example.com within 60 days.</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Findings helpers
// ---------------------------------------------------------------------------

function normalizeFindings(payload) {
  const source = Array.isArray(payload) ? payload : payload?.findings || payload?.data || [];
  if (!Array.isArray(source)) return [];

  return source.map((finding, index) => ({
    id: finding.id || `${finding.control || 'control'}-${finding.title || 'finding'}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    severity: String(finding.severity || 'low').toLowerCase(),
    title: finding.title || 'Untitled finding',
    description: finding.description || finding.remediation || 'No description available.',
    control: finding.control || 'Compliance control',
    status: String(finding.status || 'open').toLowerCase(),
    assigned_to: finding.assigned_to || finding.assignedTo || null,
    remediation_steps: Array.isArray(finding.remediation_steps)
      ? finding.remediation_steps
      : (finding.remediation ? [finding.remediation] : ['Review and remediate this control.'])
  }));
}

function normalizeUsers(payload) {
  const source = Array.isArray(payload) ? payload : payload?.users || payload?.data || [];
  if (!Array.isArray(source)) return [];

  return source.map((user, index) => ({
    id: user.id || user.user_id || buildDeterministicFallbackId('user', `${user.email || ''}-${index}`),
    name: user.name || user.full_name || user.email?.split('@')[0] || 'Unknown User',
    email: user.email || '',
    role: String(user.role || 'viewer').toLowerCase(),
    avatar_initials: user.avatar_initials || getInitials(user.name || user.full_name || user.email || ''),
    joined_at: user.joined_at || user.created_at || null,
  }));
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCompliancePayload(payload) {
  const source = payload || {};
  const controlsPassing = toNumber(source.controlsPassing ?? source.controls_passing, 42);
  const highFindings = toNumber(source.highFindings ?? source.high_findings, 4);
  const overallScore = toNumber(source.overallScore ?? source.overall_score, 84);
  const lowRisk = overallScore >= 80;

  const fallbackSafeguards = {
    administrative: { passed: Math.max(Math.floor(controlsPassing * 0.34), 1), total: 20, percentage: 80, controls: [] },
    physical: { passed: Math.max(Math.floor(controlsPassing * 0.28), 1), total: 14, percentage: 78, controls: [] },
    technical: { passed: Math.max(Math.floor(controlsPassing * 0.38), 1), total: 24, percentage: 75, controls: [] },
  };

  return {
    ...source,
    overallScore,
    controlsPassing,
    highFindings,
    lastAssessmentDate: source.lastAssessmentDate || source.last_assessed || new Date().toISOString(),
    riskLevel: source.riskLevel || source.risk_level || (lowRisk ? 'low' : 'medium'),
    safeguards: source.safeguards || fallbackSafeguards,
    baaCompliance: source.baaCompliance || { signed: false, vendors: [] },
    training: source.training || {
      completionRate: 0,
      totalStaff: 0,
      completedStaff: 0,
      overdueStaff: 0,
      nextDeadline: new Date().toISOString(),
      modules: [],
    },
    riskAssessment: source.riskAssessment || {
      status: 'pending',
      completedDate: new Date().toISOString(),
      nextScheduled: new Date().toISOString(),
      openRisks: highFindings,
      mitigatedRisks: 0,
      riskScore: lowRisk ? 'low' : 'medium',
      items: [],
    },
    phi: source.phi || { encryptionAtRest: true, encryptionInTransit: true, accessLogging: true, auditTrail: true },
    phiEncryption: source.phiEncryption || { atRest: true, inTransit: true, verified: true },
    phiLocations: source.phiLocations || [],
    findings: source.findings || [],
    phiAccessLog: source.phiAccessLog || [],
  };
}

function normalizeHistory(payload) {
  const source = Array.isArray(payload) ? payload : payload?.history || payload?.data || [];
  if (!Array.isArray(source)) return [];
  return source.map((entry) => ({
    date: entry.date || entry.assessed_at || new Date().toISOString(),
    score: toNumber(entry.score ?? entry.overall_score, 0),
    controls_passing: toNumber(entry.controls_passing ?? entry.controlsPassing, 0),
    high_findings: toNumber(entry.high_findings ?? entry.highFindings, 0),
  }));
}

function calculateNextRunIso(cadence) {
  const days = cadence === 'monthly' ? 30 : cadence === 'quarterly' ? 90 : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeSchedule(payload) {
  const source = payload || {};
  return {
    cadence: source.cadence || 'weekly',
    next_run: source.next_run || calculateNextRunIso(source.cadence || 'weekly'),
    email_notify: source.email_notify !== undefined ? Boolean(source.email_notify) : true,
    notify_email: source.notify_email || localStorage.getItem('userEmail') || 'user@example.com',
  };
}

function readScheduleFromLocalStorage(frameworkId = 'hipaa') {
  try {
    const stored = localStorage.getItem(`${frameworkId}_schedule`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (_) {
    return null;
  }
}

function labelCadence(cadence) {
  if (cadence === 'monthly') return 'Monthly';
  if (cadence === 'quarterly') return 'Quarterly';
  return 'Weekly';
}

function buildTrendChart(history) {
  const width = 720;
  const height = 180;
  const left = 48;
  const right = 20;
  const top = 12;
  const bottom = 28;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const data = history.length > 1 ? history : MOCK_HISTORY;
  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;

  const yFor = (value) => top + ((100 - Math.max(0, Math.min(100, value))) / 100) * innerHeight;
  const points = data.map((entry, index) => {
    const date = new Date(entry.date);
    return {
      x: left + (step * index),
      y: yFor(entry.score),
      score: entry.score,
      key: `${entry.date}-${index}`,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      shortDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });

  const linePath = buildSmoothLinePath(points);
  const baselineY = yFor(0);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  return { points, linePath, areaPath, yFor };
}

function buildSmoothLinePath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const cp1x = current.x + ((next.x - current.x) / 3);
    const cp1y = current.y;
    const cp2x = next.x - ((next.x - current.x) / 3);
    const cp2y = next.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return d;
}

function getTrendSummary(history) {
  const data = history.length > 1 ? history : MOCK_HISTORY;
  const first = data[0];
  const last = data[data.length - 1];
  return {
    scoreDelta: toNumber(last.score, 0) - toNumber(first.score, 0),
    highFindingDelta: toNumber(first.high_findings, 0) - toNumber(last.high_findings, 0),
    controlsDelta: toNumber(last.controls_passing, 0) - toNumber(first.controls_passing, 0),
    sinceDate: new Date(first.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function filterFindings(findings, activeFilter, currentUserId) {
  if (activeFilter === 'all') return findings;
  if (activeFilter === 'resolved') return findings.filter((finding) => finding.status === 'resolved');
  if (activeFilter === 'mine') return findings.filter((finding) => finding.assigned_to && finding.assigned_to === currentUserId);
  return findings.filter((finding) => finding.severity === activeFilter);
}

function getFilterCounts(findings, currentUserId) {
  return {
    all: findings.length,
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    resolved: findings.filter((finding) => finding.status === 'resolved').length,
    mine: findings.filter((finding) => finding.assigned_to && finding.assigned_to === currentUserId).length,
  };
}

function filterLabel(filter) {
  if (filter === 'all') return 'All';
  if (filter === 'resolved') return 'Resolved';
  if (filter === 'mine') return 'Mine';
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function statusLabel(status) {
  if (status === 'in_progress') return 'In Progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function severityBadgeStyle(severity) {
  const map = {
    critical: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    high: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
    medium: { background: '#e0f2fe', color: '#075985', border: '1px solid #7dd3fc' },
    low: { background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' }
  };
  const style = map[severity] || map.low;
  return {
    ...style,
    textTransform: 'capitalize',
    fontWeight: 700,
    fontSize: '0.75rem',
    borderRadius: 999,
    padding: '0.15rem 0.55rem'
  };
}

function statusBadgeStyle(status) {
  const color = status === 'open' ? '#dc2626' : status === 'in_progress' ? '#d97706' : '#16a34a';
  return {
    color,
    fontWeight: 700,
    fontSize: '0.8rem'
  };
}

function generateEvidenceReport(org, date, findings, score, frameworkMeta = MOCK_FRAMEWORKS[0]) {
  const openFindings = findings.filter((finding) => finding.status !== 'resolved');
  const resolvedFindings = findings.filter((finding) => finding.status === 'resolved');
  const frameworkName = frameworkMeta?.name || 'HIPAA';
  const frameworkKey = frameworkMeta?.id || 'hipaa';
  const standardReference = FRAMEWORK_STANDARD_REFERENCES[frameworkKey] || FRAMEWORK_STANDARD_REFERENCES.hipaa;
  return `
${frameworkName.toUpperCase()} COMPLIANCE EVIDENCE PACKAGE
==================================
Organization: ${org}
Generated: ${date}
Overall Score: ${score}%
Framework: ${frameworkName}
Description: ${frameworkMeta?.description || ''}
Applicable Standard: ${standardReference}

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

function generateComplianceReportHTML(org, date, history, findings, score, frameworkMeta = MOCK_FRAMEWORKS[0]) {
  const safeOrg = escHtml(org);
  const safeDate = escHtml(date);
  const frameworkName = frameworkMeta?.name || 'HIPAA';
  const frameworkId = frameworkMeta?.id || 'hipaa';
  const standardReference = FRAMEWORK_STANDARD_REFERENCES[frameworkId] || FRAMEWORK_STANDARD_REFERENCES.hipaa;
  const openFindings = findings.filter((finding) => finding.status !== 'resolved');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeOrg} ${escHtml(frameworkName)} Compliance Report — ${safeDate}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; color: #111827; }
    h1 { color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 0.5rem; }
    .score { font-size: 3rem; font-weight: 800; color: #0f4c81; }
    .finding { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
    .critical { border-left: 4px solid #dc2626; }
    .high { border-left: 4px solid #d97706; }
    .medium { border-left: 4px solid #0284c7; }
    .low { border-left: 4px solid #16a34a; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8fafc; font-weight: 600; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${escHtml(frameworkName)} Compliance Report</h1>
  <p><strong>Organization:</strong> ${safeOrg}</p>
  <p><strong>Generated:</strong> ${safeDate}</p>
  <p><strong>Applicable Standard:</strong> ${escHtml(standardReference)}</p>
  <p><strong>Overall Score:</strong> <span class="score">${escHtml(String(score))}%</span></p>

  <h2>Score Trend</h2>
  <table>
    <tr><th>Date</th><th>Score</th><th>Controls Passing</th><th>High Findings</th></tr>
    ${history.map((h) => `
      <tr>
        <td>${escHtml(new Date(h.date).toLocaleDateString('en-US'))}</td>
        <td>${escHtml(String(h.score))}%</td>
        <td>${escHtml(String(h.controls_passing))}</td>
        <td>${escHtml(String(h.high_findings))}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Open Findings</h2>
  ${openFindings.map((f) => `
    <div class="finding ${escHtml(String(f.severity).toLowerCase())}">
      <strong>[${escHtml(String(f.severity).toUpperCase())}] ${escHtml(f.title)}</strong><br/>
      <small>${escHtml(f.control)}</small><br/>
      ${escHtml(f.description)}
    </div>
  `).join('')}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '1.25rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
};

const sectionHead = {
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827'
};

const infoBox = {
  background: '#f9fafb',
  borderRadius: 8,
  padding: '0.6rem 0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: 4
};

const btnPrimary = {
  background: '#0f4c81',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '0.65rem 1.25rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.875rem'
};

const btnSecondary = {
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '0.65rem 1.25rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.875rem'
};

const inlineActionButtonStyle = {
  background: '#fff',
  color: '#0f4c81',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: '0.35rem 0.65rem',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer'
};

// ---------------------------------------------------------------------------
// Auditor report generator
// ---------------------------------------------------------------------------

/** Escape HTML entities to prevent XSS when inserting data into the report */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

/** Map a known control status to a safe CSS color (whitelist approach) */
function statusColor(status) {
  return status === 'passing' ? '#065f46' : '#92400e';
}

/** Map a known finding severity to a safe CSS color (whitelist approach) */
function severityColor(severity) {
  if (severity === 'high') return '#dc2626';
  if (severity === 'medium') return '#92400e';
  return '#1d4ed8';
}

function generateAuditorReport(data, frameworkMeta = MOCK_FRAMEWORKS[0]) {
  const now = new Date().toLocaleString();
  const frameworkName = frameworkMeta?.name || 'HIPAA';
  const { safeguards, baaCompliance, training, riskAssessment, findings, phiLocations } = data;

  const controlRows = (controls) => (controls || []).map(c =>
    `<tr><td style="font-family:monospace;color:#555">${escHtml(c.id)}</td><td>${escHtml(c.name)}</td><td><span style="color:${statusColor(c.status)}">${escHtml(c.status)}</span></td></tr>`
  ).join('');

  const findingRows = findings.map(f =>
    `<tr>
      <td>${escHtml(f.id)}</td>
      <td style="color:${severityColor(f.severity)}">${escHtml(f.severity)}</td>
      <td>${escHtml(f.title)}</td>
      <td style="font-family:monospace;font-size:0.8em">${escHtml(f.control)}</td>
      <td>${escHtml(f.status)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(frameworkName)} Compliance Evidence Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 2rem auto; color: #111; line-height: 1.5; }
    h1 { color: #0f4c81; border-bottom: 2px solid #0f4c81; padding-bottom: 0.5rem; }
    h2 { color: #374151; margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { background: #f3f4f6; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.85rem; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .score { font-size: 2.5rem; font-weight: 800; color: #0f4c81; }
    .meta { color: #6b7280; font-size: 0.85rem; }
    footer { margin-top: 3rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; color: #9ca3af; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>${escHtml(frameworkMeta?.icon || '🏥')} ${escHtml(frameworkName)} Compliance Evidence Report</h1>
  <p class="meta">Generated: ${escHtml(now)} · HealthCorp Medical Systems · SecureBase Platform</p>
  <p class="meta">Overall Score: <span class="score">${escHtml(String(data.overallScore))}%</span> · Risk Level: <strong style="text-transform:capitalize">${escHtml(data.riskLevel)}</strong></p>

  <h2>Administrative Safeguards (§164.308)</h2>
  <p>${safeguards.administrative.passed}/${safeguards.administrative.total} controls passing (${Math.round(safeguards.administrative.percentage)}%)</p>
  <table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th></tr></thead><tbody>${controlRows(safeguards.administrative.controls)}</tbody></table>

  <h2>Physical Safeguards (§164.310)</h2>
  <p>${safeguards.physical.passed}/${safeguards.physical.total} controls passing (${Math.round(safeguards.physical.percentage)}%)</p>
  <table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th></tr></thead><tbody>${controlRows(safeguards.physical.controls)}</tbody></table>

  <h2>Technical Safeguards (§164.312)</h2>
  <p>${safeguards.technical.passed}/${safeguards.technical.total} controls passing (${Math.round(safeguards.technical.percentage)}%)</p>
  <table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th></tr></thead><tbody>${controlRows(safeguards.technical.controls)}</tbody></table>

  <h2>Business Associate Agreements</h2>
  <table>
    <thead><tr><th>Vendor</th><th>Status</th><th>Signed</th><th>Expires</th><th>Covered Services</th></tr></thead>
    <tbody>
      ${baaCompliance.vendors.map(v => `<tr><td>${escHtml(v.name)}</td><td>${escHtml(v.status)}</td><td>${new Date(v.signedDate).toLocaleDateString()}</td><td>${new Date(v.expiresDate).toLocaleDateString()}</td><td>${escHtml(v.coveredServices.join(', '))}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Security Awareness Training</h2>
  <p>Overall completion: <strong>${training.completionRate}%</strong> (${training.completedStaff}/${training.totalStaff} staff)</p>
  <table>
    <thead><tr><th>Module</th><th>Completion</th></tr></thead>
    <tbody>${training.modules.map(m => `<tr><td>${escHtml(m.name)}</td><td>${escHtml(m.completion)}%</td></tr>`).join('')}</tbody>
  </table>

  <h2>Risk Assessment</h2>
  <p>Status: <strong>${riskAssessment.status}</strong> · Completed: ${new Date(riskAssessment.completedDate).toLocaleDateString()} · Open risks: ${riskAssessment.openRisks}</p>

  <h2>PHI Data Stores</h2>
  <table>
    <thead><tr><th>Service</th><th>Region</th><th>KMS Key</th><th>Encrypted</th></tr></thead>
    <tbody>${phiLocations.map(l => `<tr><td>${escHtml(l.service)}</td><td>${escHtml(l.region)}</td><td style="font-family:monospace;font-size:0.8em">${escHtml(l.kmsKeyId)}</td><td>${l.encrypted ? '✓' : '✗'}</td></tr>`).join('')}</tbody>
  </table>

  <h2>Open Findings</h2>
  <table>
    <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Control</th><th>Status</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>

  <footer>
    <p>Generated by SecureBase ${escHtml(frameworkName)} Compliance Dashboard · All data is current as of the above timestamp.</p>
    <p>For questions, contact compliance@healthcorp.example.com</p>
  </footer>
</body>
</html>`;
}
