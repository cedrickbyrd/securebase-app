import React from 'react';
import ComplianceStatus from './ComplianceStatus';
import ControlsList from './ControlsList';
import ExportEvidence from './ExportEvidence';

export default function ComplianceScreen() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Compliance Overview</h1>
          <p className="text-gray-600 mt-1">
            Real-time security posture and audit readiness
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ComplianceStatus />
        <ControlsList />
        <ExportEvidence />
      </div>
    </div>
  );
}