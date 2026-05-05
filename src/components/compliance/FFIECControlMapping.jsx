/**
 * FFIECControlMapping.jsx
 *
 * Maps AWS telemetry findings (the same evidence already collected for SOC 2 / HIPAA)
 * to explicit FFIEC IT Examination Handbook sections and CAT assessment statements.
 *
 * Replaces the generic "Passed ✓" status with a regulatory evidence view:
 *   "S3 bucket encryption enabled → FFIEC IS §II.C: Data in Transit & At Rest"
 *
 * This panel is shown inside the ComplianceDashboard when the customer's tier
 * is 'fintech' or 'fintech_elite' and FFIEC coverage is enabled.
 */

import React, { useState, useMemo } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

// ---------------------------------------------------------------------------
// FFIEC IT Handbook → AWS telemetry mapping table
// Handbook sections: https://ithandbook.ffiec.gov/
// ---------------------------------------------------------------------------
const FFIEC_CONTROL_MAP = [
  // ── Information Security ─────────────────────────────────────────────────
  {
    handbookSection: 'IS §II.A',
    handbookTitle: 'Information Security Program',
    description: 'Documented IS program with board-level oversight.',
    catDomain: 'Cyber Risk Management & Oversight',
    catStatement: 'An information security program is in place.',
    awsTelemetry: [
      {
        source: 'Organizations SCPs',
        check: 'Management account SCPs enforce baseline guardrails',
        status: 'passed',
        evidence: 'aws_organizations_policy_DenyRootUserActions',
      },
      {
        source: 'IAM Identity Center',
        check: 'SSO enforced; no long-lived IAM user credentials',
        status: 'passed',
        evidence: 'iam_user_count = 0 (SSO enforced)',
      },
    ],
  },
  {
    handbookSection: 'IS §II.C',
    handbookTitle: 'Data in Transit and at Rest',
    description: 'Encryption of sensitive data in transit and at rest using approved algorithms.',
    catDomain: 'Cybersecurity Controls',
    catStatement: 'Sensitive data is encrypted in transit and at rest.',
    awsTelemetry: [
      {
        source: 'Config Rule',
        check: 's3-bucket-server-side-encryption-enabled',
        status: 'passed',
        evidence: 'All S3 buckets: SSE-KMS (AES-256)',
      },
      {
        source: 'Config Rule',
        check: 'rds-storage-encrypted',
        status: 'passed',
        evidence: 'Aurora cluster: encrypted at rest with KMS CMK',
      },
      {
        source: 'Config Rule',
        check: 'elb-tls-https-listeners-only',
        status: 'passed',
        evidence: 'ALB: TLS 1.3 only, TLSv1_3_2021 policy',
      },
    ],
  },
  {
    handbookSection: 'IS §II.D',
    handbookTitle: 'Access & Identity Management',
    description: 'Least-privilege access controls, MFA, and privileged access management.',
    catDomain: 'Cyber Risk Management & Oversight',
    catStatement: 'Multi-factor authentication controls are in place.',
    awsTelemetry: [
      {
        source: 'Security Hub Control',
        check: 'IAM.6 — Hardware MFA for root account',
        status: 'passed',
        evidence: 'Root account MFA: hardware token enrolled',
      },
      {
        source: 'Security Hub Control',
        check: 'IAM.19 — MFA for all IAM users',
        status: 'passed',
        evidence: 'SSO enforced via IAM Identity Center; no console IAM users',
      },
      {
        source: 'IAM Access Analyzer',
        check: 'No external access findings',
        status: 'passed',
        evidence: 'Access Analyzer: 0 unresolved external access findings',
      },
    ],
  },
  {
    handbookSection: 'IS §II.E',
    handbookTitle: 'Audit Logging & Monitoring',
    description: 'Comprehensive audit logging with tamper-evident storage and monitoring.',
    catDomain: 'Cybersecurity Controls',
    catStatement: 'Audit logs are captured, retained, and protected from modification.',
    awsTelemetry: [
      {
        source: 'CloudTrail',
        check: 'Multi-region trail with S3 Object Lock',
        status: 'passed',
        evidence: 'CloudTrail: all regions, S3 Object Lock Compliance mode, 7-year retention',
      },
      {
        source: 'Config Rule',
        check: 'cloudtrail-enabled',
        status: 'passed',
        evidence: 'CloudTrail management and data events enabled',
      },
      {
        source: 'Config Rule',
        check: 'cloud-trail-log-file-validation-enabled',
        status: 'passed',
        evidence: 'Log file integrity validation: enabled',
      },
    ],
  },
  // ── Business Continuity Planning ─────────────────────────────────────────
  {
    handbookSection: 'BCP §II.B',
    handbookTitle: 'Business Impact Analysis & RTO/RPO',
    description: 'Documented RTO/RPO targets with tested recovery capabilities.',
    catDomain: 'Cyber Incident Management & Resilience',
    catStatement: 'Recovery time and point objectives are defined and tested.',
    awsTelemetry: [
      {
        source: 'Aurora Global Database',
        check: 'Cross-region replication lag < 1 minute (RPO)',
        status: 'passed',
        evidence: 'Aurora Global: us-east-1 → us-west-2, replication lag: ~200ms',
      },
      {
        source: 'Route 53 Health Checks',
        check: 'Automated failover configuration',
        status: 'passed',
        evidence: 'Route 53: health check failover with 30-second interval',
      },
    ],
  },
  {
    handbookSection: 'BCP §III.A',
    handbookTitle: 'Incident Response & Notification',
    description: 'Documented incident response plan with regulatory notification procedures.',
    catDomain: 'Cyber Incident Management & Resilience',
    catStatement: 'An incident response plan is in place and tested at least annually.',
    awsTelemetry: [
      {
        source: 'GuardDuty',
        check: 'Threat detection enabled with automated response',
        status: 'passed',
        evidence: 'GuardDuty: all detector types enabled, EventBridge auto-response active',
      },
      {
        source: 'EventBridge + SNS',
        check: 'Alert routing to on-call and compliance channels',
        status: 'passed',
        evidence: 'EventBridge rules: GuardDuty HIGH/CRITICAL → SNS → PagerDuty',
      },
    ],
  },
  // ── Vendor Management ────────────────────────────────────────────────────
  {
    handbookSection: 'VM §II.A',
    handbookTitle: 'Third-Party Risk Management',
    description: 'Due diligence, contract controls, and ongoing monitoring of critical vendors.',
    catDomain: 'External Dependency Management',
    catStatement: 'Critical third-party service providers are identified and monitored.',
    awsTelemetry: [
      {
        source: 'Organizations SCPs',
        check: 'Third-party IAM cross-account role restrictions',
        status: 'passed',
        evidence: 'SCP: requires ExternalId condition on cross-account roles',
      },
      {
        source: 'IAM Access Analyzer',
        check: 'Cross-account access findings',
        status: 'passed',
        evidence: 'Access Analyzer: 0 unresolved cross-account findings',
      },
    ],
  },
  // ── Cybersecurity (FFIEC 2015 Statement) ─────────────────────────────────
  {
    handbookSection: 'CS §I.B',
    handbookTitle: 'Vulnerability & Patch Management',
    description: 'Regular vulnerability scanning, patch management, and remediation tracking.',
    catDomain: 'Cybersecurity Controls',
    catStatement: 'Vulnerability and patch management processes are in place.',
    awsTelemetry: [
      {
        source: 'Security Hub',
        check: 'Amazon Inspector findings (EC2/container vulnerabilities)',
        status: 'warning',
        evidence: 'Inspector: 4 medium findings — patch cycle pending',
      },
      {
        source: 'Config Rule',
        check: 'ec2-managedinstance-patch-compliance-status-check',
        status: 'passed',
        evidence: 'Systems Manager Patch Manager: compliant on 12/12 managed instances',
      },
    ],
  },
  {
    handbookSection: 'CS §II.A',
    handbookTitle: 'Network Security Controls',
    description: 'Network segmentation, perimeter controls, and traffic monitoring.',
    catDomain: 'Cybersecurity Controls',
    catStatement: 'Network perimeter and segmentation controls are implemented.',
    awsTelemetry: [
      {
        source: 'Config Rule',
        check: 'vpc-default-security-group-closed',
        status: 'passed',
        evidence: 'Default SGs: no inbound/outbound rules (least-privilege baseline)',
      },
      {
        source: 'Config Rule',
        check: 'restricted-ssh / restricted-common-ports',
        status: 'passed',
        evidence: 'No security groups allow unrestricted SSH or RDP',
      },
      {
        source: 'VPC Flow Logs',
        check: 'Flow logs enabled for all VPCs',
        status: 'passed',
        evidence: 'Flow logs: all VPCs → CloudWatch Logs with 90-day retention',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const cfg = {
    passed:  { cls: 'bg-green-100 text-green-700',  label: 'Passed' },
    warning: { cls: 'bg-amber-100 text-amber-700',  label: 'Warning' },
    failed:  { cls: 'bg-red-100 text-red-700',      label: 'Failed' },
    pending: { cls: 'bg-slate-100 text-slate-600',  label: 'Pending' },
  };
  const { cls, label } = cfg[status] || cfg.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single mapping row
// ---------------------------------------------------------------------------
function ControlMappingRow({ mapping }) {
  const [open, setOpen] = useState(false);
  const allPassed = mapping.awsTelemetry.every((t) => t.status === 'passed');
  const hasWarning = mapping.awsTelemetry.some((t) => t.status === 'warning');

  const overallStatus = allPassed ? 'passed' : hasWarning ? 'warning' : 'failed';

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
              {mapping.handbookSection}
            </span>
            <span className="font-semibold text-slate-900 text-sm">{mapping.handbookTitle}</span>
            <StatusBadge status={overallStatus} />
          </div>
          <p className="text-xs text-slate-500 mb-1">{mapping.description}</p>
          <p className="text-xs text-slate-400 italic">
            CAT: <span className="text-slate-500 not-italic">{mapping.catStatement}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span className="text-xs text-slate-400">{mapping.awsTelemetry.length} checks</span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-2">
          {mapping.awsTelemetry.map((t, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-start gap-3"
            >
              <div className="mt-0.5 shrink-0">
                <StatusBadge status={t.status} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                    {t.source}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{t.check}</span>
                </div>
                <p className="text-xs text-slate-500 font-mono">{t.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function FFIECControlMapping({ onExportClick }) {
  const [filterSection, setFilterSection] = useState('all');

  const sections = useMemo(
    () => [...new Set(FFIEC_CONTROL_MAP.map((m) => m.handbookSection.split(' ')[0]))],
    [],
  );

  const filtered = filterSection === 'all'
    ? FFIEC_CONTROL_MAP
    : FFIEC_CONTROL_MAP.filter((m) => m.handbookSection.startsWith(filterSection));

  const passed = FFIEC_CONTROL_MAP.reduce(
    (n, m) => n + (m.awsTelemetry.every((t) => t.status === 'passed') ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="font-bold text-slate-900">FFIEC IT Handbook Control Mapping</h3>
            <p className="text-sm text-slate-500">
              AWS telemetry linked to FFIEC handbook sections ·{' '}
              {passed}/{FFIEC_CONTROL_MAP.length} sections passing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section filter */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFilterSection('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                filterSection === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All
            </button>
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSection(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filterSection === s ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {onExportClick && (
            <button
              onClick={onExportClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Export Examiner Report
            </button>
          )}
        </div>
      </div>

      {/* Mapping rows */}
      <div className="space-y-2">
        {filtered.map((m) => (
          <ControlMappingRow key={m.handbookSection} mapping={m} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        FFIEC IT Examination Handbooks:{' '}
        <a
          href="https://ithandbook.ffiec.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          ithandbook.ffiec.gov
        </a>{' '}
        · Mapping updated May 2026 · Not a substitute for a formal FFIEC examination.
      </p>
    </div>
  );
}
