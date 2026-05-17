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

export async function listEvidencePackages() {
  const res = await fetch(`${API_BASE}/admin/evidence`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
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
