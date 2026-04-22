import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sreService } from '../services/sreService';
import { trackPageView, trackHIPAARoute } from '../utils/analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Delay (ms) before the export download triggers — gives the UX spinner time to render */
const EXPORT_GENERATION_DELAY_MS = 1200;

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

function SeverityPill({ severity }) {
  const map = {
    high: { bg: '#fee2e2', color: '#991b1b' },
    medium: { bg: '#fef3c7', color: '#92400e' },
    low: { bg: '#dbeafe', color: '#1e40af' }
  };
  const s = map[severity] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 999, background: s.bg, color: s.color, fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize' }}>
      {severity}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSafeguard, setActiveSafeguard] = useState('administrative');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await sreService.getHIPAACompliance();
      setData(result);
    } catch (err) {
      console.error('Failed to load HIPAA compliance data:', err);
      setError('Failed to load HIPAA compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    trackPageView('HIPAA Dashboard', '/hipaa-dashboard');
    trackHIPAARoute('/hipaa-dashboard', 'view');
    loadData();
  }, [loadData]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackHIPAARoute(`/hipaa-dashboard#${tab}`, 'tab_change');
  };

  const handleExport = () => {
    setExporting(true);
    trackHIPAARoute('/hipaa-dashboard', 'evidence_export');

    setTimeout(() => {
      const report = generateAuditorReport(data);
      const blob = new Blob([report], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HIPAA-Compliance-Report-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExporting(false);
    }, EXPORT_GENERATION_DELAY_MS);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏥</div>
          <p style={{ color: '#6b7280' }}>Loading HIPAA compliance data…</p>
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
      <header style={{ background: 'linear-gradient(135deg, #0f4c81 0%, #1a73e8 100%)', color: '#fff', padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 8, fontSize: '0.85rem' }}
              >
                ← Dashboard
              </button>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>🏥 HIPAA Compliance Dashboard</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
                HealthCorp Medical Systems · Last assessment: {formatDate(data.lastAssessmentDate)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.75rem 1.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{data.overallScore}%</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>Overall Score</div>
              </div>
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '0.75rem 1.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'capitalize', lineHeight: 1 }}>{data.riskLevel}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>Risk Level</div>
              </div>
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
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'safeguards' && <SafeguardsTab data={data} activeSafeguard={activeSafeguard} setActiveSafeguard={setActiveSafeguard} />}
        {activeTab === 'phi' && <PHITab data={data} />}
        {activeTab === 'findings' && <FindingsTab data={data} />}
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

function FindingsTab({ data }) {
  const { findings } = data;

  const criticalCount = findings.filter(f => f.severity === 'high' && f.status === 'open').length;
  const openCount = findings.filter(f => f.status === 'open').length;
  const inProgressCount = findings.filter(f => f.status === 'in_progress').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Findings', value: findings.length, color: '#374151', bg: '#f3f4f6' },
          { label: 'Open', value: openCount, color: '#dc2626', bg: '#fee2e2' },
          { label: 'In Progress', value: inProgressCount, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'High Severity', value: criticalCount, color: '#dc2626', bg: '#fee2e2' }
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, background: s.bg, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Finding cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {findings.map(f => (
          <div key={f.id} style={{ ...cardStyle, borderLeft: `4px solid ${f.severity === 'high' ? '#ef4444' : f.severity === 'medium' ? '#f59e0b' : '#3b82f6'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <SeverityPill severity={f.severity} />
                  <StatusPill status={f.status} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>{f.control}</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{f.title}</h3>
                <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#374151' }}>
                  <strong>Remediation:</strong> {f.remediation}
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                  Owner: {f.owner} · Open {f.daysOpen} day{f.daysOpen !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
              Download a comprehensive HTML report suitable for HIPAA auditors and OCR investigations.
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

function generateAuditorReport(data) {
  const now = new Date().toLocaleString();
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
  <title>HIPAA Compliance Evidence Report</title>
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
  <h1>🏥 HIPAA Compliance Evidence Report</h1>
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
    <p>Generated by SecureBase HIPAA Compliance Dashboard · All data is current as of the above timestamp.</p>
    <p>For questions, contact compliance@healthcorp.example.com</p>
  </footer>
</body>
</html>`;
}
