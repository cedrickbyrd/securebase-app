import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function ControlsList() {
  // Demo data - hardcoded for now
  const controls = [
    {
      id: 'cc6-1',
      name: 'Access Control',
      framework: 'SOC 2 CC6.1',
      status: 'passing',
      evidenceCount: 47,
      lastChecked: '1 hour ago'
    },
    {
      id: 'cc7-2',
      name: 'Log Retention',
      framework: 'SOC 2 CC7.2',
      status: 'passing',
      evidenceCount: 203,
      lastChecked: '30 minutes ago'
    },
    {
      id: 'cc6-7',
      name: 'Encryption at Rest',
      framework: 'SOC 2 CC6.7',
      status: 'warning',
      evidenceCount: 12,
      lastChecked: '2 hours ago',
      warningText: '2 resources missing encryption'
    },
    {
      id: 'cc7-4',
      name: 'Security Monitoring',
      framework: 'SOC 2 CC7.4',
      status: 'passing',
      evidenceCount: 89,
      lastChecked: '15 minutes ago'
    },
    {
      id: 'cc8-1',
      name: 'Change Management',
      framework: 'SOC 2 CC8.1',
      status: 'passing',
      evidenceCount: 34,
      lastChecked: '3 hours ago'
    }
  ];

  const statusConfig = {
    passing: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    failing: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Active Controls</h2>
        <span className="text-sm text-gray-500">{controls.length} controls monitored</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {controls.map(control => {
          const config = statusConfig[control.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={control.id}
              className={`bg-white rounded-lg border-2 p-4 hover:shadow-md transition-shadow ${config.borderColor}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <StatusIcon className={`w-6 h-6 mt-0.5 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{control.name}</h3>
                  <p className="text-xs text-gray-500">{control.framework}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{control.evidenceCount}</div>
                    <div className="text-xs text-gray-500">evidence items</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last checked: {control.lastChecked}
                  </div>
                </div>

                {control.warningText && (
                  <div className={`text-xs p-2 rounded ${config.bgColor} ${config.color}`}>
                    {control.warningText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}