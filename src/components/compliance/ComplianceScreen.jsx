import React from 'react';
import ComplianceStatus from './ComplianceStatus';
import ControlsList from './ControlsList';
import ExportEvidence from './ExportEvidence';

export default function ComplianceScreen() {
  return (
    <div className="sb-ComplianceScreen">
      <div className="sb-ComplianceScreen__header">
        <h1>Compliance Overview</h1>
        <p className="u-text-muted">
          Real-time security posture and audit readiness
        </p>
      </div>

      <ComplianceStatus />
      <ControlsList />
      <ExportEvidence />
    </div>
  );
}