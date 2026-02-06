import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function ComplianceStatus() {
  // Demo data - hardcoded for now
  const status = {
    state: 'ready', // 'ready' | 'warning' | 'critical'
    label: 'Ready for Audit',
    lastUpdated: '2 hours ago',
    framework: 'SOC 2 Type II'
  };

  const statusColors = {
    ready: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200'
  };

  const badgeColors = {
    ready: 'text-green-700',
    warning: 'text-yellow-700',
    critical: 'text-red-700'
  };

  return (
    <div className={`rounded-lg border-2 p-6 mb-8 ${statusColors[status.state]}`}> 
      <div className="flex items-center gap-3 mb-3">
        <CheckCircle2 className={`w-8 h-8 ${badgeColors[status.state]}`} />
        <span className={`text-2xl font-bold ${badgeColors[status.state]}`}> 
          {status.label}
        </span>
      </div>
      
      <div className="flex gap-6 text-sm text-gray-600">
        <span>Framework: <strong>{status.framework}</strong></span>
        <span>Last updated: <strong>{status.lastUpdated}</strong></span>
      </div>
    </div>
  );
}