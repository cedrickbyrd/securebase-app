import React from 'react';

export default function ControlsList() {
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

  return (
    <div className="sb-ControlsList">
      <div className="sb-ControlsList__header">
        <h2>Active Controls</h2>
        <span className="u-text-muted">{controls.length} controls monitored</span>
      </div>

      <div className="sb-ControlsList__grid">
        {controls.map(control => (
          <ControlCard key={control.id} control={control} />
        ))}
      </div>
    </div>
  );
}

function ControlCard({ control }) {
  const statusIcon = {
    passing: '✅',
    warning: '⚠️',
    failing: '❌'
  };

  return (
    <div className={`sb-ControlCard sb-ControlCard--${control.status}`}>
      <div className="sb-ControlCard__header">
        <span className="sb-ControlCard__status">
          {statusIcon[control.status]}
        </span>
        <div className="sb-ControlCard__title">
          <h3>{control.name}</h3>
          <span className="u-text-muted">{control.framework}</span>
        </div>
      </div>

      <div className="sb-ControlCard__metrics">
        <div className="sb-ControlCard__metric">
          <span className="sb-ControlCard__metricValue">{control.evidenceCount}</span>
          <span className="sb-ControlCard__metricLabel">evidence items</span>
        </div>
        <div className="sb-ControlCard__timestamp u-text-muted">
          Last checked: {control.lastChecked}
        </div>
      </div>

      {control.warningText && (
        <div className="sb-ControlCard__warning">
          {control.warningText}
        </div>
      )}
    </div>
  );
}
