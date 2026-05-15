import React, { useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Lock, Loader } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function ExportEvidence({ framework = 'HIPAA' }) {
  const [state, setState] = useState('idle'); // idle | generating | polling | success | error
  const [packageId, setPackageId] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [sha256, setSha256] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pollForCompletion = async (id, attempts = 0) => {
    if (attempts > 15) {
      setState('error');
      setErrorMsg('Package generation timed out. Please try again.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/evidence/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.status === 'complete') {
        setDownloadUrl(data.download_url || data.presigned_url);
        setSha256(data.sha256_manifest);
        setState('success');
      } else if (data.status === 'failed') {
        setState('error');
        setErrorMsg('Package generation failed. Please try again.');
      } else {
        // still generating — poll again
        setTimeout(() => pollForCompletion(id, attempts + 1), 4000);
      }
    } catch (err) {
      console.error('Poll error:', err);
      setTimeout(() => pollForCompletion(id, attempts + 1), 4000);
    }
  };

  const handleExport = async () => {
    setState('generating');
    setErrorMsg(null);
    setDownloadUrl(null);
    setSha256(null);

    try {
      const res = await fetch(`${API_BASE}/admin/evidence/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ framework }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id = data.package_id || data.id;
      setPackageId(id);

      if (data.status === 'complete' && (data.download_url || data.presigned_url)) {
        setDownloadUrl(data.download_url || data.presigned_url);
        setSha256(data.sha256_manifest);
        setState('success');
      } else {
        setState('polling');
        setTimeout(() => pollForCompletion(id, 0), 4000);
      }
    } catch (err) {
      console.error('Generate error:', err);
      setState('error');
      setErrorMsg('Failed to start evidence generation. Please try again.');
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `securebase-evidence-${framework.toLowerCase()}-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setState('idle');
    setPackageId(null);
    setDownloadUrl(null);
    setSha256(null);
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
            Generate a cryptographically signed {framework} evidence package — KMS-signed, WORM-stored, SHA-256 verified.
          </p>
        </div>

        {state === 'success' ? (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              Download Package
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              New Package
            </button>
          </div>
        ) : (
          <button
            onClick={handleExport}
            disabled={isWorking}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 whitespace-nowrap"
          >
            {isWorking ? (
              <><Loader className="w-4 h-4 animate-spin" />
                <span>{state === 'generating' ? 'Generating…' : 'Packaging…'}</span></>
            ) : (
              <><Download className="w-5 h-5" />
                <span>Export Evidence for Audit</span></>
            )}
          </button>
        )}
      </div>

      {/* Progress indicator while working */}
      {isWorking && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-blue-900">
              {state === 'generating'
                ? 'Initiating evidence collection…'
                : 'Collecting CloudTrail, Config, GuardDuty logs and building package…'}
            </p>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Success */}
      {state === 'success' && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900">
                Evidence package ready for download
              </p>
              {sha256 && (
                <p className="text-xs text-green-700 mt-1 font-mono">
                  SHA-256: {sha256}
                </p>
              )}
              <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                KMS-signed · WORM Object Lock · 7-year retention · Download link expires in 1 hour
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
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
