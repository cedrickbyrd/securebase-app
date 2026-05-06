/**
 * FFIECCATDashboard.jsx
 *
 * Cybersecurity Assessment Tool (CAT) maturity level dashboard.
 *
 * The FFIEC CAT (https://www.ffiec.gov/cyberassessmenttool.htm) is a voluntary
 * self-assessment tool used by financial institutions to measure their
 * cybersecurity preparedness across five maturity levels:
 *   Baseline → Evolving → Intermediate → Advanced → Innovative
 *
 * SecureBase auto-populates CAT maturity indicators from AWS telemetry
 * (CloudTrail, Config, GuardDuty, Security Hub, IAM Access Analyzer) rather
 * than requiring institutions to complete a 3-month manual spreadsheet exercise.
 *
 * Each CAT domain maps to existing SecureBase evidence already collected for
 * SOC 2 / HIPAA — FFIEC is surfaced as an additional compliance lens over the
 * same infrastructure telemetry.
 */

import React, { useState, useMemo } from 'react';
import { Shield, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// CAT Domain definitions
// Derived from FFIEC Cybersecurity Assessment Tool, May 2017 edition.
// Each domain contains 1–5 assessment factors with maturity indicators.
// ---------------------------------------------------------------------------
const CAT_DOMAINS = [
  {
    id: 'cyber_risk_management',
    name: 'Cyber Risk Management & Oversight',
    description: 'Governance, risk management, resources, training, and culture.',
    ffiecRef: 'FFIEC CAT Domain 1',
    awsSources: ['CloudTrail', 'IAM Access Analyzer', 'Organizations SCPs'],
    factors: [
      {
        id: 'governance',
        name: 'Governance',
        controls: ['CC1.1', 'CC1.2', 'CC1.3'],
        awsEvidence: 'IAM Identity Center enforcement, SCP guardrails, CloudTrail management events',
      },
      {
        id: 'risk_management',
        name: 'Risk Management',
        controls: ['CC3.1', 'CC3.2', 'CC3.3'],
        awsEvidence: 'Security Hub findings aggregation, Config rule compliance history',
      },
      {
        id: 'resources',
        name: 'Resources',
        controls: ['CC1.4'],
        awsEvidence: 'IAM role analysis, least-privilege policy validation',
      },
      {
        id: 'training',
        name: 'Training & Culture',
        controls: ['CC1.5'],
        awsEvidence: 'IAM MFA enrollment rate, password policy compliance',
      },
    ],
  },
  {
    id: 'threat_intelligence',
    name: 'Threat Intelligence & Collaboration',
    description: 'Threat intelligence monitoring, information sharing, and emerging threats.',
    ffiecRef: 'FFIEC CAT Domain 2',
    awsSources: ['GuardDuty', 'Security Hub', 'CloudTrail'],
    factors: [
      {
        id: 'threat_monitoring',
        name: 'Threat Monitoring',
        controls: ['CC7.1', 'CC7.2'],
        awsEvidence: 'GuardDuty threat detections, Security Hub findings by severity',
      },
      {
        id: 'information_sharing',
        name: 'Information Sharing',
        controls: ['CC2.1'],
        awsEvidence: 'Security Hub CISA KEV integration, AWS Threat Intelligence feeds',
      },
    ],
  },
  {
    id: 'cybersecurity_controls',
    name: 'Cybersecurity Controls',
    description: 'Preventive, detective, and corrective controls for infrastructure and data.',
    ffiecRef: 'FFIEC CAT Domain 3',
    awsSources: ['Config', 'Security Hub', 'Macie', 'KMS', 'VPC Flow Logs'],
    factors: [
      {
        id: 'preventive',
        name: 'Preventive Controls',
        controls: ['CC6.1', 'CC6.2', 'CC6.6'],
        awsEvidence: 'S3 Block Public Access, KMS encryption, VPC security groups, WAF',
      },
      {
        id: 'detective',
        name: 'Detective Controls',
        controls: ['CC7.2', 'CC7.3'],
        awsEvidence: 'Config rule evaluations, Security Hub standards compliance, Macie PHI findings',
      },
      {
        id: 'corrective',
        name: 'Corrective Controls',
        controls: ['CC7.4', 'CC7.5'],
        awsEvidence: 'Security Hub auto-remediation, Config remediation actions, incident response runbooks',
      },
    ],
  },
  {
    id: 'external_dependency',
    name: 'External Dependency Management',
    description: 'Third-party relationships, vendor risk, and supply chain security.',
    ffiecRef: 'FFIEC CAT Domain 4',
    awsSources: ['Organizations', 'IAM', 'Config'],
    factors: [
      {
        id: 'vendor_risk',
        name: 'Vendor Risk Management',
        controls: ['CC9.1', 'CC9.2'],
        awsEvidence: 'AWS Organizations SCP enforcement, third-party IAM cross-account role analysis',
      },
      {
        id: 'resilience',
        name: 'Resilience',
        controls: ['A1.2'],
        awsEvidence: 'Multi-region DR status, RTO/RPO from health checks, Aurora Global Database replication',
      },
    ],
  },
  {
    id: 'cyber_incident',
    name: 'Cyber Incident Management & Resilience',
    description: 'Detection, response, mitigation, escalation, and recovery.',
    ffiecRef: 'FFIEC CAT Domain 5',
    awsSources: ['CloudTrail', 'GuardDuty', 'EventBridge', 'Route 53 Health Checks'],
    factors: [
      {
        id: 'detection_response',
        name: 'Detection & Response',
        controls: ['CC7.3', 'CC7.4'],
        awsEvidence: 'GuardDuty automated response, EventBridge alert routing, PagerDuty integration',
      },
      {
        id: 'escalation',
        name: 'Escalation & Reporting',
        controls: ['CC2.2', 'CC2.3'],
        awsEvidence: 'SNS alert topics, CloudWatch alarm notification chains',
      },
      {
        id: 'recovery',
        name: 'Recovery & Resumption',
        controls: ['A1.1', 'A1.2', 'A1.3'],
        awsEvidence: 'Aurora Global Database failover, Route 53 health check failover, S3 CRR replication',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Maturity level definitions
// ---------------------------------------------------------------------------
const MATURITY_LEVELS = [
  { id: 'baseline',     label: 'Baseline',     color: 'bg-slate-400',  text: 'text-slate-700',  score: 1 },
  { id: 'evolving',     label: 'Evolving',     color: 'bg-blue-400',   text: 'text-blue-700',   score: 2 },
  { id: 'intermediate', label: 'Intermediate', color: 'bg-amber-400',  text: 'text-amber-700',  score: 3 },
  { id: 'advanced',     label: 'Advanced',     color: 'bg-green-500',  text: 'text-green-700',  score: 4 },
  { id: 'innovative',   label: 'Innovative',   color: 'bg-purple-500', text: 'text-purple-700', score: 5 },
];

// ---------------------------------------------------------------------------
// Default telemetry (demo / VITE_USE_MOCK_API=true mode).
//
// Shape: Record<domain_id, { maturity: string, score: number, findings: number }>
//   - maturity: one of the MATURITY_LEVELS ids ('baseline' | 'evolving' |
//               'intermediate' | 'advanced' | 'innovative')
//   - score:    0–100 numeric score for the domain
//   - findings: count of open findings for the domain
//
// In production (VITE_USE_MOCK_API=false), the parent component fetches live
// data from GET /fintech/cat-status?customer_id=<uuid> and passes it as the
// `telemetry` prop, overriding these defaults.
// ---------------------------------------------------------------------------
const DEFAULT_TELEMETRY = {
  cyber_risk_management: { maturity: 'intermediate', score: 72, findings: 3 },
  threat_intelligence:   { maturity: 'evolving',     score: 58, findings: 7 },
  cybersecurity_controls:{ maturity: 'intermediate', score: 81, findings: 2 },
  external_dependency:   { maturity: 'evolving',     score: 61, findings: 5 },
  cyber_incident:        { maturity: 'intermediate', score: 75, findings: 4 },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function MaturityBadge({ level }) {
  const def = MATURITY_LEVELS.find((m) => m.id === level) || MATURITY_LEVELS[0];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${def.color} text-white`}>
      {def.label}
    </span>
  );
}

function MaturityBar({ level }) {
  const idx = MATURITY_LEVELS.findIndex((m) => m.id === level);
  return (
    <div className="flex gap-1 items-center">
      {MATURITY_LEVELS.map((m, i) => (
        <div
          key={m.id}
          title={m.label}
          className={`h-2 flex-1 rounded-full ${i <= idx ? m.color : 'bg-slate-200'}`}
        />
      ))}
    </div>
  );
}

function DomainCard({ domain, telemetry, onEvidenceClick }) {
  const [expanded, setExpanded] = useState(false);
  const t = telemetry[domain.id] || { maturity: 'baseline', score: 0, findings: 0 };

  const statusIcon = t.findings === 0
    ? <CheckCircle className="w-5 h-5 text-green-500" />
    : t.findings <= 3
      ? <Clock className="w-5 h-5 text-amber-500" />
      : <AlertTriangle className="w-5 h-5 text-red-500" />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full text-left px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-semibold text-slate-900">{domain.name}</span>
            <MaturityBadge level={t.maturity} />
            {t.findings > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {t.findings} finding{t.findings !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-2">{domain.description}</p>
          <MaturityBar level={t.maturity} />
        </div>
        <div className="text-slate-400 mt-1">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                AWS Telemetry Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {domain.awsSources.map((src) => (
                  <span
                    key={src}
                    className="inline-flex items-center px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-medium rounded"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                FFIEC Reference
              </p>
              <span className="text-sm text-slate-700">{domain.ffiecRef}</span>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Assessment Factors
          </p>
          <div className="space-y-2">
            {domain.factors.map((f) => (
              <div key={f.id} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-800">{f.name}</span>
                  <div className="flex gap-1">
                    {f.controls.map((c) => (
                      <span key={c} className="text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{f.awsEvidence}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => onEvidenceClick(domain)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Evidence Package
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FFIECCATDashboard({ telemetry = DEFAULT_TELEMETRY, onEvidenceExport }) {
  const [exportLoading, setExportLoading] = useState(false);

  const overallMaturity = useMemo(() => {
    const scores = Object.values(telemetry).map((t) => {
      const idx = MATURITY_LEVELS.findIndex((m) => m.id === t.maturity);
      return idx >= 0 ? idx + 1 : 1;
    });
    if (scores.length === 0) return MATURITY_LEVELS[0];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const levelIdx = Math.max(0, Math.round(avg) - 1);
    return MATURITY_LEVELS[levelIdx] || MATURITY_LEVELS[0];
  }, [telemetry]);

  const totalFindings = useMemo(
    () => Object.values(telemetry).reduce((sum, t) => sum + (t.findings || 0), 0),
    [telemetry],
  );

  const handleEvidenceClick = (domain) => {
    if (onEvidenceExport) onEvidenceExport(domain);
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      if (onEvidenceExport) await onEvidenceExport(null); // null = all domains
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-xl shadow">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              FFIEC Cybersecurity Assessment Tool (CAT)
            </h2>
            <p className="text-sm text-slate-500">
              Maturity levels auto-populated from AWS telemetry · 5 domains assessed
            </p>
          </div>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exportLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {exportLoading ? 'Generating…' : 'Export CAT Evidence Package'}
        </button>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Overall Maturity
          </p>
          <MaturityBadge level={overallMaturity.id} />
          <div className="mt-3">
            <MaturityBar level={overallMaturity.id} />
          </div>
        </div>
        {[
          { label: 'Domains Assessed', value: CAT_DOMAINS.length, sub: 'of 5 FFIEC domains' },
          { label: 'Open Findings', value: totalFindings, sub: 'across all domains', alert: totalFindings > 5 },
          { label: 'Telemetry Sources', value: '8', sub: 'AWS services monitored' },
        ].map(({ label, value, sub, alert }) => (
          <div
            key={label}
            className={`bg-white rounded-xl border p-4 ${alert ? 'border-red-200' : 'border-slate-200'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
            <p className={`text-3xl font-black ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Maturity Level Legend */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Maturity Scale:
        </span>
        {MATURITY_LEVELS.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${m.color}`} />
            <span className="text-xs font-medium text-slate-600">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Domain Cards */}
      <div className="space-y-3">
        {CAT_DOMAINS.map((domain) => (
          <DomainCard
            key={domain.id}
            domain={domain}
            telemetry={telemetry}
            onEvidenceClick={handleEvidenceClick}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-400 text-center">
        FFIEC Cybersecurity Assessment Tool — May 2017 edition ·{' '}
        <a
          href="https://www.ffiec.gov/cyberassessmenttool.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          Official FFIEC CAT resource
        </a>{' '}
        · Maturity indicators derived from live AWS telemetry; not a substitute for examiner review.
      </p>
    </div>
  );
}
