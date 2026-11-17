export type HarnessFrameworkId = 'FFIEC_AIO' | 'HIPAA_164_312' | 'NIST_800_53';
export type McpToolTier = 'TIER_1_READ_ONLY' | 'TIER_2_GATED_MUTATION';
export type Tier2GateStatus =
  | 'LOCKED_NEEDS_EVAL'
  | 'LOCKED_NEEDS_WORM'
  | 'AWAITING_HUMAN_APPROVAL'
  | 'APPROVED_SYNTHESIZED'
  | 'NO_REMEDIATION_NEEDED';

export interface McpToolContractSpec {
  name: 'evaluate_tf_plan' | 'verify_worm_vault' | 'synthesize_remediation_pr';
  tier: McpToolTier;
  description: string;
  dependsOn: string[];
  mutatesState: boolean;
  requiresHumanApproval: boolean;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface RegoPolicyPackSpec {
  id: string;
  framework: HarnessFrameworkId;
  title: string;
  controlCitation: string;
  policyPath: string;
  testPath: string;
  policySource: string;
  testSource: string;
}

export interface RegoUnitTestCaseResult {
  testId: string;
  framework: HarnessFrameworkId;
  suiteName: string;
  testName: string;
  passed: boolean;
  expectedCount: number;
  actualCount: number;
  durationMs: number;
  summary: string;
}

export interface HarnessFinding {
  findingId: string;
  framework: HarnessFrameworkId;
  ruleHead: string;
  resourceAddress: string;
  resourceIdSlug: string;
  controlCitation: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  penaltyExposure: string;
  reason: string;
  branchName: string;
  hclPatch: string;
  blastRadius: {
    scope: string;
    changeAction: 'IN_PLACE_UPDATE' | 'REPLACEMENT_REQUIRED' | 'RESOURCE_REMOVAL';
    affectedResources: number;
    recreationRisk: 'NONE' | 'LOW' | 'HIGH';
    downtimeExpected: boolean;
  };
}

export interface HarnessEvaluationRun {
  runId: string;
  sourceType: 'terraform_plan_json' | 'aws_security_hub';
  repository: string;
  evaluatedAtUtc: string;
  planSha256: string;
  frameworks: HarnessFrameworkId[];
  compliant: boolean;
  violationCount: number;
  violationsByFramework: Record<HarnessFrameworkId, HarnessFinding[]>;
  findings: HarnessFinding[];
  wormVerification: {
    verified: boolean;
    vaultUrn: string;
    retentionMode: 'COMPLIANCE' | null;
    retentionDays: number | null;
    evidenceChainSha256: string | null;
    verifiedAtUtc: string | null;
  };
  tier2GateStatus: Tier2GateStatus;
  nextAllowedTool: 'verify_worm_vault' | 'synthesize_remediation_pr' | 'NONE';
}

export interface SynthesizedPrRecord {
  prId: string;
  runId: string;
  branchName: string;
  framework: HarnessFrameworkId;
  targetResourceAddresses: string[];
  targetFindingIds: string[];
  hclPatch: string;
  blastRadius: {
    affectedResources: number;
    changeActions: string[];
    recreationRisk: 'NONE' | 'LOW' | 'HIGH';
    downtimeExpected: boolean;
    summary: string;
  };
  regulatoryJustification: string;
  approverEmail: string;
  confirmationNote: string;
  attestationSha256: string;
  synthesizedAtUtc: string;
}

export interface HarnessAuditEntry {
  id: string;
  timestampUtc: string;
  toolName: string;
  tier: McpToolTier;
  status: 'ALLOWED' | 'BLOCKED_SCHEMA_DRIFT' | 'BLOCKED_ORDER_GATE' | 'BLOCKED_HUMAN_GATE';
  runId: string | null;
  detail: string;
}

export interface HarnessStateResponse {
  sandbox: {
    activeRun: HarnessEvaluationRun | null;
    synthesizedPrs: SynthesizedPrRecord[];
    auditTrail: HarnessAuditEntry[];
    lastTestSuiteRunUtc: string | null;
    lastTestResults: RegoUnitTestCaseResult[];
    lastUpdatedUtc: string;
  };
  contracts: {
    mcpSpecVersion: string;
    harness: string;
    repository: string;
    serverName: string;
    deterministicExecutionOrder: string[];
    tools: McpToolContractSpec[];
  };
  regoLibrary: RegoPolicyPackSpec[];
}

export const HARNESS_PRESETS: Array<{
  id: string;
  label: string;
  sourceType: 'terraform_plan_json' | 'aws_security_hub';
  frameworks: HarnessFrameworkId[];
  payload: Record<string, any>;
}> = [
  {
    id: 'tri-framework-drift',
    label: 'Tri-Framework Pre-Flight Drift (terraform show -json)',
    sourceType: 'terraform_plan_json',
    frameworks: ['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'],
    payload: {
      format_version: '1.2',
      terraform_version: '1.9.8',
      planned_values: {
        root_module: {
          resources: [
            {
              address: 'aws_s3_bucket.worm_audit_vault',
              type: 'aws_s3_bucket',
              name: 'worm_audit_vault',
              values: { object_lock_enabled: false }
            },
            {
              address: 'aws_s3_bucket_object_lock_configuration.worm_audit_lock',
              type: 'aws_s3_bucket_object_lock_configuration',
              name: 'worm_audit_lock',
              values: {
                rule: [{ default_retention: [{ mode: 'GOVERNANCE', days: 365 }] }]
              }
            },
            {
              address: 'aws_s3_bucket_server_side_encryption_configuration.ephi_fhir_sse',
              type: 'aws_s3_bucket_server_side_encryption_configuration',
              name: 'ephi_fhir_sse',
              values: {
                rule: [{ apply_server_side_encryption_by_default: [{ sse_algorithm: 'AES256' }] }]
              }
            },
            {
              address: 'aws_lb_listener.clinical_tls_ingress',
              type: 'aws_lb_listener',
              name: 'clinical_tls_ingress',
              values: { ssl_policy: 'ELBSecurityPolicy-2016-08' }
            },
            {
              address: 'aws_iam_role.github_actions_wif',
              type: 'aws_iam_role',
              name: 'github_actions_wif',
              values: { max_session_duration: 43200 }
            }
          ]
        }
      }
    }
  },
  {
    id: 'aws-security-hub-asff',
    label: 'AWS Security Hub Finding (ASFF Stream)',
    sourceType: 'aws_security_hub',
    frameworks: ['FFIEC_AIO', 'HIPAA_164_312'],
    payload: {
      Findings: [
        {
          Id: 'sechub-s3-object-lock-prod-01',
          Title: 'S3 WORM Vault retention_mode degraded from COMPLIANCE to GOVERNANCE',
          Severity: { Label: 'CRITICAL' },
          Compliance: { RelatedRequirements: ['FFIEC AIO Booklet II.C'] },
          Resources: [{ Id: 'arn:aws:s3:::securebase-worm-evidence-us-east-1' }]
        },
        {
          Id: 'sechub-alb-tls13-downgrade-02',
          Title: 'Clinical FHIR ALB listener downgraded below TLS 1.3 baseline',
          Severity: { Label: 'HIGH' },
          Compliance: { RelatedRequirements: ['HIPAA 45 CFR 164.312(e)(1)'] },
          Resources: [{ Id: 'arn:aws:elasticloadbalancing:us-east-1:594006980795:listener/app/fhir-ingress' }]
        }
      ]
    }
  },
  {
    id: 'compliant-baseline',
    label: 'Compliant Tri-Framework Baseline (Pass)',
    sourceType: 'terraform_plan_json',
    frameworks: ['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'],
    payload: {
      format_version: '1.2',
      terraform_version: '1.9.8',
      planned_values: {
        root_module: {
          resources: [
            {
              address: 'aws_s3_bucket.worm_audit_vault',
              type: 'aws_s3_bucket',
              name: 'worm_audit_vault',
              values: { object_lock_enabled: true }
            },
            {
              address: 'aws_s3_bucket_object_lock_configuration.worm_audit_lock',
              type: 'aws_s3_bucket_object_lock_configuration',
              name: 'worm_audit_lock',
              values: {
                rule: [{ default_retention: [{ mode: 'COMPLIANCE', days: 2555 }] }]
              }
            },
            {
              address: 'aws_kms_key.ephi_cmek',
              type: 'aws_kms_key',
              name: 'ephi_cmek',
              values: { enable_key_rotation: true }
            },
            {
              address: 'aws_s3_bucket_server_side_encryption_configuration.ephi_fhir_sse',
              type: 'aws_s3_bucket_server_side_encryption_configuration',
              name: 'ephi_fhir_sse',
              values: {
                rule: [{ apply_server_side_encryption_by_default: [{ sse_algorithm: 'aws:kms' }] }]
              }
            },
            {
              address: 'aws_lb_listener.clinical_tls_ingress',
              type: 'aws_lb_listener',
              name: 'clinical_tls_ingress',
              values: { ssl_policy: 'ELBSecurityPolicy-TLS13-1-2-2021-06' }
            },
            {
              address: 'aws_iam_role.github_actions_wif',
              type: 'aws_iam_role',
              name: 'github_actions_wif',
              values: { max_session_duration: 1800 }
            }
          ]
        }
      }
    }
  }
];

export async function fetchHarnessState(): Promise<HarnessStateResponse> {
  const res = await fetch('/api/harness/state');
  if (!res.ok) throw new Error('Failed to load SecureBase harness state');
  return res.json();
}

export async function validateMcpPayloadViaApi(toolName: string, payload: unknown): Promise<{
  toolName: string;
  valid: boolean;
  errors: string[];
}> {
  const res = await fetch('/api/harness/mcp/validate-schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, payload })
  });
  return res.json();
}

export async function evaluateTfPlanViaApi(input: {
  sourceType: 'terraform_plan_json' | 'aws_security_hub';
  repository: string;
  frameworks: HarnessFrameworkId[];
  strictMode: boolean;
  payload: Record<string, any>;
}) {
  const res = await fetch('/api/harness/mcp/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return res.json();
}

export async function verifyWormVaultViaApi(input: {
  runId: string;
  vaultUrn: string;
  expectedPlanSha256: string;
  minimumRetentionDays: number;
}) {
  const res = await fetch('/api/harness/mcp/verify-worm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return res.json();
}

export async function synthesizeRemediationPrViaApi(input: {
  runId: string;
  targetFindingIds: string[];
  humanConfirmed: boolean;
  approverEmail: string;
  confirmationNote: string;
}) {
  const res = await fetch('/api/harness/mcp/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return res.json();
}

export async function runRegoUnitTestsViaApi(): Promise<{
  executedAtUtc: string;
  total: number;
  passed: number;
  results: RegoUnitTestCaseResult[];
}> {
  const res = await fetch('/api/harness/rego/run-tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error('Failed to run Rego v1 unit test suite');
  return res.json();
}

export async function resetHarnessViaApi(): Promise<void> {
  await fetch('/api/harness/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
}
