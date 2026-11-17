/**
 * SecureBase - Sovereign Cloud Compliance & Autonomous Remediation Engine
 * Types for Statutory Frameworks, AST Parsing, and WORM Attestations
 * Developed by TxImhotep LLC
 */

export type StatutoryFramework = 'FFIEC' | 'SOC2' | 'HIPAA' | 'NIST80053';

export type CloudPlatform = 'GCP' | 'AWS' | 'Azure' | 'Multi-Cloud';

export type EvaluationStatus = 'COMPLIANT' | 'DRIFT_DETECTED' | 'CRITICAL_FAILURE';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ControlStatus = 'PASS' | 'FAIL' | 'DRIFT';

export interface StatutoryControl {
  framework: StatutoryFramework;
  controlId: string;
  controlName: string;
  category: string;
  statutoryReference: string;
  description: string;
  remediationAdvice: string;
}

export interface ControlEvaluationResult {
  framework: StatutoryFramework;
  controlId: string;
  controlName: string;
  severity: SeverityLevel;
  status: ControlStatus;
  findingDetails: string;
  remediationAction: string;
  affectedAttributes: string[];
}

export interface RootCauseFinding {
  resourceType: string;
  resourceName: string;
  lineNumbers: string;
  blockAttribute: string;
  currentValue: string;
  expectedValue: string;
  technicalExploitVector: string;
  statutoryImpact: string;
}

export interface WormVaultRetention {
  retention_mode: 'COMPLIANCE' | 'GOVERNANCE';
  retention_period_days: number;
  vault_type: 'GCS_BUCKET_LOCK' | 'AWS_S3_OBJECT_LOCK';
  vault_urn: string;
  lock_immutable: boolean;
}

export interface WormEvidenceAttestation {
  evidence_id: string;
  timestamp_utc: string;
  vendor: 'TxImhotep LLC';
  engine: 'SecureBase Shift-Left v1.0.2';
  gcp_project: 'SecureBase-GCP [594006980795]';
  repository: 'cedrickbyrd/securebase-app';
  portal: 'demo.securebase.tximhotep.com';
  target_platform: CloudPlatform;
  evaluation_status: EvaluationStatus;
  framework_evaluation: Record<string, {
    passed_controls: number;
    failed_controls: number;
    drift_controls: number;
    status: 'COMPLIANT' | 'NON_COMPLIANT';
  }>;
  assessed_scope: string[];
  remediation_status: 'PATCH_SYNTHESIZED' | 'NO_REMEDIATION_NEEDED';
  evidence_sha256: string;
  worm_vault_retention: WormVaultRetention;
}

export interface RemediationAnnotation {
  type: 'CMEK_KMS' | 'WORM_LOCK' | 'PRIVATE_NETWORKING' | 'TLS_ENCRYPTION' | 'ZERO_TRUST';
  title: string;
  description: string;
  hclSnippet: string;
}

export interface AuditReport {
  id: string;
  createdAt: string;
  targetPlatform: CloudPlatform;
  evaluationStatus: EvaluationStatus;
  assessedScope: string[];
  controls: ControlEvaluationResult[];
  rootCauses: RootCauseFinding[];
  remediationPatchHcl: string;
  remediationAnnotations: RemediationAnnotation[];
  wormAttestation: WormEvidenceAttestation;
  originalCode: string;
  scenarioName?: string;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  domain: 'Banking (FFIEC/FDIC)' | 'Healthcare (HIPAA)' | 'Critical Infrastructure (NIST)' | 'FinTech (SOC 2)';
  platform: CloudPlatform;
  description: string;
  initialCode: string;
  expectedStatus: EvaluationStatus;
  highlightedViolation: string;
}
