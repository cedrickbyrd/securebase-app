import React, { useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Lock, Loader, Clock, Calendar } from 'lucide-react';
import { generateEvidencePackage, pollUntilComplete, downloadFromUrl } from '../services/evidenceApiService';

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getGeneratedTimestamp(data) {
  return data?.generated_at || data?.created_at || data?.completed_at || new Date().toISOString();
}

function formatBytes(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

export default function ExportEvidence({ framework = 'HIPAA' }) {
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const [state, setState] = useState('idle');
  const [selectedFramework, setSelectedFramework] = useState(framework);
  const [periodEnd, setPeriodEnd] = useState(formatDateInput(today));
  const [periodStart, setPeriodStart] = useState(formatDateInput(yearAgo));
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [sha256, setSha256] = useState(null);
  const [packageSize, setPackageSize] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [progressMsg, setProgressMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleExport = async () => {
    setState('generating');
    setProgressMsg('Initiating evidence collection…');
    setErrorMsg(null);
    setDownloadUrl(null);
    setSha256(null);
    setPackageSize(null);
    setGeneratedAt(null);

    try {
      const periodStartIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
      const periodEndIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();

      const data = await generateEvidencePackage({
        framework: selectedFramework,
        date_range_start: periodStartIso,
        date_range_end: periodEndIso,
      });
      const id = data.package_id || data.id;
      const immediateUrl = data.download_url || data.presigned_url;
      const immediateGeneratedAt = getGeneratedTimestamp(data);

      if (data.status === 'complete' && immediateUrl) {
        setDownloadUrl(immediateUrl);
        setSha256(data.sha256_manifest);
        setPackageSize(data.size_bytes);
        setGeneratedAt(immediateGeneratedAt);
        setState('success');
      } else {
        setState('polling');
        setProgressMsg('Collecting CloudTrail, Config, GuardDuty logs and building package…');
        const completed = await pollUntilComplete(id, {
          intervalMs: 5000,
          maxAttempts: 18,
          onProgress: progress => {
            setProgressMsg(`Collecting evidence… (${progress.logs_collected ?? '?'} events)`);
          },
        });
        if (completed.status === 'failed') {
          const failureReason = completed.error_message || completed.failure_reason;
          throw new Error(failureReason ? `Package generation failed: ${failureReason}` : 'Package generation failed on server.');
        }
        const completedUrl = completed.download_url || completed.presigned_url;
        if (!completedUrl) {
          throw new Error('Package completed but no download URL was returned.');
        }
        setDownloadUrl(completedUrl);
        setSha256(completed.sha256_manifest);
        setPackageSize(completed.size_bytes);
        setGeneratedAt(getGeneratedTimestamp(completed));
        setState('success');
      }
    } catch (err) {
      setState('error');
      setErrorMsg(err.message || 'Failed to generate evidence package. Please try again.');
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const dateLabel = new Date().toISOString().slice(0, 10);
    downloadFromUrl(downloadUrl, `securebase-evidence-${selectedFramework}-${dateLabel}.zip`);
  };

  const handleReset = () => {
    setState('idle');
    setDownloadUrl(null);
    setSha256(null);
    setPackageSize(null);
    setGeneratedAt(null);
    setProgressMsg(null);
    setErrorMsg(null);
  };

  const isWorking = state === 'generating' || state === 'polling';

  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-blue-400 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Audit-Ready Evidence
          </h3>
          <p className="text-sm text-gray-600">
            Generate a cryptographically signed {selectedFramework} evidence package — KMS-signed, WORM-stored, SHA-256 verified.
          </p>
        </div>

        {state === 'success' ? (
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all hover:-translate-y-0.5">
              <Download className="w-4 h-4" />Download Package
            </button>
            <button onClick={handleReset}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              New Package
            </button>
          </div>
        ) : (
          <button onClick={handleExport} disabled={isWorking}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 whitespace-nowrap">
            {isWorking
              ? <><Loader className="w-4 h-4 animate-spin" /><span>{state === 'generating' ? 'Generating…' : 'Packaging…'}</span></>
              : <><Download className="w-5 h-5" /><span>Export Evidence for Audit</span></>}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Framework</label>
          <select
            value={selectedFramework}
            onChange={e => setSelectedFramework(e.target.value)}
            disabled={isWorking}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="HIPAA">HIPAA</option>
            <option value="SOC2">SOC2</option>
            <option value="FEDRAMP">FEDRAMP</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Period start</label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              disabled={isWorking}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Period end</label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              disabled={isWorking}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {isWorking && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-blue-900">
              {state === 'generating' ? 'Generating…' : progressMsg || 'Collecting evidence…'}
            </p>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900">Evidence package ready for download</p>
              {sha256 && <p className="text-xs text-green-700 mt-1 font-mono">SHA-256: {sha256}</p>}
              {packageSize != null && <p className="text-xs text-green-700 mt-1">Package size: {formatBytes(packageSize)}</p>}
              {generatedAt && (
                <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Generated: {new Date(generatedAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                KMS-signed · WORM Object Lock · 7-year retention · Link expires in 1 hour
              </p>
            </div>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">{errorMsg}</p>
            <button onClick={handleReset} className="text-xs text-red-700 underline mt-1">Try again</button>
          </div>
        </div>
      )}
    </div>
  );
}
