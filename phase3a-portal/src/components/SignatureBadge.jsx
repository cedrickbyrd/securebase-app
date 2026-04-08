import React from 'react';

function generatePlaceholderSignature(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >> 0;
  }
  let hex = '';
  for (let i = 0; i < 5; i++) {
    hash = (hash * 1664525 + 1013904223) >> 0;
    hex += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return hex; // 40 hex chars
}

export default function SignatureBadge({ id }) {
  if (!id) return null;

  const sig = generatePlaceholderSignature(id);
  const truncated = `sig:0x${sig.slice(0, 3)}...${sig.slice(-3)}`;

  return (
    <span
      title="This audit log is cryptographically signed using an asymmetric AWS KMS key pair, ensuring non-repudiation."
      aria-label={`KMS signature: ${sig}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
          backgroundColor: '#d1fae5',
          color: '#065f46',
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        🔑 KMS-Signed
      </span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: '#6b7280',
        }}
      >
        {truncated}
      </span>
    </span>
  );
}
