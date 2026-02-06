import React from 'react';

export default function ComplianceStatus() {
  const status = {
    state: 'ready',
    label: 'Ready for Audit',
    lastUpdated: '2 hours ago',
    framework: 'SOC 2 Type II'
  };

  return (
    <div className="sb-ComplianceStatus">
      <div className="sb-ComplianceStatus__badge sb-ComplianceStatus__badge--ready">
        <span className="sb-ComplianceStatus__icon">✅</span>
        <span className="sb-ComplianceStatus__label">{status.label}</span>
      </div>
      
      <div className="sb-ComplianceStatus__meta">
        <span className="u-text-muted">Framework: {status.framework}</span>
        <span className="u-text-muted">Last updated: {status.lastUpdated}</span>
      </div>
    </div>
  );
}
