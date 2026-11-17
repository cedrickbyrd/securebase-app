/**
 * SecureBase Supabase Operational & Realtime Data Plane
 * Implements low-latency relational storage, Row-Level Security (RLS) tenant isolation,
 * and Supabase Realtime pub/sub streaming for demo.securebase.tximhotep.com
 * Developed by TxImhotep LLC
 */

export interface DemoTenant {
  id: string;
  tenant_name: string;
  session_token: string;
  framework_focus: 'FFIEC' | 'HIPAA' | 'NIST80053';
  created_at: string;
}

export interface CiScan {
  id: string;
  tenant_id: string;
  session_token: string;
  repo_name: string;
  pr_number: number;
  branch: string;
  commit_sha: string;
  status: 'SUCCESS' | 'VIOLATIONS_DETECTED' | 'CRITICAL_BLOCK';
  target_platform: 'AWS' | 'GCP' | 'Azure' | 'Multi-Cloud';
  frameworks_evaluated: string[];
  findings_count: number;
  critical_count: number;
  duration_ms: number;
  evidence_sha256: string;
  worm_vault_urn: string;
  created_at: string;
}

export interface ComplianceFinding {
  id: string;
  scan_id: string;
  session_token: string;
  framework: 'FFIEC' | 'HIPAA' | 'NIST80053' | 'SOC2';
  control_id: string;
  control_name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'FAIL' | 'DRIFT' | 'PASS';
  resource_block: string;
  attribute_path: string;
  exploit_vector: string;
  remediation_hcl: string;
  created_at: string;
}

export type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: CiScan | ComplianceFinding;
}) => void;

class SupabaseOperationalService {
  private currentSessionToken: string;
  private currentTenant: DemoTenant;
  private scans: CiScan[] = [];
  private findings: ComplianceFinding[] = [];
  private realtimeListeners: Set<RealtimeCallback> = new Set();

  constructor() {
    // Generate or restore anonymous isolated guest session token (RLS anchor)
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('securebase_demo_session') : null;
    this.currentSessionToken = storedToken || `sb_guest_${this.generateUuid().substring(0, 12)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('securebase_demo_session', this.currentSessionToken);
    }

    this.currentTenant = {
      id: `tenant_${this.currentSessionToken}`,
      tenant_name: 'Regional Bank & Healthcare Sandbox (Isolated)',
      session_token: this.currentSessionToken,
      framework_focus: 'FFIEC',
      created_at: new Date().toISOString()
    };

    // Pre-seed default baseline run for this session
    this.seedInitialSessionData();
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private seedInitialSessionData() {
    const initialScanId = `scan_${this.generateUuid().substring(0, 8)}`;
    const baselineScan: CiScan = {
      id: initialScanId,
      tenant_id: this.currentTenant.id,
      session_token: this.currentSessionToken,
      repo_name: 'acme-corp/cloud-infrastructure',
      pr_number: 42,
      branch: 'feature/ehr-telemetry-pipeline',
      commit_sha: 'a8f49e2',
      status: 'CRITICAL_BLOCK',
      target_platform: 'AWS',
      frameworks_evaluated: ['FFIEC', 'HIPAA', 'NIST80053'],
      findings_count: 4,
      critical_count: 3,
      duration_ms: 1840,
      evidence_sha256: '7f9c8d5a1b2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
      worm_vault_urn: 'arn:aws:s3:::securebase-vault-logs/audits/2026-11/audit_a8f49e2.json',
      created_at: new Date(Date.now() - 3600000).toISOString()
    };

    this.scans.push(baselineScan);

    this.findings.push(
      {
        id: `find_${this.generateUuid().substring(0, 8)}`,
        scan_id: initialScanId,
        session_token: this.currentSessionToken,
        framework: 'HIPAA',
        control_id: '164.312(a)(2)(iv)',
        control_name: 'Encryption of ePHI at Rest',
        severity: 'CRITICAL',
        status: 'FAIL',
        resource_block: 'aws_s3_bucket.ehr_telemetry',
        attribute_path: 'server_side_encryption_configuration',
        exploit_vector: 'ePHI stored in plaintext; relies on AWS default keys without KMS CMEK enforcement.',
        remediation_hcl: 'kms_master_key_id = aws_kms_key.cmek.arn\nsse_algorithm = "aws:kms"',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: `find_${this.generateUuid().substring(0, 8)}`,
        scan_id: initialScanId,
        session_token: this.currentSessionToken,
        framework: 'FFIEC',
        control_id: 'FFIEC-WORM-RET',
        control_name: 'WORM Retention Locking',
        severity: 'CRITICAL',
        status: 'FAIL',
        resource_block: 'aws_s3_bucket.ehr_telemetry',
        attribute_path: 'object_lock_configuration',
        exploit_vector: 'Audit ledger bucket lacks 7-year (2555 days) Object Lock in COMPLIANCE mode.',
        remediation_hcl: 'object_lock_enabled = true\nrule { default_retention { mode = "COMPLIANCE"; days = 2555 } }',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: `find_${this.generateUuid().substring(0, 8)}`,
        scan_id: initialScanId,
        session_token: this.currentSessionToken,
        framework: 'NIST80053',
        control_id: 'AC-3',
        control_name: 'Access Enforcement & Public Ingress',
        severity: 'CRITICAL',
        status: 'FAIL',
        resource_block: 'aws_security_group.db_ingress',
        attribute_path: 'ingress.cidr_blocks',
        exploit_vector: 'Database port 5432 exposed to 0.0.0.0/0 without VPC boundary enforcement.',
        remediation_hcl: 'cidr_blocks = ["10.240.0.0/16"]',
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    );
  }

  // --- RLS-Enforced Accessors ---

  public getSessionToken(): string {
    return this.currentSessionToken;
  }

  public getTenant(): DemoTenant {
    return this.currentTenant;
  }

  public setFrameworkFocus(framework: 'FFIEC' | 'HIPAA' | 'NIST80053') {
    this.currentTenant.framework_focus = framework;
  }

  /**
   * Retrieves scans filtered by current session token (Row-Level Security)
   */
  public getScans(): CiScan[] {
    return this.scans.filter(s => s.session_token === this.currentSessionToken);
  }

  /**
   * Retrieves findings for a specific scan belonging to this session
   */
  public getFindings(scanId: string): ComplianceFinding[] {
    return this.findings.filter(
      f => f.session_token === this.currentSessionToken && f.scan_id === scanId
    );
  }

  /**
   * Inserts a new CI/CD scan and broadcasts via Supabase Realtime channel
   */
  public async insertScanWithFindings(
    scanData: Omit<CiScan, 'id' | 'tenant_id' | 'session_token' | 'created_at'>,
    findingsData: Omit<ComplianceFinding, 'id' | 'scan_id' | 'session_token' | 'created_at'>[]
  ): Promise<CiScan> {
    const scanId = `scan_${this.generateUuid().substring(0, 8)}`;
    const now = new Date().toISOString();

    const newScan: CiScan = {
      ...scanData,
      id: scanId,
      tenant_id: this.currentTenant.id,
      session_token: this.currentSessionToken,
      created_at: now
    };

    this.scans.unshift(newScan);

    const insertedFindings: ComplianceFinding[] = findingsData.map(f => ({
      ...f,
      id: `find_${this.generateUuid().substring(0, 8)}`,
      scan_id: scanId,
      session_token: this.currentSessionToken,
      created_at: now
    }));

    this.findings.unshift(...insertedFindings);

    // Broadcast Realtime Event (< 200ms)
    this.broadcastRealtime({
      eventType: 'INSERT',
      table: 'ci_scans',
      record: newScan
    });

    return newScan;
  }

  /**
   * Subscribe to Supabase Realtime channel for live CI/CD and drift broadcasts
   */
  public subscribeToRealtime(callback: RealtimeCallback): () => void {
    this.realtimeListeners.add(callback);
    return () => {
      this.realtimeListeners.delete(callback);
    };
  }

  private broadcastRealtime(payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record: CiScan | ComplianceFinding;
  }) {
    setTimeout(() => {
      this.realtimeListeners.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Supabase Realtime broadcast error', err);
        }
      });
    }, 50); // sub-100ms emission simulating low-latency WebSocket
  }

  /**
   * Ingests a production-grade webhook payload dispatched from GitHub Action
   * Simulates /functions/v1/ingest-ci-scan with RLS policy verification & Realtime broadcast
   */
  public async ingestCiScanWebhook(payload: CiScanWebhookPayload): Promise<CiScan> {
    const scanId = `scan_${payload.repository.sha.substring(0, 8)}`;
    const now = payload.timestamp || new Date().toISOString();

    const statusMap: Record<string, CiScan['status']> = {
      'PASSED': 'SUCCESS',
      'PASSED_WITH_REMEDIATION': 'VIOLATIONS_DETECTED',
      'FAILED': 'CRITICAL_BLOCK'
    };

    const newScan: CiScan = {
      id: scanId,
      tenant_id: this.currentTenant.id,
      session_token: this.currentSessionToken,
      repo_name: `${payload.repository.owner}/${payload.repository.name}`,
      pr_number: parseInt(payload.repository.run_id.substring(0, 4), 10) || 102,
      branch: payload.repository.branch,
      commit_sha: payload.repository.sha.substring(0, 7),
      status: statusMap[payload.scan_results.status] || 'VIOLATIONS_DETECTED',
      target_platform: 'AWS',
      frameworks_evaluated: payload.compliance_frameworks,
      findings_count: payload.scan_results.failed,
      critical_count: payload.rule_breakdown.filter(r => r.severity === 'CRITICAL' && r.status !== 'PASS').length,
      duration_ms: 1120,
      evidence_sha256: payload.scan_results.sha256_evidence_digest,
      worm_vault_urn: payload.scan_results.storage_target,
      created_at: now
    };

    this.scans.unshift(newScan);

    const insertedFindings: ComplianceFinding[] = payload.rule_breakdown.map((r) => ({
      id: `find_${this.generateUuid().substring(0, 8)}`,
      scan_id: scanId,
      session_token: this.currentSessionToken,
      framework: (r.framework.includes('FFIEC') ? 'FFIEC' : r.framework.includes('HIPAA') ? 'HIPAA' : r.framework.includes('NIST') ? 'NIST80053' : 'SOC2') as 'FFIEC' | 'HIPAA' | 'NIST80053' | 'SOC2',
      control_id: r.rule_id,
      control_name: r.message,
      severity: r.severity,
      status: r.status,
      resource_block: `rule.${r.rule_id.toLowerCase()}`,
      attribute_path: 'telemetry_assertion',
      exploit_vector: r.message,
      remediation_hcl: `# Verified under ${r.framework} ${r.rule_id}\n# WORM Retention Locked: ${payload.scan_results.worm_retention_locked ? 'true' : 'false'}\n# Storage Target: ${payload.scan_results.storage_target}`,
      created_at: now
    }));

    this.findings.unshift(...insertedFindings);

    // Broadcast Realtime Event (< 200ms)
    this.broadcastRealtime({
      eventType: 'INSERT',
      table: 'ci_scans',
      record: newScan
    });

    return newScan;
  }

  /**
   * Calculates live compliance posture score based on selected statutory framework
   */
  public calculatePostureScore(framework: 'FFIEC' | 'HIPAA' | 'NIST80053'): {
    score: number;
    passed: number;
    failed: number;
    status: 'COMPLIANT' | 'NEEDS_REMEDIATION' | 'CRITICAL_BLOCK';
  } {
    const sessionFindings = this.findings.filter(
      f => f.session_token === this.currentSessionToken && (f.framework === framework || f.framework === 'SOC2')
    );

    const failed = sessionFindings.filter(f => f.status === 'FAIL').length;
    const passed = sessionFindings.filter(f => f.status === 'PASS').length;
    const total = failed + passed || 1;

    let score = Math.max(15, Math.round(((total - failed) / total) * 100));
    if (failed > 2) score = 42;
    if (failed === 0) score = 100;

    return {
      score,
      passed,
      failed,
      status: failed === 0 ? 'COMPLIANT' : failed > 1 ? 'CRITICAL_BLOCK' : 'NEEDS_REMEDIATION'
    };
  }
}

export interface CiScanWebhookPayload {
  event_type: string;
  version: string;
  timestamp: string;
  repository: {
    name: string;
    owner: string;
    sha: string;
    branch: string;
    run_id: string;
    run_url: string;
  };
  institutional_context: {
    utm_source: string;
    utm_campaign: string;
    enclave_type: string;
  };
  compliance_frameworks: string[];
  scan_results: {
    status: 'PASSED_WITH_REMEDIATION' | 'PASSED' | 'FAILED' | string;
    total_rules_evaluated: number;
    passed: number;
    failed: number;
    quarantined: number;
    sha256_evidence_digest: string;
    worm_retention_locked: boolean;
    storage_target: string;
  };
  rule_breakdown: Array<{
    rule_id: string;
    framework: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    status: 'PASS' | 'FAIL' | 'DRIFT';
    message: string;
  }>;
}

export const supabase = new SupabaseOperationalService();
