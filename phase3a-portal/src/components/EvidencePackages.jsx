import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Download, RefreshCw, CheckCircle2, AlertCircle,
  Clock, Package, Lock, FileText, ChevronRight, Loader
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const STATUS_CONFIG = {
  complete:    { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle2, label: 'Complete' },
  generating:  { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Loader,       label: 'Generating' },
  failed:      { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertCircle,  label: 'Failed' },
  pending:     { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Clock,        label: 'Pending' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-3 h-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function PackageRow({ pkg, onDownload, downloading }) {
  const isDownloading = downloading === pkg.id;
  const canDownload = pkg.status === 'complete';

  return (
    <div className="flex items-center justify-between py-4 px-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5 p-2 bg-blue-50 rounded-lg flex-shrink-0">
          <Package className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {pkg.package_name || `Evidence Package — ${pkg.id.slice(0, 8)}`}
            </span>
            <StatusBadge status={pkg.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {pkg.created_at
                ? new Date(pkg.created_at).toLocaleString()
                : '—'}
            </span>
            {pkg.framework && (
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {pkg.framework}
              </span>
            )}
            {pkg.log_count != null && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {pkg.log_count.toLocaleString()} logs
              </span>
            )}
          </div>
          {pkg.sha256_manifest && (
            <div className="mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-gray-400" />
              <span className="font-mono text-xs text-gray-400 truncate max-w-xs">
                SHA-256: {pkg.sha256_manifest}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => canDownload && onDownload(pkg.id)}
        disabled={!canDownload || isDownloading}
        className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
          disabled:opacity-40 disabled:cursor-not-allowed
          enabled:hover:-translate-y-0.5
          bg-blue-600 text-white hover:bg-blue-700
          flex-shrink-0"
        title={canDownload ? 'Download evidence package' : 'Package not ready'}
      >
        {isDownloading
          ? <Loader className="w-4 h-4 animate-spin" />
          : <Download className="w-4 h-4" />}
        <span>{isDownloading ? 'Downloading…' : 'Download'}</span>
      </button>
    </div>
  );
}

export default function EvidencePackages() {
  const [packages, setPackages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [genError, setGenError]   = useState(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/evidence`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPackages(data.packages || data || []);
    } catch (err) {
      console.error('Evidence fetch error:', err);
      setError('Unable to load evidence packages. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  // Auto-refresh while any package is generating
  useEffect(() => {
    const hasGenerating = packages.some(p => p.status === 'generating' || p.status === 'pending');
    if (!hasGenerating) return;
    const t = setTimeout(fetchPackages, 8000);
    return () => clearTimeout(t);
  }, [packages, fetchPackages]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setGenSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/admin/evidence/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ framework: 'HIPAA' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGenSuccess(true);
      setTimeout(() => setGenSuccess(false), 5000);
      await fetchPackages();
    } catch (err) {
      console.error('Generate error:', err);
      setGenError('Failed to generate evidence package. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (packageId) => {
    setDownloading(packageId);
    try {
      const res = await fetch(`${API_BASE}/admin/evidence/${packageId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const url = data.download_url || data.presigned_url;
      if (!url) throw new Error('No download URL returned');
      const a = document.createElement('a');
      a.href = url;
      a.download = data.package_name || `evidence-${packageId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Audit Evidence Packages
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cryptographically signed, tamper-evident evidence packages ready for auditor delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPackages}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
          >
            {generating
              ? <><Loader className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Package className="w-4 h-4" /> Generate Evidence Package</>}
          </button>
        </div>
      </div>

      {/* Integrity notice */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">WORM Evidence Storage</p>
          <p className="text-xs text-blue-700 mt-0.5">
            All packages are stored with S3 Object Lock in COMPLIANCE mode (7-year retention).
            Each package includes a SHA-256 manifest signed via AWS KMS.
            No one — including root — can delete or alter these records.
          </p>
        </div>
      </div>

      {/* Generation feedback */}
      {genSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-900">
            Evidence package generation started. It will appear below when ready.
          </p>
        </div>
      )}
      {genError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium text-red-900">{genError}</p>
        </div>
      )}

      {/* Package list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && packages.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Loading evidence packages…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={fetchPackages} className="text-sm text-blue-600 hover:underline">
              Try again
            </button>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-500 text-center">
              No evidence packages yet.<br />
              Click <strong>Generate Evidence Package</strong> to create your first one.
            </p>
          </div>
        ) : (
          <div>
            {packages.map(pkg => (
              <PackageRow
                key={pkg.id}
                pkg={pkg}
                onDownload={handleDownload}
                downloading={downloading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        Evidence packages are generated from CloudTrail, Config, GuardDuty, and Security Hub.
        Presigned download URLs expire after 1 hour.
      </p>
    </div>
  );
}
