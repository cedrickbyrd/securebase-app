import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoAwareApiService } from '../services/demoApiService';
import { isDemoMode } from '../utils/demoData';
import BRANDING from '../config/branding';

const CONTROL_ICONS = {
  'TX-MT-R1': '📋',
  'TX-MT-R2a': '💵',
  'TX-MT-R2b': '🚨',
  'TX-MT-R3': '🪪',
  'TX-MT-R4': '🔐',
  'TX-DASP-R1': '🪙'
};

function formatCurrency(amount) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString();
}

function StatusBadge({ status }) {
  const color =
    status === 'passing' || status === 'completed'
      ? '#10b981'
      : status === 'warning'
      ? '#f59e0b'
      : '#ef4444';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '12px',
        backgroundColor: color + '22',
        color,
        fontWeight: 600,
        fontSize: '0.78rem',
        textTransform: 'capitalize'
      }}
    >
      {status}
    </span>
  );
}

export default function TexasExaminerPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const customerId = localStorage.getItem('customerId');
      const [complianceResp, txResp] = await Promise.all([
        demoAwareApiService.getFintechComplianceStatus(customerId),
        demoAwareApiService.getFintechTransactions({ customerId, limit: 50 })
      ]);

      setComplianceData(complianceResp.data);
      setTransactions(txResp.data?.transactions || []);
      setTxTotal(txResp.data?.total || 0);
    } catch (err) {
      console.error('Error loading Texas compliance data:', err);
      setError('Failed to load Texas DOB compliance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
          <p style={{ color: '#6b7280' }}>Loading Texas DOB compliance data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '1rem', color: '#dc2626' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  const passRate = complianceData
    ? Math.round((complianceData.passingControls / complianceData.totalControls) * 100)
    : 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: '#1e3a5f', color: 'white', padding: '1rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: 'white', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
                ⚖️ Texas DOB Examiner Portal
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                {BRANDING.productShortName} · Texas Department of Banking · Money Transmitter Compliance
              </p>
            </div>
          </div>
          {isDemoMode() && (
            <span style={{ background: '#fbbf24', color: '#78350f', borderRadius: 6, padding: '4px 12px', fontWeight: 600, fontSize: '0.8rem' }}>
              🎯 Demo Mode
            </span>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        {/* Score Banner */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)', borderRadius: 12, padding: '2rem', color: 'white', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', opacity: 0.85 }}>Texas DOB Compliance Score</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              <span style={{ fontSize: '4rem', fontWeight: 800, lineHeight: 1 }}>{passRate}%</span>
              <span style={{ opacity: 0.8 }}>
                ({complianceData?.passingControls}/{complianceData?.totalControls} controls passing)
              </span>
            </div>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.75, fontSize: '0.9rem' }}>
              7 TAC §33 · 31 CFR §1022 · TX HB 1666
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '5rem' }}>⭐</div>
            <span style={{ background: '#10b981', borderRadius: 20, padding: '4px 16px', fontSize: '0.85rem', fontWeight: 700 }}>
              COMPLIANT
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          {[
            { id: 'overview', label: '📊 Controls Overview' },
            { id: 'transactions', label: '📋 Transaction Records (TX-MT-R1)' },
            { id: 'aml', label: '🚨 CTR / SAR Evidence' },
            { id: 'evidence', label: '🗄️ Evidence Vault' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                background: activeTab === tab.id ? '#1e3a5f' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#4b5563',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Controls Overview ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(complianceData?.controls || []).map(control => (
              <div key={control.id} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>{CONTROL_ICONS[control.id] || '📌'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e3a5f' }}>{control.id}</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{control.name}</span>
                    <StatusBadge status={control.status} />
                  </div>
                  <p style={{ margin: '0 0 0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                    📜 {control.regulationRef}
                  </p>
                  <p style={{ margin: 0, color: '#374151', fontSize: '0.925rem' }}>{control.summary}</p>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', flexShrink: 0, textAlign: 'right' }}>
                  Last assessed<br />
                  {formatDate(control.lastAssessedAt)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: Transaction Records ── */}
        {activeTab === 'transactions' && (
          <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e3a5f' }}>Transaction Records</h3>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  {txTotal.toLocaleString()} total records · 7 TAC §33.35 evidence
                </p>
              </div>
              <button
                style={{ background: '#1e3a5f', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                onClick={() => alert('Evidence package download triggered (see Evidence Vault)')}
              >
                ⬇️ Export Evidence
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Timestamp', 'Customer Name', 'Amount', 'Type', 'Payment Method', 'Receipt #', 'Status'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={tx.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '10px 16px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>{tx.customer_name}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: tx.amount >= 10000 ? '#dc2626' : '#374151' }}>
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        {tx.amount >= 10000 && <span style={{ marginLeft: 4, fontSize: '0.7rem', color: '#dc2626' }}>CTR</span>}
                      </td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize', color: '#6b7280' }}>
                        {tx.transaction_type?.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize', color: '#6b7280' }}>
                        {tx.payment_method?.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>
                        {tx.receipt_number}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <StatusBadge status={tx.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: CTR / SAR Evidence ── */}
        {activeTab === 'aml' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* CTR Summary */}
            {complianceData?.controls?.filter(c => c.id === 'TX-MT-R2a').map(ctrl => (
              <div key={ctrl.id} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>💵</span>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e3a5f' }}>{ctrl.id} — Currency Transaction Reports</h3>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>{ctrl.regulationRef}</p>
                  </div>
                  <StatusBadge status={ctrl.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'CTRs Filed (90d)', value: ctrl.metrics?.ctrsFiledCount ?? '—' },
                    { label: 'Missing CTRs', value: ctrl.metrics?.missingCtrs ?? 0 },
                    { label: 'Avg Days to File', value: ctrl.metrics?.avgDaysToFile ?? '—' },
                    { label: 'Filed On Time', value: ctrl.metrics?.filedOnTime ?? '—' }
                  ].map(stat => (
                    <div key={stat.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e3a5f' }}>{stat.value}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* SAR Summary */}
            {complianceData?.controls?.filter(c => c.id === 'TX-MT-R2b').map(ctrl => (
              <div key={ctrl.id} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>🚨</span>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e3a5f' }}>{ctrl.id} — Suspicious Activity Reports</h3>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>{ctrl.regulationRef}</p>
                  </div>
                  <StatusBadge status={ctrl.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'SARs Filed', value: ctrl.metrics?.sarsFiledCount ?? '—' },
                    { label: 'Open AML Alerts', value: ctrl.metrics?.openAlerts ?? 0 },
                    { label: 'Avg Days to Disposition', value: ctrl.metrics?.avgDaysToDisposition ?? '—' },
                    { label: 'Disposition Rate', value: ctrl.metrics?.dispositionRate ? `${ctrl.metrics.dispositionRate}%` : '—' }
                  ].map(stat => (
                    <div key={stat.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e3a5f' }}>{stat.value}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: Evidence Vault ── */}
        {activeTab === 'evidence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#1e3a5f' }}>🗄️ Evidence Vault — S3 Object Lock (Compliance Mode)</h3>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
                All evidence is stored with 5-year Object Lock retention, KMS encryption, and KMS signing for non-repudiation.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { source: 'Transaction Database', path: 'evidence/{customer_id}/fintech/{date}/tx_records.json', controls: 2, icon: '📋' },
                  { source: 'AML System', path: 'evidence/{customer_id}/fintech/{date}/aml_evidence.json', controls: 2, icon: '🚨' },
                  { source: 'CIP Records', path: 'evidence/{customer_id}/fintech/{date}/cip_records.json', controls: 1, icon: '🪪' }
                ].map(item => (
                  <div key={item.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: 8, gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#374151' }}>{item.source}</div>
                        <code style={{ fontSize: '0.78rem', color: '#6b7280' }}>{item.path}</code>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.controls} control{item.controls > 1 ? 's' : ''}</span>
                      <StatusBadge status="passing" />
                      <button
                        style={{ background: '#1e3a5f', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        onClick={() => alert(`Evidence package download requested for ${item.source}`)}
                      >
                        ⬇️ Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#78350f' }}>
              <strong>📋 Examiner Package:</strong> All evidence packages are KMS-signed and include a manifest with SHA-256 hashes.
              {isDemoMode() && ' (Demo mode — S3 downloads are simulated.)'}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
