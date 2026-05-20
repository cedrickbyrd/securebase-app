import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Loader,
} from 'lucide-react';
import {
  listEvidencePackages,
  getEvidencePackage,
  generateEvidencePackage,
  downloadFromUrl,
} from '../services/evidenceApiService';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 72;
const DEFAULT_PRESIGNED_TTL_SECONDS = 3600;

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatDateRange(start, end) {
  if (!start && !end) return '—';
  const startFmt = start ? new Date(start).toLocaleDateString() : '—';
  const endFmt = end ? new Date(end).toLocaleDateString() : '—';
  return `${startFmt} → ${endFmt}`;
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '—';
  const numericBytes = Number(bytes);
  if (numericBytes < 1024) return `${numericBytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = numericBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function truncateSha(sha) {
  if (!sha) return '—';
  return sha.length > 14 ? `${sha.slice(0, 14)}…` : sha;
}

function normalizePackagesResponse(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.packages)) return payload.packages;
  return [];
}

function getStatusClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'complete':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'pending':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'generating':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function getDefaultDateRange() {
  const end = new Date();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const start = new Date(end.getTime() - ninetyDaysMs);
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function toRangeIso(startDate, endDate) {
  const start = toInputDateObject(startDate, false).toISOString();
  const end = toInputDateObject(endDate, true).toISOString();
  return { start, end };
}

function toInputDateObject(inputDate, endOfDay = false) {
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  return new Date(`${inputDate}${suffix}`);
}

export default function EvidencePackages({ embedded = false }) {
  const defaults = getDefaultDateRange();
  const [framework, setFramework] = useState('ALL');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiReady, setApiReady] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState('idle');
  const [jobError, setJobError] = useState(null);
  const [generationSnapshot, setGenerationSnapshot] = useState(null);

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadMeta, setDownloadMeta] = useState({});
  const [now, setNow] = useState(Date.now());
  const pollAttemptsRef = useRef(0);

  const fetchPackages = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await listEvidencePackages();
      const packageList = normalizePackagesResponse(response);
      setApiReady(true);
      setPackages(packageList);
      return packageList;
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setApiReady(false);
        setPackages([]);
        return [];
      }

      setError('Unable to load evidence packages. Check your connection and try again.');
      return [];
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const evaluateJobStatus = useCallback((currentPackages) => {
    if (!generationSnapshot || jobStatus === 'idle' || jobStatus === 'complete' || jobStatus === 'error') {
      return;
    }

    const baseline = generationSnapshot.packageIds;
    const newPackages = currentPackages.filter((pkg) => !baseline.includes(pkg.id));
    const hasPending = currentPackages.some((pkg) => ['pending', 'generating'].includes((pkg.status || '').toLowerCase()));
    const failedNewPackage = newPackages.find((pkg) => (pkg.status || '').toLowerCase() === 'failed');
    const completedNewPackage = newPackages.find((pkg) => (pkg.status || '').toLowerCase() === 'complete');

    if (failedNewPackage) {
      setJobStatus('error');
      setJobError('Evidence package generation failed. Please retry.');
      return;
    }

    if (completedNewPackage || (!hasPending && newPackages.length > 0)) {
      setJobStatus('complete');
      setJobError(null);
      return;
    }

    setJobStatus('pending');
  }, [generationSnapshot, jobStatus]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  useEffect(() => {
    if (jobStatus !== 'pending') {
      return undefined;
    }

    const pollTimer = setInterval(async () => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        setJobStatus('error');
        setJobError('Evidence generation timed out. Please retry.');
        return;
      }

      const latestPackages = await fetchPackages({ showLoading: false });
      evaluateJobStatus(latestPackages);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollTimer);
  }, [jobStatus, fetchPackages, evaluateJobStatus]);

  useEffect(() => {
    const hasExpiringLinks = Object.values(downloadMeta).some((meta) => meta?.expiresAt);
    if (!hasExpiringLinks) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [downloadMeta]);

  const handleGenerate = async (event) => {
    event.preventDefault();

    if (!startDate || !endDate) {
      setJobStatus('error');
      setJobError('Please select both start and end dates.');
      return;
    }

    if (toInputDateObject(startDate, false) > toInputDateObject(endDate, false)) {
      setJobStatus('error');
      setJobError('Start date must be before end date.');
      return;
    }

    setGenerating(true);
    setJobStatus('pending');
    setJobError(null);
    pollAttemptsRef.current = 0;

    try {
      const { start, end } = toRangeIso(startDate, endDate);
      await generateEvidencePackage({
        framework,
        date_range_start: start,
        date_range_end: end,
      });

      setGenerationSnapshot({
        packageIds: packages.map((pkg) => pkg.id),
      });

      const latestPackages = await fetchPackages({ showLoading: false });
      evaluateJobStatus(latestPackages);
    } catch (err) {
      if (err.message.includes('404') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setApiReady(false);
      } else {
        setJobStatus('error');
        setJobError('Failed to start evidence generation. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const getLinkStatus = (packageId) => {
    const meta = downloadMeta[packageId];
    if (!meta || !meta.expiresAt) return { hasLink: false, expired: false, minutesRemaining: null };

    const remainingMs = meta.expiresAt - now;
    if (remainingMs <= 0) return { hasLink: true, expired: true, minutesRemaining: 0 };

    const minutesRemaining = Math.ceil(remainingMs / 60000);
    return { hasLink: true, expired: false, minutesRemaining };
  };

  const handleDownload = async (pkg) => {
    if ((pkg.status || '').toLowerCase() !== 'complete') return;
    if (downloadingId) return;

    setDownloadingId(pkg.id);

    try {
      const existingLink = downloadMeta[pkg.id];
      if (existingLink?.url && existingLink.expiresAt > Date.now()) {
        downloadFromUrl(existingLink.url, existingLink.filename);
        return;
      }

      const data = await getEvidencePackage(pkg.id);
      const url = data.download_url || data.presigned_url;
      if (!url) {
        throw new Error('No download URL returned');
      }

      const parsedTtl = Number(data.download_url_expires_in);
      const ttlSeconds = Number.isFinite(parsedTtl) ? parsedTtl : DEFAULT_PRESIGNED_TTL_SECONDS;
      const expiresAt = Date.now() + ttlSeconds * 1000;
      const filename = data.package_name || pkg.package_name || `evidence-${pkg.id}.zip`;

      setDownloadMeta((prev) => ({
        ...prev,
        [pkg.id]: { url, expiresAt, filename },
      }));

      downloadFromUrl(url, filename);
    } catch (downloadError) {
      setJobStatus('error');
      setJobError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!loading && !apiReady) {
    return (
      <div className="space-y-4">
        {!embedded && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />Audit Evidence Packages
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Cryptographically signed, tamper-evident evidence packages.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 flex flex-col items-center gap-4 text-center">
          <div className="p-3 bg-amber-50 rounded-full">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Evidence Infrastructure Provisioning</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Your dedicated evidence bucket and evidence API are still provisioning.
            </p>
          </div>
          <button onClick={() => fetchPackages()} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />Check status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />Audit Evidence Packages
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Generate and download immutable evidence packages.</p>
          </div>
          <button
            onClick={() => fetchPackages()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Generate Evidence Package</h3>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Framework
            <select value={framework} onChange={(event) => setFramework(event.target.value)} className="border border-gray-300 rounded-md px-2 py-2 text-sm">
              <option value="SOC2">SOC2</option>
              <option value="HIPAA">HIPAA</option>
              <option value="FEDRAMP">FedRAMP</option>
              <option value="ALL">ALL</option>
            </select>
          </label>

          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="border border-gray-300 rounded-md px-2 py-2 text-sm"
            />
          </label>

          <label className="text-xs text-gray-600 flex flex-col gap-1">
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border border-gray-300 rounded-md px-2 py-2 text-sm"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={generating || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? <><Loader className="w-4 h-4 animate-spin" />Generating…</> : <><Package className="w-4 h-4" />Generate</>}
            </button>
          </div>
        </form>
      </div>

      {jobStatus === 'pending' && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Loader className="w-4 h-4 text-blue-600 animate-spin" />
          <p className="text-sm text-blue-900">Evidence generation in progress. Checking status every 5 seconds.</p>
        </div>
      )}

      {jobStatus === 'complete' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-900">Evidence package completed successfully.</p>
        </div>
      )}

      {jobStatus === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-900">{jobError || 'Evidence package generation failed.'}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && packages.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-gray-400">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading evidence packages…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <AlertCircle className="w-7 h-7 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => fetchPackages()} className="text-sm text-blue-600 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 text-left">Framework</th>
                  <th className="px-3 py-3 text-left">Date Range</th>
                  <th className="px-3 py-3 text-left">Log Count</th>
                  <th className="px-3 py-3 text-left">Size</th>
                  <th className="px-3 py-3 text-left">SHA256</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Created At</th>
                  <th className="px-3 py-3 text-left">Download</th>
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={8} className="px-3 py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="w-9 h-9 text-gray-300" />
                        <p className="text-sm text-gray-500">No evidence packages yet. Generate your first package below.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {packages.map((pkg) => {
                  const status = (pkg.status || 'pending').toLowerCase();
                  const linkStatus = getLinkStatus(pkg.id);
                  const isDownloading = downloadingId === pkg.id;
                  const hasPendingDownload = downloadingId !== null;
                  const canDownload = status === 'complete';

                  return (
                    <tr key={pkg.id} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-3 font-medium text-gray-900">{pkg.framework || '—'}</td>
                      <td className="px-3 py-3 text-gray-600">{formatDateRange(pkg.date_range_start, pkg.date_range_end)}</td>
                      <td className="px-3 py-3 text-gray-600">{pkg.log_count?.toLocaleString?.() ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-600">{formatBytes(pkg.size_bytes)}</td>
                      <td className="px-3 py-3 text-gray-600 font-mono" title={pkg.sha256 || ''}>{truncateSha(pkg.sha256)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${getStatusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{formatDateTime(pkg.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            onClick={() => handleDownload(pkg)}
                            disabled={!canDownload || hasPendingDownload}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDownloading ? (
                              <><Loader className="w-3 h-3 animate-spin" />Preparing…</>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                {linkStatus.expired ? 'Regenerate Link' : linkStatus.hasLink ? 'Download' : 'Get Link'}
                              </>
                            )}
                          </button>
                          {canDownload && linkStatus.hasLink && (
                            <span className="text-[11px] text-gray-500">
                              {linkStatus.expired
                                ? 'Link expired. Regenerate for a new URL.'
                                : `Link expires in ${linkStatus.minutesRemaining} min`}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
        }
      </div>
    </div>
  );
}
