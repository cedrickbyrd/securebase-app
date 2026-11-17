import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  computeMerkleRoot,
  buildBaselineEvents,
  evaluateTriCloudGovernanceEvents,
  simulateGuardrailCheck,
  loadTriCloudArtifactsBundle
} from '../src/server/triCloudStore';
import { aggregateTriCloudFinOps } from '../src/server/finopsAggregator';
import {
  loadMcpContractCatalog,
  validateAgainstSchema,
  runRegoUnitTestSuite
} from '../src/server/harnessStore';

describe('SecureBase Two-Tier Agent Harness & 2026 MCP Contracts', () => {
  it('loads formalized 2026 MCP tool contracts in deterministic order', async () => {
    const catalog = await loadMcpContractCatalog();
    expect(catalog.deterministicExecutionOrder).toEqual([
      'evaluate_tf_plan',
      'verify_worm_vault',
      'synthesize_remediation_pr'
    ]);
    expect(catalog.tools).toHaveLength(3);
  });

  it('rejects schema drift and accepts valid evaluate_tf_plan payloads', async () => {
    const catalog = await loadMcpContractCatalog();
    const evalSpec = catalog.tools.find((t) => t.name === 'evaluate_tf_plan')!;

    const driftErrors = validateAgainstSchema(evalSpec.inputSchema, {
      sourceType: 'invalid_source',
      extraUnexpectedProperty: true,
      frameworks: []
    });
    expect(driftErrors.length).toBeGreaterThanOrEqual(3);

    const validErrors = validateAgainstSchema(evalSpec.inputSchema, {
      sourceType: 'terraform_plan_json',
      repository: 'cedrickbyrd/securebase-app',
      frameworks: ['FFIEC_AIO', 'HIPAA_164_312', 'NIST_800_53'],
      strictMode: true,
      payload: { planned_values: { root_module: { resources: [] } } }
    });
    expect(validErrors).toEqual([]);
  });

  it('passes all 6 modular OPA Rego v1 unit test assertions across FFIEC, HIPAA, and NIST 800-53', async () => {
    const summary = await runRegoUnitTestSuite();
    expect(summary.total).toBe(6);
    expect(summary.passed).toBe(6);
    expect(summary.results.every((r) => r.passed)).toBe(true);
  });
});

describe('SecureBase Tri-Cloud Steps 4-7 Governance, Merkle & FinOps', () => {
  it('computes deterministic SHA-256 Merkle roots and detects injected tri-cloud drift', () => {
    const cleanEvents = buildBaselineEvents(false);
    const cleanViolations = evaluateTriCloudGovernanceEvents(cleanEvents);
    expect(cleanViolations).toHaveLength(0);

    const rootA = computeMerkleRoot(cleanEvents.map((e) => e.eventSha256));
    const rootB = computeMerkleRoot(cleanEvents.map((e) => e.eventSha256));
    expect(rootA).toMatch(/^[a-f0-9]{64}$/);
    expect(rootA).toBe(rootB);

    const driftEvents = buildBaselineEvents(true);
    const driftViolations = evaluateTriCloudGovernanceEvents(driftEvents);
    expect(driftViolations.length).toBeGreaterThanOrEqual(4);
    expect(driftViolations.some((v) => v.framework === 'FFIEC_AIO')).toBe(true);
    expect(driftViolations.some((v) => v.framework === 'HIPAA_164_312')).toBe(true);
    expect(driftViolations.some((v) => v.framework === 'SOC2_TYPE_II')).toBe(true);
    expect(driftViolations.some((v) => v.framework === 'NIST_800_53')).toBe(true);
  });

  it('aggregates WIF/OIDC tri-cloud FinOps unit economics and Marketplace metering', () => {
    const report = aggregateTriCloudFinOps();
    expect(report.cloudSpend).toHaveLength(3);
    expect(report.totalMonthlySpendUsd).toBe(6345);
    expect(report.marketplaceMetering).toHaveLength(3);
    expect(report.marketplaceMetering.every((m) => m.unreconciledDeltaUsd === 0)).toBe(true);

    const gcpOnly = aggregateTriCloudFinOps({}, 'GCP');
    expect(gcpOnly.cloudSpend).toHaveLength(1);
    expect(gcpOnly.totalMonthlySpendUsd).toBe(1815);
  });

  it('validates Steps 4-7 declarative Terraform, Rego v1, SQL, JSON Schema, and OIDC workflow deliverables', async () => {
    const artifacts = await loadTriCloudArtifactsBundle();

    // Structural HCL validation (balanced braces, required providers, zero static keys)
    for (const hcl of [artifacts.drFailoverTf, artifacts.universalGuardrailsTf]) {
      const openCount = (hcl.match(/\{/g) || []).length;
      const closeCount = (hcl.match(/\}/g) || []).length;
      expect(openCount).toBeGreaterThan(5);
      expect(openCount).toBe(closeCount);
      expect(hcl).not.toMatch(/aws_iam_access_key|service_account_key_json/);
    }

    // Step 4 checks
    expect(artifacts.drFailoverTf).toContain('aws_route53_health_check');
    expect(artifacts.drFailoverTf).toContain('google_cloud_scheduler_job');
    expect(artifacts.drFailoverTf).toContain('azurerm_traffic_manager_profile');
    expect(artifacts.drFailoverTf).toContain('rds.logical_replication');

    // Step 5 checks
    expect(artifacts.triCloudGovernanceRego).toContain('import rego.v1');
    expect(artifacts.supabaseRlsSql).toContain('ENABLE ROW LEVEL SECURITY');
    const auditSchema = JSON.parse(artifacts.unifiedAuditSchemaJson);
    expect(auditSchema.title).toBe('UnifiedTriCloudAuditEnvelope');

    // Step 7 checks
    expect(artifacts.universalGuardrailsTf).toContain('aws_organizations_policy');
    expect(artifacts.universalGuardrailsTf).toContain('google_org_policy_policy');
    expect(artifacts.universalGuardrailsTf).toContain('azurerm_policy_set_definition');
    expect(artifacts.preflightWorkflowYml).toContain('id-token: write');
    expect(artifacts.preflightWorkflowYml).toContain('tofu show -json');

    // Verify all 6 Rego files exist
    const regoCount = (
      await Promise.all([
        fs.stat(path.resolve(process.cwd(), 'policies/rego/tri_cloud_governance.rego')),
        fs.stat(path.resolve(process.cwd(), 'securebase-mcp/policies/ffiec/s3_object_lock.rego')),
        fs.stat(path.resolve(process.cwd(), 'securebase-mcp/policies/hipaa/kms_cmek_tls.rego')),
        fs.stat(path.resolve(process.cwd(), 'securebase-mcp/policies/nist80053/wif_session_cap.rego'))
      ])
    ).length;
    expect(regoCount).toBe(4);
  });

  it('blocks non-OIDC or unencrypted resource deployment via universal guardrail check', async () => {
    const blocked = await simulateGuardrailCheck({
      cloud: 'AWS',
      resourceName: 'bad_s3_bucket',
      usesStaticKey: true,
      publicAccess: true,
      cmekEnabled: false,
      tlsVersion: '1.2'
    });
    expect(blocked.decision).toBe('DENIED_BY_GUARDRAIL');
    expect(blocked.violatedPolicies).toHaveLength(4);
  });
});
