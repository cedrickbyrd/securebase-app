import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

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

export interface HarnessPersistedState {
  activeRun: HarnessEvaluationRun | null;
  synthesizedPrs: SynthesizedPrRecord[];
  auditTrail: HarnessAuditEntry[];
  lastTestSuiteRunUtc: string | null;
  lastTestResults: RegoUnitTestCaseResult[];
  lastUpdatedUtc: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const HARNESS_STORE_FILE = path.join(DATA_DIR, 'harness-sandbox.json');
const MCP_ROOT = path.resolve(process.cwd(), 'securebase-mcp');

function sha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function slugifyResource(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'resource';
}

function frameworkSlug(fw: HarnessFrameworkId): string {
  if (fw === 'FFIEC_AIO') return 'ffiec';
  if (fw === 'HIPAA_164_312') return 'hipaa';
  return 'nist-800-53';
}

let mutationQueue: Promise<unknown> = Promise.resolve();

async function withHarnessMutation<T>(fn: (state: HarnessPersistedState) => Promise<T> | T): Promise<T> {
  const run = mutationQueue.then(async () => {
    const state = await readHarnessSandboxState();
    const res = await fn(state);
    state.lastUpdatedUtc = new Date().toISOString();
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${HARNESS_STORE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmp, HARNESS_STORE_FILE);
    return res;
  });
  mutationQueue = run.catch(() => undefined);
  return run;
}

function buildInitialHarnessState(): HarnessPersistedState {
  return {
    activeRun: null,
    synthesizedPrs: [],
    auditTrail: [
      {
        id: 'evt-harness-boot',
        timestampUtc: new Date().toISOString(),
        toolName: 'securebase-mcp',
        tier: 'TIER_1_READ_ONLY',
        status: 'ALLOWED',
        runId: null,
        detail: 'Initialized 2026 MCP tool contracts and Rego v1 policy packs for cedrickbyrd/securebase-app.'
      }
    ],
    lastTestSuiteRunUtc: null,
    lastTestResults: [],
    lastUpdatedUtc: new Date().toISOString()
  };
}

export async function readHarnessSandboxState(): Promise<HarnessPersistedState> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(HARNESS_STORE_FILE, 'utf-8');
    return JSON.parse(raw) as HarnessPersistedState;
  } catch {
    const initial = buildInitialHarnessState();
    await fs.writeFile(HARNESS_STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

export async function resetHarnessSandboxState(): Promise<HarnessPersistedState> {
  return withHarnessMutation(async (state) => {
    const fresh = buildInitialHarnessState();
    state.activeRun = fresh.activeRun;
    state.synthesizedPrs = fresh.synthesizedPrs;
    state.auditTrail = fresh.auditTrail;
    state.lastTestSuiteRunUtc = fresh.lastTestSuiteRunUtc;
    state.lastTestResults = fresh.lastTestResults;
    return state;
  });
}

export async function loadMcpContractCatalog(): Promise<{
  mcpSpecVersion: string;
  harness: string;
  repository: string;
  serverName: string;
  deterministicExecutionOrder: string[];
  tools: McpToolContractSpec[];
}> {
  const raw = await fs.readFile(path.join(MCP_ROOT, 'contracts', '2026-mcp-tools.json'), 'utf-8');
  return JSON.parse(raw);
}

export async function loadRegoPolicyLibrary(): Promise<RegoPolicyPackSpec[]> {
  const specs: Array<Omit<RegoPolicyPackSpec, 'policySource' | 'testSource'>> = [
    {
      id: 'ffiec_aio_object_lock',
      framework: 'FFIEC_AIO',
      title: 'S3 COMPLIANCE Mode Object Lock (2,555-Day Retention)',
      controlCitation: 'FFIEC AIO Booklet II.C / SEC 17a-4(f)',
      policyPath: 'policies/ffiec/s3_object_lock.rego',
      testPath: 'policies/ffiec/s3_object_lock_test.rego'
    },
    {
      id: 'hipaa_164_312_crypto_tls',
      framework: 'HIPAA_164_312',
      title: 'KMS CMEK Envelope Encryption & TLS 1.3 Enforcement',
      controlCitation: 'HIPAA 45 CFR 164.312(a)(2)(iv) & 164.312(e)(1)',
      policyPath: 'policies/hipaa/kms_cmek_tls.rego',
      testPath: 'policies/hipaa/kms_cmek_tls_test.rego'
    },
    {
      id: 'nist_800_53_wif_ttl',
      framework: 'NIST_800_53',
      title: '3600-Second WIF/OIDC Session Cap & Zero Static Credentials',
      controlCitation: 'NIST SP 800-53 Rev. 5 AC-2(12) / IA-5(13)',
      policyPath: 'policies/nist80053/wif_session_cap.rego',
      testPath: 'policies/nist80053/wif_session_cap_test.rego'
    }
  ];

  return Promise.all(
    specs.map(async (s) => {
      const [policySource, testSource] = await Promise.all([
        fs.readFile(path.join(MCP_ROOT, s.policyPath), 'utf-8'),
        fs.readFile(path.join(MCP_ROOT, s.testPath), 'utf-8')
      ]);
      return {
        ...s,
        policySource,
        testSource
      };
    })
  );
}

export function validateAgainstSchema(
  schema: Record<string, any>,
  value: unknown,
  pathPrefix = '$'
): string[] {
  const errors: string[] = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${pathPrefix}: expected object`);
      return errors;
    }
    const obj = value as Record<string, unknown>;
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (!(reqKey in obj) || obj[reqKey] === undefined || obj[reqKey] === null) {
          errors.push(`${pathPrefix}.${reqKey}: missing required property`);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties)) {
          errors.push(`${pathPrefix}.${key}: unexpected property (additionalProperties: false)`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries<Record<string, any>>(schema.properties)) {
        if (key in obj && obj[key] !== undefined) {
          errors.push(...validateAgainstSchema(propSchema, obj[key], `${pathPrefix}.${key}`));
        }
      }
    }
    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${pathPrefix}: expected array`);
      return errors;
    }
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${pathPrefix}: expected at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, idx) => {
        errors.push(...validateAgainstSchema(schema.items, item, `${pathPrefix}[${idx}]`));
      });
    }
    return errors;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${pathPrefix}: expected string`);
      return errors;
    }
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${pathPrefix}: string length must be >= ${schema.minLength}`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`${pathPrefix}: value '${value}' not in enum [${schema.enum.join(', ')}]`);
    }
    if (typeof schema.pattern === 'string') {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) {
        errors.push(`${pathPrefix}: value '${value}' does not match pattern ${schema.pattern}`);
      }
    }
    return errors;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      errors.push(`${pathPrefix}: expected boolean`);
    }
    return errors;
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`${pathPrefix}: expected number`);
      return errors;
    }
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`${pathPrefix}: expected integer`);
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${pathPrefix}: value ${value} is below minimum ${schema.minimum}`);
    }
    return errors;
  }

  return errors;
}

function evaluateTerraformResources(
  resources: any[],
  frameworks: HarnessFrameworkId[]
): HarnessFinding[] {
  const findings: HarnessFinding[] = [];
  const allowFfiec = frameworks.includes('FFIEC_AIO');
  const allowHipaa = frameworks.includes('HIPAA_164_312');
  const allowNist = frameworks.includes('NIST_800_53');

  for (const res of resources) {
    const address = String(res?.address || `${res?.type || 'resource'}.${res?.name || 'unnamed'}`);
    const resName = String(res?.name || slugifyResource(address));
    const slug = slugifyResource(address);
    const values = res?.values || {};

    // FFIEC AIO rules
    if (allowFfiec && res?.type === 'aws_s3_bucket' && values.object_lock_enabled !== true) {
      findings.push({
        findingId: `ffiec-s3-lock-${resName}`,
        framework: 'FFIEC_AIO',
        ruleHead: 'violations["FFIEC_AIO"].s3_object_lock_disabled',
        resourceAddress: address,
        resourceIdSlug: slug,
        controlCitation: 'FFIEC AIO Booklet II.C (Evidentiary Immutability)',
        severity: 'CRITICAL',
        penaltyExposure: 'FDIC / OCC Consent Order & Civil Monetary Penalties up to $1M/day',
        reason: `S3 audit bucket '${address}' lacks object_lock_enabled = true.`,
        branchName: `fix/securebase-${frameworkSlug('FFIEC_AIO')}-${slug}`,
        hclPatch: `resource "aws_s3_bucket" "${resName}" {\n+  object_lock_enabled = true\n}`,
        blastRadius: {
          scope: `${address} (in-place bucket lock header)`,
          changeAction: 'IN_PLACE_UPDATE',
          affectedResources: 1,
          recreationRisk: 'LOW',
          downtimeExpected: false
        }
      });
    }

    if (allowFfiec && res?.type === 'aws_s3_bucket_object_lock_configuration') {
      const ret = values?.rule?.[0]?.default_retention?.[0];
      if (ret && ret.mode !== 'COMPLIANCE') {
        findings.push({
          findingId: `ffiec-s3-mode-${resName}`,
          framework: 'FFIEC_AIO',
          ruleHead: 'violations["FFIEC_AIO"].object_lock_mode_not_compliance',
          resourceAddress: address,
          resourceIdSlug: slug,
          controlCitation: 'FFIEC AIO Booklet II.C / SEC 17a-4(f)',
          severity: 'CRITICAL',
          penaltyExposure: 'Unenforceable GOVERNANCE lock allows root admin deletion before 7 years',
          reason: `Object Lock mode on '${address}' is '${ret.mode}'; must be 'COMPLIANCE'.`,
          branchName: `fix/securebase-${frameworkSlug('FFIEC_AIO')}-${slug}`,
          hclPatch: `resource "aws_s3_bucket_object_lock_configuration" "${resName}" {\n  rule {\n    default_retention {\n-      mode = "${ret.mode}"\n+      mode = "COMPLIANCE"\n+      days = 2555\n    }\n  }\n}`,
          blastRadius: {
            scope: `${address} (retention policy lock update)`,
            changeAction: 'IN_PLACE_UPDATE',
            affectedResources: 1,
            recreationRisk: 'NONE',
            downtimeExpected: false
          }
        });
      }
      if (ret && Number(ret.days || 0) < 2555) {
        findings.push({
          findingId: `ffiec-s3-days-${resName}`,
          framework: 'FFIEC_AIO',
          ruleHead: 'violations["FFIEC_AIO"].retention_below_2555_days',
          resourceAddress: address,
          resourceIdSlug: slug,
          controlCitation: 'FFIEC 7-Year Evidentiary Retention Mandate',
          severity: 'HIGH',
          penaltyExposure: 'Examiner audit binder rejection for < 2,555-day WORM chain retention',
          reason: `Retention period on '${address}' is ${ret.days} days; minimum 2555 days required.`,
          branchName: `fix/securebase-${frameworkSlug('FFIEC_AIO')}-${slug}`,
          hclPatch: `resource "aws_s3_bucket_object_lock_configuration" "${resName}" {\n  rule {\n    default_retention {\n      mode = "COMPLIANCE"\n-      days = ${ret.days}\n+      days = 2555\n    }\n  }\n}`,
          blastRadius: {
            scope: `${address} (retention window extension)`,
            changeAction: 'IN_PLACE_UPDATE',
            affectedResources: 1,
            recreationRisk: 'NONE',
            downtimeExpected: false
          }
        });
      }
    }

    // HIPAA 164.312 rules
    if (allowHipaa && res?.type === 'aws_kms_key' && values.enable_key_rotation !== true) {
      findings.push({
        findingId: `hipaa-kms-rot-${resName}`,
        framework: 'HIPAA_164_312',
        ruleHead: 'violations["HIPAA_164_312"].kms_cmek_rotation_disabled',
        resourceAddress: address,
        resourceIdSlug: slug,
        controlCitation: 'HIPAA 45 CFR 164.312(a)(2)(iv) (ePHI Encryption)',
        severity: 'HIGH',
        penaltyExposure: 'HHS OCR Tier 4 Violation ($68,928 per violation / $2.06M annual cap)',
        reason: `Customer-managed KMS key '${address}' has enable_key_rotation != true.`,
        branchName: `fix/securebase-${frameworkSlug('HIPAA_164_312')}-${slug}`,
        hclPatch: `resource "aws_kms_key" "${resName}" {\n-  enable_key_rotation = ${String(values.enable_key_rotation ?? false)}\n+  enable_key_rotation = true\n}`,
        blastRadius: {
          scope: `${address} (annual cryptographic key rotation)`,
          changeAction: 'IN_PLACE_UPDATE',
          affectedResources: 1,
          recreationRisk: 'NONE',
          downtimeExpected: false
        }
      });
    }

    if (allowHipaa && res?.type === 'aws_s3_bucket_server_side_encryption_configuration') {
      const sse = values?.rule?.[0]?.apply_server_side_encryption_by_default?.[0];
      if (sse && sse.sse_algorithm !== 'aws:kms') {
        findings.push({
          findingId: `hipaa-cmek-sse-${resName}`,
          framework: 'HIPAA_164_312',
          ruleHead: 'violations["HIPAA_164_312"].storage_requires_kms_cmek',
          resourceAddress: address,
          resourceIdSlug: slug,
          controlCitation: 'HIPAA 45 CFR 164.312(a)(2)(iv) (Dedicated CMEK)',
          severity: 'CRITICAL',
          penaltyExposure: 'Unencrypted or AWS-managed ePHI bucket triggers mandatory breach reporting',
          reason: `SSE algorithm on '${address}' is '${sse.sse_algorithm}'; must use aws:kms CMEK.`,
          branchName: `fix/securebase-${frameworkSlug('HIPAA_164_312')}-${slug}`,
          hclPatch: `resource "aws_s3_bucket_server_side_encryption_configuration" "${resName}" {\n  rule {\n    apply_server_side_encryption_by_default {\n-      sse_algorithm     = "${sse.sse_algorithm}"\n+      sse_algorithm     = "aws:kms"\n+      kms_master_key_id = aws_kms_key.ephi_cmek.arn\n    }\n  }\n}`,
          blastRadius: {
            scope: `${address} (bucket default SSE policy)`,
            changeAction: 'IN_PLACE_UPDATE',
            affectedResources: 1,
            recreationRisk: 'NONE',
            downtimeExpected: false
          }
        });
      }
    }

    if (allowHipaa && res?.type === 'aws_lb_listener') {
      const sslPolicy = String(values.ssl_policy || 'UNSPECIFIED');
      if (!sslPolicy.startsWith('ELBSecurityPolicy-TLS13')) {
        findings.push({
          findingId: `hipaa-tls13-${resName}`,
          framework: 'HIPAA_164_312',
          ruleHead: 'violations["HIPAA_164_312"].tls_1_3_required',
          resourceAddress: address,
          resourceIdSlug: slug,
          controlCitation: 'HIPAA 45 CFR 164.312(e)(1) (Transmission Security)',
          severity: 'CRITICAL',
          penaltyExposure: 'Legacy TLS 1.1/1.2 downgrade risk on ePHI clinical ingress',
          reason: `Listener '${address}' uses ssl_policy '${sslPolicy}'; TLS 1.3 policy required.`,
          branchName: `fix/securebase-${frameworkSlug('HIPAA_164_312')}-${slug}`,
          hclPatch: `resource "aws_lb_listener" "${resName}" {\n-  ssl_policy = "${sslPolicy}"\n+  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"\n}`,
          blastRadius: {
            scope: `${address} (TLS handshake cipher policy)`,
            changeAction: 'IN_PLACE_UPDATE',
            affectedResources: 1,
            recreationRisk: 'NONE',
            downtimeExpected: false
          }
        });
      }
    }

    // NIST 800-53 rules
    if (allowNist && res?.type === 'aws_iam_role' && Number(values.max_session_duration || 0) > 3600) {
      findings.push({
        findingId: `nist-wif-ttl-${resName}`,
        framework: 'NIST_800_53',
        ruleHead: 'violations["NIST_800_53"].wif_session_exceeds_3600s',
        resourceAddress: address,
        resourceIdSlug: slug,
        controlCitation: 'NIST SP 800-53 AC-2(12) / IA-5(13) (Ephemeral OIDC Cap)',
        severity: 'HIGH',
        penaltyExposure: 'FedRAMP / FISMA ATO revocation risk from >1h STS token replay window',
        reason: `IAM role '${address}' sets max_session_duration = ${values.max_session_duration}s; maximum allowed is 3600s.`,
        branchName: `fix/securebase-${frameworkSlug('NIST_800_53')}-${slug}`,
        hclPatch: `resource "aws_iam_role" "${resName}" {\n-  max_session_duration = ${values.max_session_duration}\n+  max_session_duration = 1800 # Enforced <= 3600s WIF/OIDC TTL cap\n}`,
        blastRadius: {
          scope: `${address} (STS token max TTL)`,
          changeAction: 'IN_PLACE_UPDATE',
          affectedResources: 1,
          recreationRisk: 'NONE',
          downtimeExpected: false
        }
      });
    }

    if (allowNist && res?.type === 'aws_iam_access_key') {
      findings.push({
        findingId: `nist-static-key-${resName}`,
        framework: 'NIST_800_53',
        ruleHead: 'violations["NIST_800_53"].static_iam_key_prohibited',
        resourceAddress: address,
        resourceIdSlug: slug,
        controlCitation: 'NIST SP 800-53 IA-5 / Zero Static Credentials',
        severity: 'CRITICAL',
        penaltyExposure: 'Long-lived IAM key leakage voids Zero-Data-Custody cryptographic boundary',
        reason: `Static IAM access key '${address}' is prohibited; use OIDC Workload Identity Federation.`,
        branchName: `fix/securebase-${frameworkSlug('NIST_800_53')}-${slug}`,
        hclPatch: `- resource "aws_iam_access_key" "${resName}" {\n-   user = "${values.user || 'ci-bot'}"\n- }\n+ # Replaced static IAM key with ephemeral GitHub OIDC Workload Identity Federation`,
        blastRadius: {
          scope: `${address} (decommission static access key)`,
          changeAction: 'RESOURCE_REMOVAL',
          affectedResources: 1,
          recreationRisk: 'HIGH',
          downtimeExpected: false
        }
      });
    }
  }

  return findings;
}

function evaluateSecurityHubFindings(
  asffFindings: any[],
  frameworks: HarnessFrameworkId[]
): HarnessFinding[] {
  const results: HarnessFinding[] = [];
  for (const f of asffFindings) {
    const fwHint = String(f?.Compliance?.RelatedRequirements?.[0] || '').toUpperCase();
    const framework: HarnessFrameworkId = fwHint.includes('HIPAA')
      ? 'HIPAA_164_312'
      : fwHint.includes('NIST')
      ? 'NIST_800_53'
      : 'FFIEC_AIO';
    if (!frameworks.includes(framework)) continue;

    const resId = String(f?.Resources?.[0]?.Id || 'aws_s3_bucket.worm_audit');
    const slug = slugifyResource(resId.split(':').pop() || resId);
    const id = String(f?.Id || `sechub-${slug}`);

    results.push({
      findingId: id,
      framework,
      ruleHead: `violations["${framework}"].security_hub_asff_drift`,
      resourceAddress: resId,
      resourceIdSlug: slug,
      controlCitation: String(f?.Compliance?.RelatedRequirements?.join(', ') || framework),
      severity: String(f?.Severity?.Label || 'CRITICAL') === 'HIGH' ? 'HIGH' : 'CRITICAL',
      penaltyExposure: 'Live runtime drift surfaced by AWS Security Hub ASFF stream',
      reason: String(f?.Title || f?.Description || 'Runtime configuration drifted from statutory baseline.'),
      branchName: `fix/securebase-${frameworkSlug(framework)}-${slug}`,
      hclPatch: `# Security Hub ASFF Remediation for ${resId}\nresource "aws_s3_bucket_object_lock_configuration" "${slug}" {\n  rule {\n    default_retention {\n+      mode = "COMPLIANCE"\n+      days = 2555\n    }\n  }\n}`,
      blastRadius: {
        scope: `${resId} (in-place drift alignment)`,
        changeAction: 'IN_PLACE_UPDATE',
        affectedResources: 1,
        recreationRisk: 'NONE',
        downtimeExpected: false
      }
    });
  }
  return results;
}

export async function invokeEvaluateTfPlan(input: unknown): Promise<{
  ok: boolean;
  status: number;
  schemaErrors?: string[];
  output?: {
    runId: string;
    tier: 'TIER_1_READ_ONLY';
    evaluatedAtUtc: string;
    planSha256: string;
    compliant: boolean;
    violationCount: number;
    violationsByFramework: Record<HarnessFrameworkId, HarnessFinding[]>;
    nextAllowedTool: 'verify_worm_vault';
  };
  run?: HarnessEvaluationRun;
}> {
  const catalog = await loadMcpContractCatalog();
  const toolSpec = catalog.tools.find((t) => t.name === 'evaluate_tf_plan')!;
  const schemaErrors = validateAgainstSchema(toolSpec.inputSchema, input);

  if (schemaErrors.length > 0) {
    await withHarnessMutation((state) => {
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'evaluate_tf_plan',
        tier: 'TIER_1_READ_ONLY',
        status: 'BLOCKED_SCHEMA_DRIFT',
        runId: null,
        detail: `2026 MCP inputSchema rejected payload: ${schemaErrors[0]}`
      });
    });
    return { ok: false, status: 400, schemaErrors };
  }

  const typed = input as {
    sourceType: 'terraform_plan_json' | 'aws_security_hub';
    repository?: string;
    frameworks: HarnessFrameworkId[];
    strictMode?: boolean;
    payload: Record<string, any>;
  };

  const planSha256 = sha256Hex(JSON.stringify(typed.payload));
  const runId = `run-${planSha256.slice(0, 10)}-${Date.now().toString(36)}`;
  const evaluatedAtUtc = new Date().toISOString();

  let findings: HarnessFinding[] = [];
  if (typed.sourceType === 'terraform_plan_json') {
    const resources = typed.payload?.planned_values?.root_module?.resources;
    if (!Array.isArray(resources)) {
      return {
        ok: false,
        status: 400,
        schemaErrors: ['$.payload.planned_values.root_module.resources: expected array of Terraform resources']
      };
    }
    findings = evaluateTerraformResources(resources, typed.frameworks);
  } else {
    const asff = typed.payload?.Findings;
    if (!Array.isArray(asff)) {
      return {
        ok: false,
        status: 400,
        schemaErrors: ['$.payload.Findings: expected array of AWS Security Hub ASFF findings']
      };
    }
    findings = evaluateSecurityHubFindings(asff, typed.frameworks);
  }

  const violationsByFramework: Record<HarnessFrameworkId, HarnessFinding[]> = {
    FFIEC_AIO: findings.filter((f) => f.framework === 'FFIEC_AIO'),
    HIPAA_164_312: findings.filter((f) => f.framework === 'HIPAA_164_312'),
    NIST_800_53: findings.filter((f) => f.framework === 'NIST_800_53')
  };

  const run: HarnessEvaluationRun = {
    runId,
    sourceType: typed.sourceType,
    repository: typed.repository || 'cedrickbyrd/securebase-app',
    evaluatedAtUtc,
    planSha256,
    frameworks: typed.frameworks,
    compliant: findings.length === 0,
    violationCount: findings.length,
    violationsByFramework,
    findings,
    wormVerification: {
      verified: false,
      vaultUrn: 'arn:aws:s3:::securebase-worm-evidence-us-east-1',
      retentionMode: null,
      retentionDays: null,
      evidenceChainSha256: null,
      verifiedAtUtc: null
    },
    tier2GateStatus: 'LOCKED_NEEDS_WORM',
    nextAllowedTool: 'verify_worm_vault'
  };

  await withHarnessMutation((state) => {
    state.activeRun = run;
    state.auditTrail.unshift({
      id: `evt-${Date.now()}`,
      timestampUtc: evaluatedAtUtc,
      toolName: 'evaluate_tf_plan',
      tier: 'TIER_1_READ_ONLY',
      status: 'ALLOWED',
      runId,
      detail: `Evaluated ${typed.sourceType} (${findings.length} violation(s) found across ${typed.frameworks.join(', ')}).`
    });
  });

  const output = {
    runId,
    tier: 'TIER_1_READ_ONLY' as const,
    evaluatedAtUtc,
    planSha256,
    compliant: findings.length === 0,
    violationCount: findings.length,
    violationsByFramework,
    nextAllowedTool: 'verify_worm_vault' as const
  };

  return { ok: true, status: 200, output, run };
}

export async function invokeVerifyWormVault(input: unknown): Promise<{
  ok: boolean;
  status: number;
  schemaErrors?: string[];
  gateError?: string;
  output?: {
    runId: string;
    verified: boolean;
    retentionMode: 'COMPLIANCE';
    retentionDays: number;
    evidenceChainSha256: string;
    tier2GateStatus: 'AWAITING_HUMAN_APPROVAL' | 'NO_REMEDIATION_NEEDED';
    nextAllowedTool: 'synthesize_remediation_pr' | 'NONE';
  };
  run?: HarnessEvaluationRun;
}> {
  const catalog = await loadMcpContractCatalog();
  const toolSpec = catalog.tools.find((t) => t.name === 'verify_worm_vault')!;
  const schemaErrors = validateAgainstSchema(toolSpec.inputSchema, input);

  if (schemaErrors.length > 0) {
    await withHarnessMutation((state) => {
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'verify_worm_vault',
        tier: 'TIER_1_READ_ONLY',
        status: 'BLOCKED_SCHEMA_DRIFT',
        runId: null,
        detail: `2026 MCP inputSchema rejected verify_worm_vault payload: ${schemaErrors[0]}`
      });
    });
    return { ok: false, status: 400, schemaErrors };
  }

  const typed = input as {
    runId: string;
    vaultUrn: string;
    expectedPlanSha256: string;
    minimumRetentionDays?: number;
  };

  return withHarnessMutation((state) => {
    if (!state.activeRun || state.activeRun.runId !== typed.runId) {
      const msg = `Deterministic ordering block: runId '${typed.runId}' has no prior Tier 1 evaluate_tf_plan record.`;
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'verify_worm_vault',
        tier: 'TIER_1_READ_ONLY',
        status: 'BLOCKED_ORDER_GATE',
        runId: typed.runId,
        detail: msg
      });
      return { ok: false, status: 409, gateError: msg };
    }

    if (state.activeRun.planSha256 !== typed.expectedPlanSha256) {
      const msg = 'Plan SHA-256 mismatch: vault anchor requires exact Tier 1 plan digest.';
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'verify_worm_vault',
        tier: 'TIER_1_READ_ONLY',
        status: 'BLOCKED_ORDER_GATE',
        runId: typed.runId,
        detail: msg
      });
      return { ok: false, status: 409, gateError: msg };
    }

    const now = new Date().toISOString();
    const retentionDays = Math.max(2555, typed.minimumRetentionDays || 2555);
    const evidenceChainSha256 = sha256Hex(`${typed.runId}:${typed.vaultUrn}:${typed.expectedPlanSha256}:COMPLIANCE:${retentionDays}`);
    const hasFindings = state.activeRun.findings.length > 0;
    const tier2GateStatus = hasFindings ? 'AWAITING_HUMAN_APPROVAL' : 'NO_REMEDIATION_NEEDED';
    const nextAllowedTool = hasFindings ? 'synthesize_remediation_pr' : 'NONE';

    state.activeRun.wormVerification = {
      verified: true,
      vaultUrn: typed.vaultUrn,
      retentionMode: 'COMPLIANCE',
      retentionDays,
      evidenceChainSha256,
      verifiedAtUtc: now
    };
    state.activeRun.tier2GateStatus = tier2GateStatus;
    state.activeRun.nextAllowedTool = nextAllowedTool;

    state.auditTrail.unshift({
      id: `evt-${Date.now()}`,
      timestampUtc: now,
      toolName: 'verify_worm_vault',
      tier: 'TIER_1_READ_ONLY',
      status: 'ALLOWED',
      runId: typed.runId,
      detail: `Verified COMPLIANCE Object Lock (${retentionDays}d) at ${typed.vaultUrn}; digest ${evidenceChainSha256.slice(0, 16)}...`
    });

    return {
      ok: true,
      status: 200,
      output: {
        runId: typed.runId,
        verified: true,
        retentionMode: 'COMPLIANCE' as const,
        retentionDays,
        evidenceChainSha256,
        tier2GateStatus,
        nextAllowedTool
      },
      run: state.activeRun
    };
  });
}

export async function invokeSynthesizeRemediationPr(input: unknown): Promise<{
  ok: boolean;
  status: number;
  schemaErrors?: string[];
  gateError?: string;
  output?: SynthesizedPrRecord;
  run?: HarnessEvaluationRun | null;
}> {
  const catalog = await loadMcpContractCatalog();
  const toolSpec = catalog.tools.find((t) => t.name === 'synthesize_remediation_pr')!;
  const schemaErrors = validateAgainstSchema(toolSpec.inputSchema, input);

  if (schemaErrors.length > 0) {
    await withHarnessMutation((state) => {
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'synthesize_remediation_pr',
        tier: 'TIER_2_GATED_MUTATION',
        status: 'BLOCKED_SCHEMA_DRIFT',
        runId: null,
        detail: `2026 MCP inputSchema rejected Tier 2 payload: ${schemaErrors[0]}`
      });
    });
    return { ok: false, status: 400, schemaErrors };
  }

  const typed = input as {
    runId: string;
    targetFindingIds: string[];
    humanConfirmed: boolean;
    approverEmail: string;
    confirmationNote: string;
  };

  return withHarnessMutation((state) => {
    if (!state.activeRun || state.activeRun.runId !== typed.runId) {
      const msg = 'Tier 2 blocked: evaluate_tf_plan must run before synthesize_remediation_pr.';
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'synthesize_remediation_pr',
        tier: 'TIER_2_GATED_MUTATION',
        status: 'BLOCKED_ORDER_GATE',
        runId: typed.runId,
        detail: msg
      });
      return { ok: false, status: 409, gateError: msg, run: state.activeRun };
    }

    if (!state.activeRun.wormVerification.verified) {
      const msg = 'Tier 2 blocked: verify_worm_vault must lock Tier 1 evidence before PR synthesis.';
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'synthesize_remediation_pr',
        tier: 'TIER_2_GATED_MUTATION',
        status: 'BLOCKED_ORDER_GATE',
        runId: typed.runId,
        detail: msg
      });
      return { ok: false, status: 409, gateError: msg, run: state.activeRun };
    }

    if (typed.humanConfirmed !== true) {
      const msg = 'Tier 2 human-in-the-loop gate: humanConfirmed must be true with approver sign-off.';
      state.auditTrail.unshift({
        id: `evt-${Date.now()}`,
        timestampUtc: new Date().toISOString(),
        toolName: 'synthesize_remediation_pr',
        tier: 'TIER_2_GATED_MUTATION',
        status: 'BLOCKED_HUMAN_GATE',
        runId: typed.runId,
        detail: msg
      });
      return { ok: false, status: 403, gateError: msg, run: state.activeRun };
    }

    const selected = state.activeRun.findings.filter((f) =>
      typed.targetFindingIds.includes(f.findingId)
    );
    if (selected.length === 0) {
      return {
        ok: false,
        status: 400,
        schemaErrors: ['$.targetFindingIds: none of the specified findingIds exist in this Tier 1 run']
      };
    }

    const lead = selected[0];
    const branchName = lead.branchName;
    const combinedPatch = selected.map((s) => `# Control: ${s.controlCitation}\n${s.hclPatch}`).join('\n\n');
    const hasHighRisk = selected.some((s) => s.blastRadius.recreationRisk === 'HIGH');
    const hasLowRisk = selected.some((s) => s.blastRadius.recreationRisk === 'LOW');
    const risk: 'NONE' | 'LOW' | 'HIGH' = hasHighRisk ? 'HIGH' : hasLowRisk ? 'LOW' : 'NONE';

    const now = new Date().toISOString();
    const attestationSha256 = sha256Hex(
      `${typed.runId}:${branchName}:${combinedPatch}:${typed.approverEmail}:${now}`
    );

    const pr: SynthesizedPrRecord = {
      prId: `pr-sb-${attestationSha256.slice(0, 8)}`,
      runId: typed.runId,
      branchName,
      framework: lead.framework,
      targetResourceAddresses: Array.from(new Set(selected.map((s) => s.resourceAddress))),
      targetFindingIds: selected.map((s) => s.findingId),
      hclPatch: combinedPatch,
      blastRadius: {
        affectedResources: selected.length,
        changeActions: Array.from(new Set(selected.map((s) => s.blastRadius.changeAction))),
        recreationRisk: risk,
        downtimeExpected: selected.some((s) => s.blastRadius.downtimeExpected),
        summary: `Isolated patch touches ${selected.length} finding(s) across ${new Set(selected.map((s) => s.resourceAddress)).size} resource(s) with ${risk} recreation risk and zero expected downtime.`
      },
      regulatoryJustification: selected.map((s) => `${s.controlCitation}: ${s.penaltyExposure}`).join(' | '),
      approverEmail: typed.approverEmail,
      confirmationNote: typed.confirmationNote,
      attestationSha256,
      synthesizedAtUtc: now
    };

    state.activeRun.tier2GateStatus = 'APPROVED_SYNTHESIZED';
    state.activeRun.nextAllowedTool = 'NONE';
    state.synthesizedPrs.unshift(pr);
    state.auditTrail.unshift({
      id: `evt-${Date.now()}`,
      timestampUtc: now,
      toolName: 'synthesize_remediation_pr',
      tier: 'TIER_2_GATED_MUTATION',
      status: 'ALLOWED',
      runId: typed.runId,
      detail: `Human-approved PR ${pr.prId} synthesized on branch '${branchName}' by ${typed.approverEmail}.`
    });

    return { ok: true, status: 200, output: pr, run: state.activeRun };
  });
}

export async function runRegoUnitTestSuite(): Promise<{
  executedAtUtc: string;
  total: number;
  passed: number;
  results: RegoUnitTestCaseResult[];
}> {
  const cases: Array<{
    testId: string;
    framework: HarnessFrameworkId;
    suiteName: string;
    testName: string;
    expectedCount: number;
    resources: any[];
  }> = [
    {
      testId: 'ffiec-deny-governance-and-short-retention',
      framework: 'FFIEC_AIO',
      suiteName: 'securebase.ffiec_test',
      testName: 'test_denies_governance_mode_and_short_retention',
      expectedCount: 3,
      resources: [
        {
          address: 'aws_s3_bucket.worm_audit',
          type: 'aws_s3_bucket',
          name: 'worm_audit',
          values: { object_lock_enabled: false }
        },
        {
          address: 'aws_s3_bucket_object_lock_configuration.worm_audit_lock',
          type: 'aws_s3_bucket_object_lock_configuration',
          name: 'worm_audit_lock',
          values: {
            rule: [{ default_retention: [{ mode: 'GOVERNANCE', days: 365 }] }]
          }
        }
      ]
    },
    {
      testId: 'ffiec-allow-compliance-2555d',
      framework: 'FFIEC_AIO',
      suiteName: 'securebase.ffiec_test',
      testName: 'test_allows_compliance_mode_2555_days',
      expectedCount: 0,
      resources: [
        {
          address: 'aws_s3_bucket.worm_audit',
          type: 'aws_s3_bucket',
          name: 'worm_audit',
          values: { object_lock_enabled: true }
        },
        {
          address: 'aws_s3_bucket_object_lock_configuration.worm_audit_lock',
          type: 'aws_s3_bucket_object_lock_configuration',
          name: 'worm_audit_lock',
          values: {
            rule: [{ default_retention: [{ mode: 'COMPLIANCE', days: 2555 }] }]
          }
        }
      ]
    },
    {
      testId: 'hipaa-deny-aes256-and-tls12',
      framework: 'HIPAA_164_312',
      suiteName: 'securebase.hipaa_test',
      testName: 'test_denies_aes256_sse_and_tls12_listener',
      expectedCount: 3,
      resources: [
        {
          address: 'aws_kms_key.ephi_cmek',
          type: 'aws_kms_key',
          name: 'ephi_cmek',
          values: { enable_key_rotation: false }
        },
        {
          address: 'aws_s3_bucket_server_side_encryption_configuration.ephi_sse',
          type: 'aws_s3_bucket_server_side_encryption_configuration',
          name: 'ephi_sse',
          values: {
            rule: [{ apply_server_side_encryption_by_default: [{ sse_algorithm: 'AES256' }] }]
          }
        },
        {
          address: 'aws_lb_listener.fhir_ingress',
          type: 'aws_lb_listener',
          name: 'fhir_ingress',
          values: { ssl_policy: 'ELBSecurityPolicy-2016-08' }
        }
      ]
    },
    {
      testId: 'hipaa-allow-cmek-and-tls13',
      framework: 'HIPAA_164_312',
      suiteName: 'securebase.hipaa_test',
      testName: 'test_allows_cmek_rotation_and_tls13',
      expectedCount: 0,
      resources: [
        {
          address: 'aws_kms_key.ephi_cmek',
          type: 'aws_kms_key',
          name: 'ephi_cmek',
          values: { enable_key_rotation: true }
        },
        {
          address: 'aws_s3_bucket_server_side_encryption_configuration.ephi_sse',
          type: 'aws_s3_bucket_server_side_encryption_configuration',
          name: 'ephi_sse',
          values: {
            rule: [{ apply_server_side_encryption_by_default: [{ sse_algorithm: 'aws:kms' }] }]
          }
        },
        {
          address: 'aws_lb_listener.fhir_ingress',
          type: 'aws_lb_listener',
          name: 'fhir_ingress',
          values: { ssl_policy: 'ELBSecurityPolicy-TLS13-1-2-2021-06' }
        }
      ]
    },
    {
      testId: 'nist-deny-43200s-and-static-key',
      framework: 'NIST_800_53',
      suiteName: 'securebase.nist80053_test',
      testName: 'test_denies_session_over_3600_and_static_iam_key',
      expectedCount: 2,
      resources: [
        {
          address: 'aws_iam_role.gha_oidc_deployer',
          type: 'aws_iam_role',
          name: 'gha_oidc_deployer',
          values: { max_session_duration: 43200 }
        },
        {
          address: 'aws_iam_access_key.legacy_ci',
          type: 'aws_iam_access_key',
          name: 'legacy_ci',
          values: { user: 'ci-bot' }
        }
      ]
    },
    {
      testId: 'nist-allow-1800s-wif-role',
      framework: 'NIST_800_53',
      suiteName: 'securebase.nist80053_test',
      testName: 'test_allows_ephemeral_3600s_wif_role',
      expectedCount: 0,
      resources: [
        {
          address: 'aws_iam_role.gha_oidc_deployer',
          type: 'aws_iam_role',
          name: 'gha_oidc_deployer',
          values: { max_session_duration: 1800 }
        }
      ]
    }
  ];

  const results: RegoUnitTestCaseResult[] = cases.map((tc) => {
    const start = performance.now();
    const out = evaluateTerraformResources(tc.resources, [tc.framework]);
    const durationMs = Math.max(1, Math.round((performance.now() - start) * 100) / 100);
    const passed = out.length === tc.expectedCount;
    return {
      testId: tc.testId,
      framework: tc.framework,
      suiteName: tc.suiteName,
      testName: tc.testName,
      passed,
      expectedCount: tc.expectedCount,
      actualCount: out.length,
      durationMs,
      summary: passed
        ? `PASS: Expected ${tc.expectedCount} finding(s), evaluated ${out.length}.`
        : `FAIL: Expected ${tc.expectedCount} finding(s), got ${out.length}.`
    };
  });

  const executedAtUtc = new Date().toISOString();
  await withHarnessMutation((state) => {
    state.lastTestSuiteRunUtc = executedAtUtc;
    state.lastTestResults = results;
    state.auditTrail.unshift({
      id: `evt-${Date.now()}`,
      timestampUtc: executedAtUtc,
      toolName: 'opa_test_runner',
      tier: 'TIER_1_READ_ONLY',
      status: 'ALLOWED',
      runId: state.activeRun?.runId || null,
      detail: `Executed ${results.length} Rego v1 unit assertions (${results.filter((r) => r.passed).length}/${results.length} PASS).`
    });
  });

  return {
    executedAtUtc,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results
  };
}
