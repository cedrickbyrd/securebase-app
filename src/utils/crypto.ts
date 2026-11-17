/**
 * SecureBase Cryptographic Evidence Hashing & Verification Engine
 * Implements deterministic SHA-256 digest calculations for WORM audit manifests
 * Enforces Zero-Data-Custody: all hashes calculated strictly in-memory without persistent server custody
 */

/**
 * Produces a canonical string representation of an object with sorted keys
 * to ensure deterministic SHA-256 hashing across platforms.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(key => {
    const val = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Computes a standard SHA-256 hex digest using Web Crypto API.
 */
export async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies whether a given content matches an expected SHA-256 digest.
 */
export async function verifySha256(content: string, expectedHash: string): Promise<boolean> {
  const computed = await computeSha256(content);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Generates an immutable UUID v4 compatible identifier.
 */
export function generateEvidenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sb-ev-${crypto.randomUUID()}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `sb-ev-${s4()}${s4()}-${s4()}-4${s4().substr(0, 3)}-${s4()}-${s4()}${s4()}${s4()}`;
}
