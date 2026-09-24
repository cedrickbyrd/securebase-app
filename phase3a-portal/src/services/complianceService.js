/**
 * ============================================================================
 * SecureBase Compliance & WORM Evidence Vault Service
 * Maps to OpenAPI 3.1.0 Contract (docs/openapi/securebase-compliance-v1.yaml)
 * ============================================================================
 */
import api from './apiService';

/**
 * Fetch chronological compliance evaluation history and 90-day trend snapshots.
 * @param {Object} [params]
 * @param {number} [params.days=90] - Window of historical trend days
 * @param {'ALL'|'SOC2'|'HIPAA'|'FEDRAMP'|'FFIEC'} [params.framework='ALL']
 * @returns {Promise<Object>}
 */
export async function getComplianceHistory(params = {}) {
  const { days = 90, framework = 'ALL' } = params;
  const queryParams = new URLSearchParams();
  if (days) queryParams.set('days', days.toString());
  if (framework && framework !== 'ALL') queryParams.set('framework', framework);

  const queryStr = queryParams.toString();
  const endpoint = `/tenant/compliance/history${queryStr ? `?${queryStr}` : ''}`;
  return api.get(endpoint);
}

/**
 * Trigger an asynchronous discovery and posture evaluation scan across connected cloud accounts.
 * @param {Object} [payload]
 * @param {'FULL_DISCOVERY'|'CONFIG_RULES_ONLY'|'IAM_SECURITY_AUDIT'} [payload.scanType='FULL_DISCOVERY']
 * @param {boolean} [payload.isDemoMode=false]
 * @returns {Promise<Object>}
 */
export async function triggerComplianceScan(payload = {}) {
  const body = {
    scanType: payload.scanType || 'FULL_DISCOVERY',
    isDemoMode: Boolean(payload.isDemoMode),
    notificationWebhookUrl: payload.notificationWebhookUrl || null,
  };
  return api.post('/tenant/compliance/scan', body);
}

/**
 * Fetch an append-only WORM audit record receipt with SHA-256 hash and KMS CMEK signature.
 * @param {string} evidenceId - UUID of the evidence record
 * @returns {Promise<Object>}
 */
export async function getVaultEvidenceRecord(evidenceId) {
  if (!evidenceId) {
    throw new Error('evidenceId is required to fetch WORM evidence record.');
  }
  return api.get(`/vault/evidence/${encodeURIComponent(evidenceId)}`);
}

export default {
  getComplianceHistory,
  triggerComplianceScan,
  getVaultEvidenceRecord,
};
