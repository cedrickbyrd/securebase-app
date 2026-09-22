export interface AzureStorageAudit {
  name: string;
  location: string;
  allowBlobPublicAccess: boolean;
  minTlsVersion: string;
  supportsHttpsTrafficOnly: boolean;
  versioningEnabled: boolean;
  hasImmutabilityPolicy: boolean;
}

export function evaluateAzureCompliance(accounts: AzureStorageAudit[]) {
  let passed = 0;
  const total = accounts.length * 4;
  const findings: Array<{ severity: string; control: string; description: string }> = [];

  for (const acc of accounts) {
    // 1. Public Access Prevention (HIPAA §164.312)
    if (!acc.allowBlobPublicAccess) {
      passed++;
      findings.push({ severity: "PASS", control: "HIPAA-164.312", description: `Blob public access blocked on ${acc.name}` });
    } else {
      findings.push({ severity: "CRITICAL", control: "HIPAA-164.312", description: `Blob public access allowed on ${acc.name}` });
    }

    // 2. Encryption in Transit (SOC 2 CC6.7)
    if (acc.supportsHttpsTrafficOnly && acc.minTlsVersion === "TLS1_2") {
      passed++;
      findings.push({ severity: "PASS", control: "SOC2-CC6.7", description: `Enforced HTTPS & TLS 1.2+ on ${acc.name}` });
    } else {
      findings.push({ severity: "HIGH", control: "SOC2-CC6.7", description: `Insecure transit protocol on ${acc.name}` });
    }

    // 3. WORM Immutability Policy (FFIEC IS §II.D.1)
    if (acc.hasImmutabilityPolicy) {
      passed++;
      findings.push({ severity: "PASS", control: "FFIEC-IS-II.D.1", description: `Immutable WORM policy active on ${acc.name}` });
    } else {
      findings.push({ severity: "HIGH", control: "FFIEC-IS-II.D.1", description: `WORM retention missing on ${acc.name}` });
    }

    // 4. Object Versioning (FFIEC BCP §II.B)
    if (acc.versioningEnabled) {
      passed++;
      findings.push({ severity: "PASS", control: "FFIEC-BCP-II.B", description: `Blob versioning active on ${acc.name}` });
    } else {
      findings.push({ severity: "MEDIUM", control: "FFIEC-BCP-II.B", description: `Blob versioning disabled on ${acc.name}` });
    }
  }

  const score = total > 0 ? Math.round((passed / total) * 100) : 100;
  return { score, findings };
}
