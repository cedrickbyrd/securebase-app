export interface StorageBucketAudit {
  name: string;
  location: string;
  uniformBucketLevelAccess: boolean;
  publicAccessPrevention: string;
  defaultKmsKeyName: string;
  versioningEnabled: boolean;
}

export interface ComplianceScorecard {
  timestamp: string;
  overallScore: number;
  frameworks: {
    ffiecScore: number;
    soc2Score: number;
    hipaaScore: number;
  };
  findings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'PASS';
    control: string;
    resource: string;
    description: string;
  }>;
}

export function evaluateGcpCompliance(buckets: StorageBucketAudit[]): ComplianceScorecard {
  let passedChecks = 0;
  let totalChecks = buckets.length * 4;
  const findings: ComplianceScorecard['findings'] = [];

  for (const bucket of buckets) {
    // 1. CMEK Check (FFIEC IS §II.A.1)
    if (bucket.defaultKmsKeyName && !bucket.defaultKmsKeyName.includes('Google-Managed')) {
      passedChecks++;
      findings.push({ severity: 'PASS', control: 'FFIEC-IS-II.A.1', resource: bucket.name, description: 'CMEK encryption verified.' });
    } else {
      findings.push({ severity: 'HIGH', control: 'FFIEC-IS-II.A.1', resource: bucket.name, description: 'Bucket relies on default provider keys; CMEK required.' });
    }

    // 2. Uniform Access Check (SOC 2 CC6.1)
    if (bucket.uniformBucketLevelAccess) {
      passedChecks++;
      findings.push({ severity: 'PASS', control: 'SOC2-CC6.1', resource: bucket.name, description: 'Uniform bucket-level access enforced.' });
    } else {
      findings.push({ severity: 'HIGH', control: 'SOC2-CC6.1', resource: bucket.name, description: 'Legacy ACLs detected; UBLA required.' });
    }

    // 3. Public Access Prevention (HIPAA §164.312)
    if (bucket.publicAccessPrevention === 'enforced') {
      passedChecks++;
      findings.push({ severity: 'PASS', control: 'HIPAA-164.312', resource: bucket.name, description: 'Public access prevention enforced.' });
    } else {
      findings.push({ severity: 'CRITICAL', control: 'HIPAA-164.312', resource: bucket.name, description: 'Public access prevention not enforced.' });
    }

    // 4. Object Versioning (Tamper-Evidence)
    if (bucket.versioningEnabled) {
      passedChecks++;
      findings.push({ severity: 'PASS', control: 'FFIEC-BCP-II.B', resource: bucket.name, description: 'Object versioning active.' });
    } else {
      findings.push({ severity: 'MEDIUM', control: 'FFIEC-BCP-II.B', resource: bucket.name, description: 'Versioning disabled; risk of data overwrites.' });
    }
  }

  const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  return {
    timestamp: new Date().toISOString(),
    overallScore,
    frameworks: {
      ffiecScore: overallScore,
      soc2Score: overallScore,
      hipaaScore: overallScore,
    },
    findings,
  };
}
