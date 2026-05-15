/**
 * evidenceApiService.js
 * Phase 6.1 — Evidence API methods
 * Wraps /admin/evidence endpoints from audit_evidence_api.py Lambda
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * GET /admin/evidence
 * Returns list of evidence packages for the authenticated tenant.
 * @returns {Promise<{packages: Array}>}
 */
export async function listEvidencePackages() {
  const res = await fetch(`${API_BASE}/admin/evidence`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * GET /admin/evidence/:id
 * Returns a single evidence package including presigned download URL.
 * @param {string} packageId
 * @returns {Promise<Object>}
 */
export async function getEvidencePackage(packageId) {
  if (!packageId) throw new Error('packageId is required');
  const res = await fetch(`${API_BASE}/admin/evidence/${encodeURIComponent(packageId)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

/**
 * POST /admin/evidence/generate
 * Triggers async evidence package generation for a compliance framework.
 * @param {Object} options
 * @param {string} [options.framework='HIPAA'] - e.g. 'HIPAA', 'SOC2', 'FedRAMP'
 * @param {string} [options.period_days=30]    - days of logs to include
 * @returns {Promise<{package_id: string, status: string}>}
 */
export async function generateEvidencePackage({ framework = 'HIPAA', period_days = 30 } = {}) {
  const res = await fetch(`${API_BASE}/admin/evidence/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ framework, period_days }),
  });
  return handleResponse(res);
}

/**
 * Poll getEvidencePackage until status is 'complete' or 'failed'.
 * @param {string} packageId
 * @param {Object} [opts]
 * @param {number} [opts.intervalMs=5000]
 * @param {number} [opts.maxAttempts=18]    - 18 × 5s = 90 seconds max
 * @param {Function} [opts.onProgress]      - called with partial data on each poll
 * @returns {Promise<Object>}               - final package record
 */
export async function pollUntilComplete(packageId, { intervalMs = 5000, maxAttempts = 18, onProgress } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const data = await getEvidencePackage(packageId);
    if (onProgress) onProgress(data);
    if (data.status === 'complete' || data.status === 'failed') {
      return data;
    }
  }
  throw new Error(`Package ${packageId} did not complete within ${(maxAttempts * intervalMs) / 1000}s`);
}

/**
 * Trigger browser download from a presigned S3 URL.
 * @param {string} url
 * @param {string} filename
 */
export function downloadFromUrl(url, filename) {
  if (!url) throw new Error('No URL provided for download');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'evidence-package.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
