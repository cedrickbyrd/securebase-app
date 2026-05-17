/**
 * evidenceApiService.js
 * Phase 6.1 — Evidence API methods
 * Routes through Netlify proxy /api/* → API Gateway
 */

// Portal uses Netlify proxy: /api/* → API Gateway
// Do NOT use VITE_API_URL directly — use /api prefix per _redirects
const API_BASE = '/api';

function getAuthHeaders() {
  const token =
    localStorage.getItem('sessionToken') ||
    sessionStorage.getItem('sessionToken') ||
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') || '';
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

export async function listEvidencePackages({ limit = 100 } = {}) {
  let offset = 0;
  const packages = [];
  let lastPayload = null;
  const maxPages = 50;
  let pageCount = 0;

  // Paginate to retrieve complete package history for the tenant.
  // Backend caps limit at 100, so we page in chunks of up to 100.
  while (true) {
    pageCount += 1;
    if (pageCount > maxPages) {
      throw new Error('Exceeded maximum evidence pagination limit');
    }

    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetch(`${API_BASE}/admin/evidence?${query.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    const payload = await handleResponse(res);
    lastPayload = payload;

    let batch;
    if (Array.isArray(payload)) {
      batch = payload;
    } else if (Array.isArray(payload?.packages)) {
      batch = payload.packages;
    } else {
      throw new Error('Unexpected evidence list response format');
    }
    packages.push(...batch);

    if (batch.length === 0 || batch.length < limit) {
      break;
    }
    if (!Array.isArray(payload) && typeof payload?.count === 'number' && packages.length >= payload.count) {
      break;
    }
    offset += batch.length;
  }

  if (Array.isArray(lastPayload)) {
    return packages;
  }
  return {
    ...(lastPayload || {}),
    packages,
    count: packages.length,
  };
}

export async function getEvidencePackage(packageId) {
  if (!packageId) throw new Error('packageId is required');
  const res = await fetch(`${API_BASE}/admin/evidence/${encodeURIComponent(packageId)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
}

const DEFAULT_RANGE_DAYS = 90;
const DEFAULT_RANGE_MS = DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000;

export async function generateEvidencePackage({ framework = 'ALL', date_range_start, date_range_end } = {}) {
  const now = new Date();
  const end = date_range_end || now.toISOString();
  const start = date_range_start || new Date(now.getTime() - DEFAULT_RANGE_MS).toISOString();
  const res = await fetch(`${API_BASE}/admin/evidence/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ framework, date_range_start: start, date_range_end: end }),
  });
  return handleResponse(res);
}

export async function pollUntilComplete(packageId, { intervalMs = 5000, maxAttempts = 18, onProgress } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const data = await getEvidencePackage(packageId);
    if (onProgress) onProgress(data);
    if (data.status === 'complete' || data.status === 'failed') return data;
  }
  throw new Error(`Package ${packageId} did not complete within ${(maxAttempts * intervalMs) / 1000}s`);
}

export function downloadFromUrl(url, filename) {
  if (!url) throw new Error('No URL provided for download');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'evidence-package.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
