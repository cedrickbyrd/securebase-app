import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

// ── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Generate credentials' },
  { id: 2, label: 'Deploy IAM role' },
  { id: 3, label: 'Verify connection' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
              ${current === step.id ? 'bg-blue-600 text-white' : current > step.id ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {current > step.id ? '✓' : step.id}
            </div>
            <span className={`text-xs font-medium ${current >= step.id ? 'text-gray-800' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${current > i + 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    not_connected: ['bg-gray-100 text-gray-600', 'Not connected'],
    pending:       ['bg-yellow-100 text-yellow-700', 'Pending'],
    connected:     ['bg-green-100 text-green-700', 'Connected'],
    error:         ['bg-red-100 text-red-700', 'Error'],
  };
  const [cls, label] = map[status] || map.not_connected;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ value, label }) {
  return (
    <div className="mt-2">
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono text-sm text-gray-800 break-all">
        <span className="flex-1">{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CloudConnection() {
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [connectionStatus, setStatus] = useState('not_connected');

  // Step 1 result
  const [externalId, setExternalId]   = useState('');
  const [securebaseArn, setSecurebaseArn] = useState('');

  // Step 2 input
  const [roleArn, setRoleArn]         = useState('');

  // Step 3 result
  const [verifyResult, setVerifyResult] = useState(null);
  const [scanPending, setScanPending]   = useState(false);

  // Load existing connection on mount
  useEffect(() => {
    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
    if (!token) return;
    apiService.get('/cloud-connection/status')
      .then(data => {
        if (data.status === 'connected') {
          setStatus('connected');
          setExternalId(data.external_id || '');
          setSecurebaseArn(data.securebase_principal_arn || '');
          setRoleArn(data.role_arn || '');
          setStep(3);
          setVerifyResult({ connected: true, account_id: data.account_id });
        }
      })
      .catch(() => {}); // no existing connection — silent
  }, []);

  // ── Step 1: generate external ID ─────────────────────────────────────────

  const handleInit = async () => {
    setLoading(true);
    setError('');
    setScanPending(false); // reset if user starts a new connection flow
    try {
      const data = await apiService.post('/cloud-connection/init', {});
      setExternalId(data.external_id);
      setSecurebaseArn(data.securebase_principal_arn);
      setStep(2);
    } catch (e) {
      setError(e.message || 'Failed to generate credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: verify role ───────────────────────────────────────────────────

  const handleVerify = async () => {
    if (!roleArn.trim()) { setError('Please enter the IAM role ARN.'); return; }
    if (!roleArn.startsWith('arn:aws:iam::')) { setError('Invalid ARN format. Expected: arn:aws:iam::<account-id>:role/<role-name>'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await apiService.post('/cloud-connection/verify', { role_arn: roleArn.trim(), external_id: externalId });
      setVerifyResult(data);
      setStatus(data.connected ? 'connected' : 'error');
      if (data.connected) {
        setStep(3);
        const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
        // Raw fetch used intentionally: fire-and-forget — must never block the UI or bubble errors.
        fetch('/api/scan/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ source: 'cloud_connection_onboarding' }),
        }).catch(() => { /* non-blocking */ });
        setScanPending(true);
      }
      else setError(data.error || 'Role verification failed. Check that the trust policy and external ID are correct.');
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Verification failed. Please check the role ARN and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── CloudFormation quick-launch URL ──────────────────────────────────────

  const cfnTemplateUrl = 'https://securebase-public-assets.s3.amazonaws.com/cf-templates/securebase-readonly-role.json';
  const cfnLaunchUrl = externalId
    ? `https://console.aws.amazon.com/cloudformation/home#/stacks/create/review` +
      `?templateURL=${encodeURIComponent(cfnTemplateUrl)}` +
      `&stackName=SecureBaseReadOnlyRole` +
      `&param_ExternalId=${encodeURIComponent(externalId)}` +
      `&param_SecureBasePrincipalArn=${encodeURIComponent(securebaseArn)}`
    : '#';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Cloud Connection</h1>
          <StatusBadge status={connectionStatus} />
        </div>
        <p className="text-gray-500 text-sm">
          Connect your AWS account so SecureBase can continuously assess your HIPAA compliance posture.
          We use a read-only cross-account IAM role — we never write to your account.
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <span className="text-red-500 mt-0.5">⚠</span>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate your unique external ID</h2>
          <p className="text-gray-500 text-sm mb-6">
            We'll generate a cryptographically unique External ID that ties the cross-account trust
            to your account only — preventing confused deputy attacks.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm font-medium mb-1">What SecureBase will access (read-only)</p>
            <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
              <li>AWS Config — resource configuration history</li>
              <li>CloudTrail — API call logs for audit evidence</li>
              <li>IAM — role and policy configurations</li>
              <li>Security Hub — findings aggregation</li>
              <li>S3 metadata — bucket policy and encryption status</li>
              <li>KMS — key rotation status</li>
            </ul>
            <p className="text-blue-600 text-xs mt-2">No write permissions. No data exfiltration. Auditable via CloudTrail.</p>
          </div>
          <button
            onClick={handleInit}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Generating…' : 'Generate External ID'}
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Deploy the read-only IAM role</h2>
          <p className="text-gray-500 text-sm mb-5">
            Deploy our pre-built CloudFormation template into your AWS account. It creates a single
            read-only IAM role with the exact permissions SecureBase needs — nothing more.
          </p>

          <CodeBlock value={externalId} label="Your External ID (included automatically in the template)" />
          <CodeBlock value={securebaseArn} label="SecureBase Principal ARN (who assumes the role)" />

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-3">Option A — One-click CloudFormation deploy</p>
            <a
              href={cfnLaunchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Launch in AWS Console
            </a>
            <p className="text-xs text-gray-500 mt-2">Opens CloudFormation in your AWS account with parameters pre-filled.</p>
          </div>

          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Option B — AWS CLI</p>
            <div className="bg-gray-900 text-gray-100 rounded p-3 font-mono text-xs overflow-x-auto">
              <div>{`aws cloudformation create-stack \\`}</div>
              <div>{`  --stack-name SecureBaseReadOnlyRole \\`}</div>
              <div>{`  --template-url ${cfnTemplateUrl} \\`}</div>
              <div>{`  --parameters \\`}</div>
              <div>{`    ParameterKey=ExternalId,ParameterValue=${externalId} \\`}</div>
              <div>{`    ParameterKey=SecureBasePrincipalArn,ParameterValue=${securebaseArn} \\`}</div>
              <div>{`  --capabilities CAPABILITY_NAMED_IAM`}</div>
            </div>
            <CopyButton text={`aws cloudformation create-stack --stack-name SecureBaseReadOnlyRole --template-url ${cfnTemplateUrl} --parameters ParameterKey=ExternalId,ParameterValue=${externalId} ParameterKey=SecureBasePrincipalArn,ParameterValue=${securebaseArn} --capabilities CAPABILITY_NAMED_IAM`} />
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-2">After deploying, paste the role ARN here</p>
            <p className="text-xs text-gray-500 mb-2">
              Find it in CloudFormation → Stacks → SecureBaseReadOnlyRole → Outputs → RoleArn
            </p>
            <input
              type="text"
              value={roleArn}
              onChange={e => { setRoleArn(e.target.value); setError(''); }}
              placeholder="arn:aws:iam::123456789012:role/SecureBaseReadOnlyRole"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => { setStep(1); setError(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={loading || !roleArn.trim()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify Connection'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Success ── */}
      {step === 3 && verifyResult?.connected && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl">✓</div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connection established</h2>
              <p className="text-gray-500 text-sm">SecureBase can now assess your AWS environment.</p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">AWS Account ID</span>
              <span className="font-mono font-medium text-gray-800">{verifyResult.account_id || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role ARN</span>
              <span className="font-mono font-medium text-gray-800 truncate max-w-xs">{roleArn}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Access level</span>
              <span className="font-medium text-gray-800">Read-only</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">First scan</span>
              <span className="font-medium text-gray-800">Starting within 15 minutes</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm font-medium mb-1">What happens next</p>
            <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
              <li>Initial HIPAA compliance scan begins automatically</li>
              <li>Results appear in your Compliance dashboard within 15 minutes</li>
              <li>Continuous monitoring runs every 24 hours</li>
              <li>Findings trigger alerts per your notification settings</li>
            </ul>
          </div>

          {scanPending && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-blue-800 text-sm">
              Your compliance posture is being calculated. Check back in a few minutes.
            </div>
          )}

          <a
            href="/hipaa-dashboard"
            className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            View HIPAA Dashboard
          </a>
        </div>
      )}

      {/* ── Security note ── */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-500 font-medium mb-1">Security & compliance</p>
        <p className="text-xs text-gray-400">
          The IAM role uses an External ID condition to prevent confused deputy attacks. SecureBase
          credentials are stored encrypted in AWS Secrets Manager. All cross-account access is logged
          in your CloudTrail. You can revoke access at any time by deleting the CloudFormation stack.
        </p>
      </div>
    </div>
  );
}
