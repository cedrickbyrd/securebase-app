import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Shield,
} from 'lucide-react';

const FUNCTION_METADATA = {
  GV: {
    name: 'Govern',
    description: 'Organizational context, regulatory obligations, and supply-chain risk governance.',
    awsSources: ['AWS Config', 'CloudTrail', 'Secrets Manager'],
  },
  ID: {
    name: 'Identify',
    description: 'Asset inventory, vulnerability identification, and managed system visibility.',
    awsSources: ['AWS Config', 'GuardDuty', 'S3'],
  },
  PR: {
    name: 'Protect',
    description: 'Identity safeguards, data protection, and access control enforcement.',
    awsSources: ['IAM', 'EBS', 'S3', 'RDS'],
  },
  DE: {
    name: 'Detect',
    description: 'Anomaly analysis, network monitoring, and alarm coverage.',
    awsSources: ['CloudTrail', 'VPC Flow Logs', 'CloudWatch'],
  },
  RS: {
    name: 'Respond',
    description: 'Incident management reporting and coordinated response readiness.',
    awsSources: ['KMS', 'API Gateway'],
  },
  RC: {
    name: 'Recover',
    description: 'Backup and recovery planning for resilient service restoration.',
    awsSources: ['RDS', 'DynamoDB'],
  },
};

function statusClasses(status) {
  switch (status) {
    case 'Passing':
      return {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        badge: 'bg-green-100 text-green-700',
      };
    case 'At Risk':
      return {
        icon: <Clock className="w-5 h-5 text-amber-500" />,
        badge: 'bg-amber-100 text-amber-700',
      };
    default:
      return {
        icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
        badge: 'bg-red-100 text-red-700',
      };
  }
}

function scoreBarClass(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function ScoreSegments({ score }) {
  const activeSegments = Math.max(0, Math.min(10, Math.round((score || 0) / 10)));
  const activeClass = scoreBarClass(score);

  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className={`h-2 rounded-full ${index < activeSegments ? activeClass : 'bg-slate-200'}`}
        />
      ))}
    </div>
  );
}

function FunctionCard({ category, onEvidenceClick }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = FUNCTION_METADATA[category.function] || {
    name: category.function,
    description: 'NIST CSF 2.0 function assessment.',
    awsSources: ['AWS Config'],
  };
  const { icon, badge } = statusClasses(category.status);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full text-left px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-semibold text-slate-900">
              {category.function} — {metadata.name}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${badge}`}>
              {category.status}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {category.passed}/{category.total} controls passing
            </span>
          </div>
          <p className="text-sm text-slate-500 mb-3">{metadata.description}</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Function Score</span>
              <span>{category.score}%</span>
            </div>
            <ScoreSegments score={category.score} />
          </div>
        </div>
        <div className="text-slate-400 mt-1">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                AWS Telemetry Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.awsSources.map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-medium rounded"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                NIST CSF 2.0 Function
              </p>
              <span className="text-sm text-slate-700">{metadata.name}</span>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Control Mapping
          </p>
          <div className="space-y-2">
            {category.controls.map((control) => {
              const controlState = control.passed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200';
              const controlBadge = control.passed
                ? 'bg-green-100 text-green-700'
                : control.status === 'NON_COMPLIANT'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-700';

              return (
                <div key={control.mappingId} className={`rounded-lg border px-4 py-3 ${controlState}`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{control.controlId}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${controlBadge}`}>
                          {control.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{control.title}</p>
                    </div>
                    <span className="text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                      {control.configRule}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => onEvidenceClick(category, metadata)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Evidence Package
          </button>
        </div>
      )}
    </div>
  );
}

export default function FFIECCATDashboard({ onEvidenceExport }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');

    fetch('/api/compliance/ffiec', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((result) => {
        if (isMounted) {
          setData(result);
        }
      })
      .catch(() => {
        console.error('Failed to load NIST CSF 2.0 compliance data.');
        if (isMounted) {
          setError('Failed to load NIST CSF 2.0 compliance data.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => (
    Array.isArray(data?.categories) ? data.categories : []
  ), [data]);

  const overallStatus = useMemo(() => {
    if (typeof data?.status === 'string') return data.status;
    if ((data?.overallScore || 0) >= 80) return 'Passing';
    if ((data?.overallScore || 0) >= 60) return 'At Risk';
    return 'Critical';
  }, [data]);

  const handleEvidenceClick = (category, metadata) => {
    if (!onEvidenceExport) return;
    onEvidenceExport({
      ...category,
      name: `${category.function} — ${metadata.name}`,
    });
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      if (onEvidenceExport) {
        await onEvidenceExport(null);
      }
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-2xl shadow inline-flex mb-4">
          <Shield className="text-white w-6 h-6" />
        </div>
        <p className="text-sm text-slate-500">Loading NIST CSF 2.0 compliance data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-xl shadow">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{data?.framework || 'NIST CSF 2.0'}</h2>
            <p className="text-sm text-slate-500">
              Live AWS Config posture assessment across all six NIST CSF 2.0 functions
            </p>
          </div>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exportLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {exportLoading ? 'Generating…' : 'Export NIST CSF 2.0 Evidence Package'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Overall Score
          </p>
          <p className="text-3xl font-black text-slate-900">{data?.overallScore ?? 0}%</p>
          <p className="text-xs text-slate-400 mt-1">Current framework posture</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Assessment Status
          </p>
          <p className="text-2xl font-black text-slate-900">{overallStatus}</p>
          <p className="text-xs text-slate-400 mt-1">Derived from live control results</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Functions Assessed
          </p>
          <p className="text-3xl font-black text-slate-900">{categories.length}</p>
          <p className="text-xs text-slate-400 mt-1">of 6 NIST CSF 2.0 functions</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Controls Passing
          </p>
          <p className="text-3xl font-black text-slate-900">
            {data?.passed ?? 0}/{data?.total ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Last assessed {data?.assessedAt ? new Date(data.assessedAt).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {categories.map((category) => (
          <FunctionCard
            key={category.function}
            category={category}
            onEvidenceClick={handleEvidenceClick}
          />
        ))}
      </div>

      {categories.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500">No NIST CSF 2.0 assessment data is available yet.</p>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Live posture is calculated from AWS Config managed-rule evaluations and rendered as a NIST CSF 2.0 assessment.
      </p>
    </div>
  );
}
