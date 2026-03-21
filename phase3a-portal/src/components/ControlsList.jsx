import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

// TODO: Replace hardcoded demo data with live API data (evidenceCount, lastChecked, status)
const ALL_CONTROLS = [
  // ── CC1: Control Environment ──────────────────────────────────────────────
  { id: 'cc1-1', name: 'Integrity and Ethical Values', framework: 'SOC 2 CC1.1', category: 'Control Environment', status: 'passing', evidenceCount: 23, lastChecked: '2 hours ago', description: 'Commitment to integrity and ethical values demonstrated across all operations' },
  { id: 'cc1-2', name: 'Board Oversight', framework: 'SOC 2 CC1.2', category: 'Control Environment', status: 'passing', evidenceCount: 8, lastChecked: '1 day ago', description: 'Board exercises oversight responsibility for security and compliance program' },
  { id: 'cc1-3', name: 'Organizational Structure', framework: 'SOC 2 CC1.3', category: 'Control Environment', status: 'passing', evidenceCount: 15, lastChecked: '1 day ago', description: 'Defined structure with assigned security and compliance responsibilities' },
  { id: 'cc1-4', name: 'Competence Commitment', framework: 'SOC 2 CC1.4', category: 'Control Environment', status: 'passing', evidenceCount: 31, lastChecked: '3 hours ago', description: 'Personnel have knowledge and skills to fulfill control responsibilities' },
  { id: 'cc1-5', name: 'Accountability Enforcement', framework: 'SOC 2 CC1.5', category: 'Control Environment', status: 'passing', evidenceCount: 19, lastChecked: '4 hours ago', description: 'Accountability for internal control responsibilities enforced' },

  // ── CC2: Communication and Information ───────────────────────────────────
  { id: 'cc2-1', name: 'Internal Information Requirements', framework: 'SOC 2 CC2.1', category: 'Communication & Information', status: 'passing', evidenceCount: 47, lastChecked: '1 hour ago', description: 'Relevant information identified and communicated to support control operation' },
  { id: 'cc2-2', name: 'Internal Communication', framework: 'SOC 2 CC2.2', category: 'Communication & Information', status: 'passing', evidenceCount: 28, lastChecked: '2 hours ago', description: 'Internal communications enable effective function of internal controls' },
  { id: 'cc2-3', name: 'External Communication', framework: 'SOC 2 CC2.3', category: 'Communication & Information', status: 'passing', evidenceCount: 12, lastChecked: '6 hours ago', description: 'External parties communicated with appropriately regarding commitments' },

  // ── CC3: Risk Assessment ──────────────────────────────────────────────────
  { id: 'cc3-1', name: 'Risk Identification', framework: 'SOC 2 CC3.1', category: 'Risk Assessment', status: 'passing', evidenceCount: 34, lastChecked: '12 hours ago', description: 'Risks to achieving service objectives identified and documented' },
  { id: 'cc3-2', name: 'Risk Analysis', framework: 'SOC 2 CC3.2', category: 'Risk Assessment', status: 'passing', evidenceCount: 22, lastChecked: '12 hours ago', description: 'Identified risks analyzed to determine likelihood and impact' },
  { id: 'cc3-3', name: 'Risk Response', framework: 'SOC 2 CC3.3', category: 'Risk Assessment', status: 'warning', evidenceCount: 17, lastChecked: '1 day ago', warningText: 'Risk treatment plan requires quarterly review', description: 'Appropriate responses selected and implemented for analyzed risks' },
  { id: 'cc3-4', name: 'Change Risk Assessment', framework: 'SOC 2 CC3.4', category: 'Risk Assessment', status: 'passing', evidenceCount: 41, lastChecked: '3 hours ago', description: 'Fraud and change-related risks considered in risk assessment process' },

  // ── CC4: Monitoring Activities ────────────────────────────────────────────
  { id: 'cc4-1', name: 'Ongoing Evaluations', framework: 'SOC 2 CC4.1', category: 'Monitoring Activities', status: 'passing', evidenceCount: 203, lastChecked: '30 minutes ago', description: 'Ongoing or periodic evaluations used to ascertain control effectiveness' },
  { id: 'cc4-2', name: 'Deficiency Evaluation', framework: 'SOC 2 CC4.2', category: 'Monitoring Activities', status: 'passing', evidenceCount: 58, lastChecked: '1 hour ago', description: 'Control deficiencies communicated and corrected in a timely manner' },

  // ── CC5: Control Activities ───────────────────────────────────────────────
  { id: 'cc5-1', name: 'Control Selection and Development', framework: 'SOC 2 CC5.1', category: 'Control Activities', status: 'passing', evidenceCount: 76, lastChecked: '2 hours ago', description: 'Controls selected and developed to mitigate risks to acceptable levels' },
  { id: 'cc5-2', name: 'Technology Control Selection', framework: 'SOC 2 CC5.2', category: 'Control Activities', status: 'passing', evidenceCount: 94, lastChecked: '45 minutes ago', description: 'Technology general controls selected and developed for infrastructure' },
  { id: 'cc5-3', name: 'Policy Deployment', framework: 'SOC 2 CC5.3', category: 'Control Activities', status: 'passing', evidenceCount: 38, lastChecked: '4 hours ago', description: 'Policies and procedures deployed and communicated to responsible personnel' },

  // ── CC6: Logical and Physical Access Controls ─────────────────────────────
  { id: 'cc6-1', name: 'Access Control Software', framework: 'SOC 2 CC6.1', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 47, lastChecked: '1 hour ago', description: 'Logical access security restricts access to authorized users and systems' },
  { id: 'cc6-2', name: 'Access Provisioning', framework: 'SOC 2 CC6.2', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 33, lastChecked: '2 hours ago', description: 'User registration and de-registration processes prevent unauthorized access' },
  { id: 'cc6-3', name: 'Access Modification', framework: 'SOC 2 CC6.3', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 29, lastChecked: '3 hours ago', description: 'Access removed or modified promptly when employment or role changes' },
  { id: 'cc6-4', name: 'Physical Access Controls', framework: 'SOC 2 CC6.4', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 18, lastChecked: '1 day ago', description: 'Physical access to facilities restricted to authorized individuals' },
  { id: 'cc6-5', name: 'Security Incident Logging', framework: 'SOC 2 CC6.5', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 156, lastChecked: '15 minutes ago', description: 'Security incidents and unauthorized access attempts logged and reviewed' },
  { id: 'cc6-6', name: 'Least Privilege Enforcement', framework: 'SOC 2 CC6.6', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 71, lastChecked: '30 minutes ago', description: 'Least privilege principle enforced; access limited to what is necessary' },
  { id: 'cc6-7', name: 'Encryption at Rest', framework: 'SOC 2 CC6.7', category: 'Logical & Physical Access', status: 'warning', evidenceCount: 12, lastChecked: '2 hours ago', warningText: '2 resources missing encryption', description: 'Data at rest protected by encryption to prevent unauthorized access' },
  { id: 'cc6-8', name: 'Unauthorized Software Prevention', framework: 'SOC 2 CC6.8', category: 'Logical & Physical Access', status: 'passing', evidenceCount: 45, lastChecked: '1 hour ago', description: 'Controls prevent installation of unauthorized or malicious software' },

  // ── CC7: System Operations ────────────────────────────────────────────────
  { id: 'cc7-1', name: 'Vulnerability Detection', framework: 'SOC 2 CC7.1', category: 'System Operations', status: 'passing', evidenceCount: 88, lastChecked: '20 minutes ago', description: 'System components monitored and scanned for vulnerabilities' },
  { id: 'cc7-2', name: 'Log Retention', framework: 'SOC 2 CC7.2', category: 'System Operations', status: 'passing', evidenceCount: 203, lastChecked: '30 minutes ago', description: 'Environmental threats monitored; logs retained per policy requirements' },
  { id: 'cc7-3', name: 'Security Event Evaluation', framework: 'SOC 2 CC7.3', category: 'System Operations', status: 'passing', evidenceCount: 134, lastChecked: '10 minutes ago', description: 'Security events evaluated, classified, and prioritized for response' },
  { id: 'cc7-4', name: 'Security Monitoring', framework: 'SOC 2 CC7.4', category: 'System Operations', status: 'passing', evidenceCount: 89, lastChecked: '15 minutes ago', description: 'Security incidents detected, responded to, and fully resolved' },
  { id: 'cc7-5', name: 'Incident Recovery', framework: 'SOC 2 CC7.5', category: 'System Operations', status: 'passing', evidenceCount: 27, lastChecked: '6 hours ago', description: 'Identified security incidents recovered and lessons documented' },

  // ── CC8: Change Management ────────────────────────────────────────────────
  { id: 'cc8-1', name: 'Change Management', framework: 'SOC 2 CC8.1', category: 'Change Management', status: 'passing', evidenceCount: 34, lastChecked: '3 hours ago', description: 'Infrastructure, data, and software changes authorized, tested, and documented' },

  // ── CC9: Risk Mitigation ──────────────────────────────────────────────────
  { id: 'cc9-1', name: 'Vendor Risk Assessment', framework: 'SOC 2 CC9.1', category: 'Risk Mitigation', status: 'passing', evidenceCount: 21, lastChecked: '1 day ago', description: 'Third-party vendor risks identified, assessed, and mitigated' },
  { id: 'cc9-2', name: 'Business Continuity Planning', framework: 'SOC 2 CC9.2', category: 'Risk Mitigation', status: 'warning', evidenceCount: 9, lastChecked: '2 days ago', warningText: 'BCP requires annual review and test', description: 'Business disruption risks identified and continuity plans maintained' },

  // ── A1: Availability ──────────────────────────────────────────────────────
  { id: 'a1-1', name: 'Capacity Planning', framework: 'SOC 2 A1.1', category: 'Availability', status: 'passing', evidenceCount: 52, lastChecked: '1 hour ago', description: 'System capacity planned and monitored to meet service availability commitments' },
  { id: 'a1-2', name: 'Environmental Threat Response', framework: 'SOC 2 A1.2', category: 'Availability', status: 'passing', evidenceCount: 38, lastChecked: '2 hours ago', description: 'Environmental threats and incidents monitored and responded to promptly' },
  { id: 'a1-3', name: 'Recovery Testing', framework: 'SOC 2 A1.3', category: 'Availability', status: 'warning', evidenceCount: 6, lastChecked: '30 days ago', warningText: 'Disaster recovery test overdue', description: 'Recovery procedures tested to confirm availability commitments can be met' },

  // ── C1: Confidentiality ───────────────────────────────────────────────────
  { id: 'c1-1', name: 'Confidential Information Identification', framework: 'SOC 2 C1.1', category: 'Confidentiality', status: 'passing', evidenceCount: 44, lastChecked: '4 hours ago', description: 'Confidential information identified and protected throughout its lifecycle' },
  { id: 'c1-2', name: 'Confidential Information Disposal', framework: 'SOC 2 C1.2', category: 'Confidentiality', status: 'passing', evidenceCount: 17, lastChecked: '1 day ago', description: 'Confidential information disposed of securely per retention policy' },

  // ── PI1: Processing Integrity ─────────────────────────────────────────────
  { id: 'pi1-1', name: 'Processing Completeness', framework: 'SOC 2 PI1.1', category: 'Processing Integrity', status: 'passing', evidenceCount: 113, lastChecked: '20 minutes ago', description: 'System processes inputs completely and produces accurate outputs' },
  { id: 'pi1-2', name: 'Processing Accuracy', framework: 'SOC 2 PI1.2', category: 'Processing Integrity', status: 'passing', evidenceCount: 97, lastChecked: '30 minutes ago', description: 'Processing errors detected and corrected in a timely manner' },
  { id: 'pi1-3', name: 'Processing Authorization', framework: 'SOC 2 PI1.3', category: 'Processing Integrity', status: 'passing', evidenceCount: 68, lastChecked: '45 minutes ago', description: 'Only authorized, valid inputs accepted for processing' },
  { id: 'pi1-4', name: 'Output Completeness', framework: 'SOC 2 PI1.4', category: 'Processing Integrity', status: 'passing', evidenceCount: 84, lastChecked: '1 hour ago', description: 'Outputs delivered completely, accurately, and on a timely basis' },
  { id: 'pi1-5', name: 'Input and Output Validation', framework: 'SOC 2 PI1.5', category: 'Processing Integrity', status: 'passing', evidenceCount: 62, lastChecked: '1 hour ago', description: 'Stored and output data validated for completeness and accuracy' },

  // ── P1–P8: Privacy ────────────────────────────────────────────────────────
  { id: 'p1-1', name: 'Privacy Notice', framework: 'SOC 2 P1.1', category: 'Privacy', status: 'passing', evidenceCount: 5, lastChecked: '7 days ago', description: 'Privacy notice communicated to data subjects prior to or at collection' },
  { id: 'p2-1', name: 'Choice and Consent', framework: 'SOC 2 P2.1', category: 'Privacy', status: 'passing', evidenceCount: 8, lastChecked: '7 days ago', description: 'Individuals offered choice and consent for personal information use' },
  { id: 'p3-1', name: 'Collection Policies', framework: 'SOC 2 P3.1', category: 'Privacy', status: 'passing', evidenceCount: 14, lastChecked: '3 days ago', description: 'Personal information collected only as necessary for stated purposes' },
  { id: 'p3-2', name: 'Sensitive Information Collection', framework: 'SOC 2 P3.2', category: 'Privacy', status: 'passing', evidenceCount: 7, lastChecked: '3 days ago', description: 'Explicit consent obtained before collecting sensitive personal information' },
  { id: 'p4-1', name: 'Personal Information Use', framework: 'SOC 2 P4.1', category: 'Privacy', status: 'passing', evidenceCount: 19, lastChecked: '2 days ago', description: 'Personal information used only for stated and consented purposes' },
  { id: 'p4-2', name: 'Retention Policy', framework: 'SOC 2 P4.2', category: 'Privacy', status: 'passing', evidenceCount: 23, lastChecked: '1 day ago', description: 'Personal information retained only as long as necessary for stated purposes' },
  { id: 'p4-3', name: 'Personal Information Disposal', framework: 'SOC 2 P4.3', category: 'Privacy', status: 'passing', evidenceCount: 11, lastChecked: '2 days ago', description: 'Personal information disposed of securely when no longer needed' },
  { id: 'p5-1', name: 'Access to Personal Information', framework: 'SOC 2 P5.1', category: 'Privacy', status: 'passing', evidenceCount: 16, lastChecked: '5 days ago', description: 'Individuals can access, review, and update their personal information' },
  { id: 'p5-2', name: 'Correction of Personal Information', framework: 'SOC 2 P5.2', category: 'Privacy', status: 'passing', evidenceCount: 9, lastChecked: '5 days ago', description: 'Individuals can request timely correction of inaccurate personal information' },
  { id: 'p6-1', name: 'Third-Party Disclosure Policy', framework: 'SOC 2 P6.1', category: 'Privacy', status: 'passing', evidenceCount: 13, lastChecked: '3 days ago', description: 'Personal information disclosed to third parties per stated privacy policy' },
  { id: 'p6-2', name: 'Third-Party Notification', framework: 'SOC 2 P6.2', category: 'Privacy', status: 'passing', evidenceCount: 7, lastChecked: '3 days ago', description: 'Third parties notified of and agree to applicable privacy commitments' },
  { id: 'p6-3', name: 'Vendor Privacy Accountability', framework: 'SOC 2 P6.3', category: 'Privacy', status: 'passing', evidenceCount: 18, lastChecked: '2 days ago', description: 'Third-party vendors held accountable for privacy and data protection obligations' },
  { id: 'p6-4', name: 'Personal Information Sharing', framework: 'SOC 2 P6.4', category: 'Privacy', status: 'passing', evidenceCount: 11, lastChecked: '4 days ago', description: 'Personal information shared with third parties only for documented purposes' },
  { id: 'p6-5', name: 'Third-Party Oversight', framework: 'SOC 2 P6.5', category: 'Privacy', status: 'passing', evidenceCount: 9, lastChecked: '3 days ago', description: 'Ongoing oversight of third parties who handle personal information' },
  { id: 'p6-6', name: 'Cookies and Tracking', framework: 'SOC 2 P6.6', category: 'Privacy', status: 'passing', evidenceCount: 6, lastChecked: '7 days ago', description: 'Cookie and tracking technology use disclosed and consented to' },
  { id: 'p6-7', name: 'Opt-Out Mechanisms', framework: 'SOC 2 P6.7', category: 'Privacy', status: 'passing', evidenceCount: 5, lastChecked: '7 days ago', description: 'Individuals provided with opt-out mechanisms for personal information use' },
  { id: 'p7-1', name: 'Personal Information Quality', framework: 'SOC 2 P7.1', category: 'Privacy', status: 'passing', evidenceCount: 22, lastChecked: '1 day ago', description: 'Personal information quality maintained per privacy commitments' },
  { id: 'p8-1', name: 'Privacy Complaints', framework: 'SOC 2 P8.1', category: 'Privacy', status: 'passing', evidenceCount: 4, lastChecked: '14 days ago', description: 'Privacy-related complaints and inquiries addressed in a timely manner' },
];

const STATUS_CONFIG = {
  passing: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Passing',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Warning',
  },
  failing: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Failing',
  },
};

const CATEGORY_ORDER = [
  'Control Environment',
  'Communication & Information',
  'Risk Assessment',
  'Monitoring Activities',
  'Control Activities',
  'Logical & Physical Access',
  'System Operations',
  'Change Management',
  'Risk Mitigation',
  'Availability',
  'Confidentiality',
  'Processing Integrity',
  'Privacy',
];

export default function ControlsList() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());

  const counts = ALL_CONTROLS.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = activeFilter === 'all'
    ? ALL_CONTROLS
    : ALL_CONTROLS.filter(c => c.status === activeFilter);

  const byCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filtered.filter(c => c.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const toggleCategory = (cat) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filterBtns = [
    { key: 'all', label: `All (${ALL_CONTROLS.length})` },
    { key: 'passing', label: `Passing (${counts.passing || 0})` },
    { key: 'warning', label: `Warning (${counts.warning || 0})` },
    { key: 'failing', label: `Failing (${counts.failing || 0})` },
  ];

  return (
    <div className="mb-8">
      {/* Header + summary */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Active Controls</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            SOC 2 Trust Services Criteria — all categories monitored
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-medium">{counts.passing || 0} passing</span>
          {(counts.warning || 0) > 0 && (
            <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-700 font-medium">{counts.warning} warning</span>
          )}
          {(counts.failing || 0) > 0 && (
            <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium">{counts.failing} failing</span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filterBtns.map(btn => (
          <button
            key={btn.key}
            onClick={() => setActiveFilter(btn.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === btn.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Controls grouped by category */}
      <div className="space-y-6">
        {Object.entries(byCategory).map(([category, controls]) => {
          const isCollapsed = collapsedCategories.has(category);
          const catWarnings = controls.filter(c => c.status === 'warning').length;
          const catFailing = controls.filter(c => c.status === 'failing').length;

          return (
            <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  <span className="font-semibold text-gray-800">{category}</span>
                  <span className="text-xs text-gray-500">({controls.length} controls)</span>
                </div>
                <div className="flex gap-2 text-xs">
                  {catFailing > 0 && <span className="text-red-600 font-medium">{catFailing} failing</span>}
                  {catWarnings > 0 && <span className="text-yellow-600 font-medium">{catWarnings} warning</span>}
                </div>
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {controls.map(control => {
                    const config = STATUS_CONFIG[control.status];
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={control.id}
                        className={`rounded-lg border-2 p-3 hover:shadow-md transition-shadow ${config.borderColor}`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-0.5">{control.name}</h3>
                            <p className="text-xs text-gray-400">{control.framework}</p>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-2 leading-snug">{control.description}</p>

                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-lg font-bold text-blue-600">{control.evidenceCount}</span>
                            <span className="text-xs text-gray-500 ml-1">evidence</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {control.lastChecked}
                          </span>
                        </div>

                        {control.warningText && (
                          <div className={`mt-2 text-xs p-1.5 rounded ${config.bgColor} ${config.color}`}>
                            {control.warningText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}