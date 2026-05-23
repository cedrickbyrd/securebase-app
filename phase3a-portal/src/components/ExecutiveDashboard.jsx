import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isDemoMode } from '../utils/demoData';
import './Dashboard.css';

const FRAMEWORK_META = {
  hipaa: { name: 'HIPAA', icon: '🏥', color: '#0f4c81' },
  soc2: { name: 'SOC 2', icon: '🔐', color: '#7c3aed' },
  pcidss: { name: 'PCI-DSS', icon: '💳', color: '#0d9488' },
};

const MOCK_USERS = [
  { email: 'demo@securebase.tximhotep.com', role: 'admin' },
  { email: 'matthew.matturro@trinetx.com', role: 'admin' },
  { email: 'sarah.chen@trinetx.com', role: 'analyst' },
  { email: 'david.park@trinetx.com', role: 'auditor' },
];

const MOCK_FRAMEWORKS = [
  { id: 'hipaa', score: 84, high_findings: 4, trend: [71, 74, 76, 79, 81, 83, 84] },
  { id: 'soc2', score: 76, high_findings: 6, trend: [68, 71, 74, 76] },
  { id: 'pcidss', score: 91, high_findings: 1, trend: [85, 87, 89, 91] },
];

const MOCK_FINDINGS_BY_FRAMEWORK = {
  hipaa: [
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'high' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'medium' },
  ],
  soc2: [
    { severity: 'high' },
    { severity: 'high' },
    { severity: 'medium' },
  ],
  pcidss: [
    { severity: 'critical' },
    { severity: 'medium' },
  ],
};

function getTokenHeaders() {
  const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSparklinePath(values, width, height) {
  if (!Array.isArray(values) || values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xStep = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((value, index) => {
    const x = index * xStep;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

function buildFrameworkRows(frameworks, findingsByFramework) {
  return frameworks.map((framework) => {
    const id = String(framework.id || '').toLowerCase();
    const findings = findingsByFramework[id] || [];
    const critical = findings.filter((finding) => String(finding.severity).toLowerCase() === 'critical').length;
    const high = findings.filter((finding) => String(finding.severity).toLowerCase() === 'high').length;
    const medium = findings.filter((finding) => String(finding.severity).toLowerCase() === 'medium').length;
    return {
      framework: FRAMEWORK_META[id]?.name || framework.name || id.toUpperCase(),
      critical,
      high,
      medium,
      total: critical + high + medium,
    };
  });
}

function generateBoardReportHTML(org, dateLabel, frameworks, findingsRows) {
  const safeOrg = escHtml(org);
  const safeDate = escHtml(dateLabel);
  const totalScore = Math.round(frameworks.reduce((acc, framework) => acc + Number(framework.score || 0), 0) / Math.max(frameworks.length, 1));
  const total = findingsRows.reduce((acc, row) => ({
    critical: acc.critical + row.critical,
    high: acc.high + row.high,
    medium: acc.medium + row.medium,
    total: acc.total + row.total,
  }), { critical: 0, high: 0, medium: 0, total: 0 });

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${safeOrg} — Board Compliance Report ${safeDate}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; color: #111827; }
    .cover { text-align: center; padding: 60px 0; border-bottom: 3px solid #0f4c81; margin-bottom: 40px; }
    .cover h1 { font-size: 2rem; color: #0f4c81; margin-bottom: 0.5rem; }
    .score-hero { font-size: 5rem; font-weight: 900; color: #0f4c81; }
    .framework-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
    .fw-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; }
    .fw-score { font-size: 2.5rem; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #0f4c81; color: white; padding: 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    .critical-cell { background: #fee2e2; color: #991b1b; font-weight: 700; text-align: center; }
    .high-cell { background: #fef3c7; color: #92400e; font-weight: 700; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${safeOrg}</h1>
    <p>Compliance Status Report · ${safeDate}</p>
    <div class="score-hero">${totalScore}%</div>
    <p>Overall Compliance Score · ${frameworks.length} Frameworks Monitored</p>
  </div>

  <div class="framework-grid">
    ${frameworks.map((framework) => {
      const id = String(framework.id || '').toLowerCase();
      return `<div class="fw-card">
        <div>${escHtml(FRAMEWORK_META[id]?.icon || '📘')} ${escHtml(FRAMEWORK_META[id]?.name || framework.name || id)}</div>
        <div class="fw-score">${Math.round(Number(framework.score || 0))}%</div>
      </div>`;
    }).join('')}
  </div>

  <h2>Open Findings by Severity</h2>
  <table>
    <thead>
      <tr><th>Framework</th><th>Crit</th><th>High</th><th>Medium</th><th>Total</th></tr>
    </thead>
    <tbody>
      ${findingsRows.map((row) => `<tr>
        <td>${escHtml(row.framework)}</td>
        <td class="${row.critical > 0 ? 'critical-cell' : ''}">${row.critical}</td>
        <td class="${row.high > 0 ? 'high-cell' : ''}">${row.high}</td>
        <td>${row.medium}</td>
        <td>${row.total}</td>
      </tr>`).join('')}
      <tr style="font-weight:700;background:#f8fafc">
        <td>Total</td>
        <td>${total.critical}</td>
        <td>${total.high}</td>
        <td>${total.medium}</td>
        <td>${total.total}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);
  const [frameworks, setFrameworks] = useState(MOCK_FRAMEWORKS);
  const [findingsByFramework, setFindingsByFramework] = useState(MOCK_FINDINGS_BY_FRAMEWORK);
  const [openFindingsCount, setOpenFindingsCount] = useState(11);
  const [lastAssessed, setLastAssessed] = useState(new Date().toISOString());
  const [overallScore, setOverallScore] = useState(84);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [ringOffset, setRingOffset] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);

  const orgName = localStorage.getItem('orgName') || 'Your Organization';
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const onChange = (event) => setIsMobile(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    let active = true;
    const currentUserEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
    const loadAdmin = async () => {
      try {
        const response = await fetch('/api/users', { headers: getTokenHeaders() });
        if (!response.ok) throw new Error(`users_fetch_failed:${response.status}`);
        const users = await response.json();
        const matched = (Array.isArray(users) ? users : []).find(
          (user) => String(user.email || '').toLowerCase() === currentUserEmail,
        );
        if (active) setIsAdmin(String(matched?.role || '').toLowerCase() === 'admin');
      } catch {
        const matched = MOCK_USERS.find((user) => user.email.toLowerCase() === currentUserEmail);
        if (active) setIsAdmin(String(matched?.role || '').toLowerCase() === 'admin');
      }
    };
    loadAdmin();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const frameworkIds = ['hipaa', 'soc2', 'pcidss'];
    const loadSummary = async () => {
      try {
        const response = await fetch('/api/executive/summary', { headers: getTokenHeaders() });
        if (!response.ok) throw new Error(`executive_summary_failed:${response.status}`);
        const payload = await response.json();
        const normalizedFrameworks = (Array.isArray(payload.frameworks) ? payload.frameworks : MOCK_FRAMEWORKS).map((framework) => {
          const id = String(framework.id || framework.framework || '').toLowerCase();
          const fallback = MOCK_FRAMEWORKS.find((item) => item.id === id) || MOCK_FRAMEWORKS[0];
          return {
            ...fallback,
            ...framework,
            id: id || fallback.id,
            score: Number.isFinite(Number(framework.score)) ? Number(framework.score) : fallback.score,
            trend: Array.isArray(framework.trend) && framework.trend.length > 0 ? framework.trend : fallback.trend,
          };
        });

        const findingsPairs = await Promise.all(frameworkIds.map(async (id) => {
          try {
            const findingsRes = await fetch(`/api/${id}/findings`, { headers: getTokenHeaders() });
            if (!findingsRes.ok) throw new Error('findings_failed');
            const findingsPayload = await findingsRes.json();
            const findings = Array.isArray(findingsPayload)
              ? findingsPayload
              : findingsPayload?.findings || findingsPayload?.data || [];
            return [id, findings];
          } catch {
            return [id, MOCK_FINDINGS_BY_FRAMEWORK[id] || []];
          }
        }));

        if (!active) return;
        const findingsMap = Object.fromEntries(findingsPairs);
        setFrameworks(normalizedFrameworks);
        setFindingsByFramework(findingsMap);
        setOpenFindingsCount(
          Number.isFinite(Number(payload.open_findings_count))
            ? Number(payload.open_findings_count)
            : Object.values(findingsMap).flat().length,
        );
        setLastAssessed(payload.last_assessed || new Date().toISOString());
      } catch {
        if (!active) return;
        setFrameworks(MOCK_FRAMEWORKS);
        setFindingsByFramework(MOCK_FINDINGS_BY_FRAMEWORK);
        setOpenFindingsCount(Object.values(MOCK_FINDINGS_BY_FRAMEWORK).flat().length);
        setLastAssessed(new Date().toISOString());
      }
    };
    loadSummary();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const nextScore = Math.round(frameworks.reduce((acc, framework) => acc + Number(framework.score || 0), 0) / Math.max(frameworks.length, 1));
    setOverallScore(nextScore);
  }, [frameworks]);

  useEffect(() => {
    let step = 0;
    const steps = 30;
    setAnimatedScore(0);
    const interval = window.setInterval(() => {
      step += 1;
      const next = Math.round((overallScore * step) / steps);
      setAnimatedScore(step >= steps ? overallScore : next);
      if (step >= steps) {
        window.clearInterval(interval);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [overallScore]);

  const circleRadius = isMobile ? 48 : 60;
  const circumference = 2 * Math.PI * circleRadius;

  useEffect(() => {
    setRingOffset(circumference);
    const timeout = window.setTimeout(() => {
      setRingOffset(circumference - (Math.max(0, Math.min(overallScore, 100)) / 100) * circumference);
    }, 40);
    return () => window.clearTimeout(timeout);
  }, [circumference, overallScore]);

  const findingsRows = useMemo(
    () => buildFrameworkRows(frameworks, findingsByFramework),
    [frameworks, findingsByFramework],
  );

  const totals = useMemo(() => findingsRows.reduce((acc, row) => ({
    critical: acc.critical + row.critical,
    high: acc.high + row.high,
    medium: acc.medium + row.medium,
    total: acc.total + row.total,
  }), { critical: 0, high: 0, medium: 0, total: 0 }), [findingsRows]);

  const lastAssessedLabel = (() => {
    const parsed = new Date(lastAssessed);
    if (Number.isNaN(parsed.getTime())) return 'today';
    const today = new Date();
    const isToday = parsed.toDateString() === today.toDateString();
    return isToday ? 'today' : parsed.toLocaleDateString('en-US');
  })();

  if (isAdmin === null) {
    return <div className="dashboard-loading"><div className="spinner" /><p>Loading executive dashboard…</p></div>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button type="button" onClick={() => navigate('/dashboard')} className="view-all-btn" style={{ marginBottom: '0.25rem' }}>
              ← Dashboard
            </button>
            <h1>📊 Executive View</h1>
            <p>{orgName} · Board-ready compliance summary</p>
          </div>
          <button
            type="button"
            className="board-report-btn"
            style={{ background: '#0f4c81', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1rem', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => {
              const reportWindow = window.open('', '_blank');
              if (!reportWindow) return;
              reportWindow.document.write(generateBoardReportHTML(orgName, todayLabel, frameworks, findingsRows));
              reportWindow.document.close();
              reportWindow.print();
            }}
          >
            Download Board Report
          </button>
          {isDemoMode() && (
            <a
              href="https://securebase.tximhotep.com/pricing"
              className="mt-2 text-sm font-semibold text-[#0f4c81] hover:underline"
            >
              Ready to deploy? See pricing →
            </a>
          )}
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-card executive-hero-card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>{orgName} Compliance Summary</h2>
            <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '1rem' }}>As of {todayLabel}</p>
            <p style={{ margin: 0, color: '#374151', fontWeight: 600 }}>Overall Risk Score</p>
            <div className="score-circle-wrapper" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0 0.25rem', position: 'relative' }}>
              <svg width={isMobile ? 132 : 160} height={isMobile ? 132 : 160} viewBox={`0 0 ${isMobile ? 132 : 160} ${isMobile ? 132 : 160}`}>
                <circle
                  cx={isMobile ? 66 : 80}
                  cy={isMobile ? 66 : 80}
                  r={circleRadius}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx={isMobile ? 66 : 80}
                  cy={isMobile ? 66 : 80}
                  r={circleRadius}
                  fill="none"
                  stroke="#0f4c81"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={ringOffset}
                  transform={`rotate(-90 ${isMobile ? 66 : 80} ${isMobile ? 66 : 80})`}
                  style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '2rem' : '2.4rem', fontWeight: 800, color: '#0f4c81', lineHeight: 1 }}>
                  {animatedScore}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>/ 100</div>
              </div>
            </div>
            <div style={{ maxWidth: 440, margin: '0.75rem auto 0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.2rem' }}>
                <span>LOW RISK</span>
                <span>CRITICAL</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: 'linear-gradient(to right, #16a34a, #dc2626)', position: 'relative' }}>
                <span
                  aria-label="Risk score marker"
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: `${Math.max(0, Math.min(overallScore, 100))}%`,
                    transform: 'translateX(-50%)',
                    width: 2,
                    height: 24,
                    background: '#111827',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            <p style={{ margin: 0, color: '#4b5563' }}>
              {frameworks.length} frameworks monitored · {openFindingsCount} open findings · Last assessed: {lastAssessedLabel}
            </p>
          </div>
        </section>

        <section className="exec-framework-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {frameworks.map((framework) => {
            const id = String(framework.id || '').toLowerCase();
            const trend = Array.isArray(framework.trend) && framework.trend.length > 0 ? framework.trend : [framework.score];
            const delta = trend.length > 1 ? trend[trend.length - 1] - trend[0] : 0;
            const path = generateSparklinePath(trend, 280, 34);
            return (
              <button
                key={id}
                type="button"
                className="framework-card"
                onClick={() => {
                  localStorage.setItem('active_framework', id);
                  navigate('/compliance');
                }}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{FRAMEWORK_META[id]?.icon} {FRAMEWORK_META[id]?.name || framework.name}</div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: FRAMEWORK_META[id]?.color || '#0f4c81' }}>
                    {Math.round(Number(framework.score || 0))}%
                  </div>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginTop: '0.4rem',
                    borderRadius: 999,
                    padding: '0.15rem 0.55rem',
                    background: delta >= 0 ? '#dcfce7' : '#fee2e2',
                    color: delta >= 0 ? '#166534' : '#991b1b',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {delta >= 0 ? `↑ +${Math.abs(Math.round(delta))} pts` : `↓ -${Math.abs(Math.round(delta))} pts`}
                </div>
                <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.82rem' }}>
                  {framework.high_findings || 0} high
                </p>
                <svg width="100%" height="40" viewBox="0 0 280 34" style={{ marginTop: '0.5rem' }} role="img" aria-label={`${FRAMEWORK_META[id]?.name || framework.name} trend sparkline`}>
                  <path d={path} fill="none" stroke={FRAMEWORK_META[id]?.color || '#0f4c81'} strokeWidth="2.5" />
                </svg>
              </button>
            );
          })}
        </section>

        <section className="dashboard-card">
          <div className="card-content">
            <h2 style={{ marginTop: 0 }}>Open Findings by Severity</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="team-table" aria-label="Open findings by severity">
                <thead>
                  <tr>
                    <th>Framework</th>
                    <th>Crit</th>
                    <th>High</th>
                    <th>Medium</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {findingsRows.map((row) => (
                    <tr key={row.framework}>
                      <td>{row.framework}</td>
                      <td style={row.critical > 0 ? { background: '#fee2e2', color: '#991b1b', fontWeight: 700, textAlign: 'center' } : { textAlign: 'center' }}>{row.critical}</td>
                      <td style={row.high > 0 ? { background: '#fef3c7', color: '#92400e', fontWeight: 700, textAlign: 'center' } : { textAlign: 'center' }}>{row.high}</td>
                      <td style={{ textAlign: 'center' }}>{row.medium}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.total}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                    <td>Total</td>
                    <td style={{ textAlign: 'center' }}>{totals.critical}</td>
                    <td style={{ textAlign: 'center' }}>{totals.high}</td>
                    <td style={{ textAlign: 'center' }}>{totals.medium}</td>
                    <td style={{ textAlign: 'center' }}>{totals.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
