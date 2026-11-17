import { StatutoryControl } from '../types/compliance';

export const STATUTORY_CONTROLS: StatutoryControl[] = [
  // FFIEC IT Handbook
  {
    framework: 'FFIEC',
    controlId: 'FFIEC-A-INFOSEC',
    controlName: 'Audit Trails & Non-Repudiation',
    category: 'Information Security / Appendix A',
    statutoryReference: 'FFIEC Information Security Booklet, App. A: Examination Procedures - Audit Trails & Activity Logging',
    description: 'Financial institutions must implement tamper-evident, non-repudiable audit logging for all privileged infrastructure events, access grants, and cryptographic operations.',
    remediationAdvice: 'Enable object-level audit logs, route logs to a dedicated central project or WORM sink, and disallow administrative log deletion.'
  },
  {
    framework: 'FFIEC',
    controlId: 'FFIEC-CMEK-ENC',
    controlName: 'Customer-Managed Key At-Rest Encryption (CMEK)',
    category: 'Data Protection & Encryption',
    statutoryReference: 'FFIEC Data Protection Standards; FDIC Core Banking Guidelines',
    description: 'All customer financial records and core banking state must be protected using Customer-Managed Encryption Keys (CMEK) with hardware security module (HSM) backing and automated rotation.',
    remediationAdvice: 'Configure kms_key_name or kms_master_key_id pointing to customer HSM key ring; replace cloud provider default managed keys.'
  },
  {
    framework: 'FFIEC',
    controlId: 'FFIEC-WORM-RET',
    controlName: 'Business Continuity & WORM Retention Vaulting',
    category: 'Business Continuity & Records Retention',
    statutoryReference: 'FFIEC Business Continuity Planning Booklet; FDIC 12 CFR Part 364',
    description: 'Critical transaction journals and evidence must be stored in Write-Once-Read-Many (WORM) storage with locked compliance retention periods preventing deletion even by root credentials.',
    remediationAdvice: 'Enable retention_policy with is_locked = true and retention_period = 2555 days (7 years) on Google Cloud Storage or S3 Object Lock COMPLIANCE mode.'
  },

  // SOC 2 Type II
  {
    framework: 'SOC2',
    controlId: 'CC6.1',
    controlName: 'Logical Access & Zero Trust Boundaries',
    category: 'Logical and Physical Access Controls',
    statutoryReference: 'AICPA Trust Services Criteria CC6.1 - Logical Access Security Measures',
    description: 'The entity implements logical access security software, zero-trust perimeter segmentation, and short-lived credentials to prevent unauthorized lateral movement.',
    remediationAdvice: 'Enforce Workload Identity Federation (WIF) and disable static service account keys or AWS long-lived access keys.'
  },
  {
    framework: 'SOC2',
    controlId: 'CC6.6',
    controlName: 'Boundary Protection & Public Ingress Prevention',
    category: 'Logical and Physical Access Controls',
    statutoryReference: 'AICPA Trust Services Criteria CC6.6 - Network Boundary Protection & Perimeter Filtering',
    description: 'Boundaries are established to protect data stores and compute clusters from unrestricted inbound traffic; public CIDR 0.0.0.0/0 ingress is prohibited on database and management ports.',
    remediationAdvice: 'Remove public IP allocations, enforce private Google access / AWS PrivateLink, and restrict security groups to authorized VPC CIDRs.'
  },
  {
    framework: 'SOC2',
    controlId: 'CC6.8',
    controlName: 'Configuration Drift & Malicious Code Prevention',
    category: 'System Operations',
    statutoryReference: 'AICPA Trust Services Criteria CC6.8 - Threat Prevention and Configuration Drift Control',
    description: 'The entity protects against unauthorized baseline changes, malicious configuration modification, and configuration drift through continuous automated pre-flight testing.',
    remediationAdvice: 'Require immutable infrastructure manifests, lock IaC definitions, and mandate cryptographic AST evaluations in gated CI/CD.'
  },
  {
    framework: 'SOC2',
    controlId: 'CC7.1',
    controlName: 'Change Management & Gated PR Governance',
    category: 'Change Management',
    statutoryReference: 'AICPA Trust Services Criteria CC7.1 - Infrastructure Change Authorization & Deployment Governance',
    description: 'Infrastructure changes must follow documented peer-reviewed pull request workflows, with automated compliance gates validating AST syntax prior to plan application.',
    remediationAdvice: 'Integrate SecureBase pre-flight AST evaluation into CI/CD pull request status checks with blocking gates.'
  },

  // HIPAA Security Rule
  {
    framework: 'HIPAA',
    controlId: '164.312(a)(2)(iv)',
    controlName: 'Automated Encryption/Decryption of PHI',
    category: 'Technical Safeguards',
    statutoryReference: '45 CFR § 164.312(a)(2)(iv) - Technical Safeguards: Encryption and Decryption',
    description: 'Implement a mechanism to encrypt and decrypt electronic protected health information (ePHI) using customer-managed cryptographic keys across all datastores.',
    remediationAdvice: 'Enforce customer KMS keys (CMEK) with automatic rotation across GCS, BigQuery, Cloud SQL, S3, and RDS storage tiers.'
  },
  {
    framework: 'HIPAA',
    controlId: '164.312(b)',
    controlName: 'Audit Controls & Hardware Retention',
    category: 'Technical Safeguards',
    statutoryReference: '45 CFR § 164.312(b) - Technical Safeguards: Audit Controls & Activity Tracking',
    description: 'Hardware, software, and procedural mechanisms must record and examine activity in information systems that contain or use electronic protected health information (ePHI).',
    remediationAdvice: 'Configure comprehensive data access audit logs (ADMIN_READ, DATA_READ, DATA_WRITE) and anchor log evidence in immutable WORM storage.'
  },
  {
    framework: 'HIPAA',
    controlId: '164.312(e)(1)',
    controlName: 'Transmission Security & TLS 1.3 Enforcement',
    category: 'Technical Safeguards',
    statutoryReference: '45 CFR § 164.312(e)(1) - Technical Safeguards: Transmission Security',
    description: 'Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.',
    remediationAdvice: 'Enforce ssl_required = true, tls_version = "TLS_1_3" or modern cipher suites, and reject unencrypted HTTP or plaintext endpoints.'
  },

  // NIST SP 800-53 Rev. 5
  {
    framework: 'NIST80053',
    controlId: 'AC-3',
    controlName: 'Access Enforcement',
    category: 'Access Control',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control AC-3: Access Enforcement',
    description: 'The information system enforces approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
    remediationAdvice: 'Use Uniform Bucket-Level Access or IAM condition-based policies; prohibit public allUsers or allAuthenticatedUsers grants.'
  },
  {
    framework: 'NIST80053',
    controlId: 'AC-6',
    controlName: 'Least Privilege',
    category: 'Access Control',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control AC-6: Least Privilege',
    description: 'The organization employs the principle of least privilege, allowing only authorized accesses for users (and processes acting on behalf of users) which are necessary to accomplish assigned organizational tasks.',
    remediationAdvice: 'Bind least-privilege roles using Workload Identity Federation instead of coarse primitive Owner or Editor roles.'
  },
  {
    framework: 'NIST80053',
    controlId: 'AU-2',
    controlName: 'Event Logging',
    category: 'Audit and Accountability',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control AU-2: Event Logging',
    description: 'The information system generates audit records for organization-defined events including user authentication, authorization failures, and administrative actions.',
    remediationAdvice: 'Define cloud audit logging configurations across all cloud service APIs with guaranteed retention.'
  },
  {
    framework: 'NIST80053',
    controlId: 'AU-9',
    controlName: 'Protection of Audit Information (WORM)',
    category: 'Audit and Accountability',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control AU-9: Protection of Audit Information',
    description: 'The information system protects audit records from unauthorized deletion, modification, or overwriting through hardware or software write-once-read-many controls.',
    remediationAdvice: 'Apply cloud storage bucket retention policy lock in COMPLIANCE mode; restrict bucket management permissions.'
  },
  {
    framework: 'NIST80053',
    controlId: 'SC-8',
    controlName: 'Transmission Integrity & Confidentiality',
    category: 'System and Communications Protection',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control SC-8: Transmission Confidentiality and Integrity',
    description: 'The information system protects the authenticity and confidentiality of transmitted information using approved cryptography and mutual authentication.',
    remediationAdvice: 'Enforce HTTPS/TLS 1.3 strictly and enable private Google access or AWS VPC endpoints for internal service communications.'
  },
  {
    framework: 'NIST80053',
    controlId: 'SC-13',
    controlName: 'Cryptographic Protection',
    category: 'System and Communications Protection',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control SC-13: Cryptographic Protection',
    description: 'The information system implements FIPS 140-2/3 validated cryptographic modules for protecting sensitive data.',
    remediationAdvice: 'Configure customer-managed HSM key rings (CMEK) with AES-256-GCM or Cloud HSM backing.'
  },
  {
    framework: 'NIST80053',
    controlId: 'SC-28',
    controlName: 'Protection of Information at Rest',
    category: 'System and Communications Protection',
    statutoryReference: 'NIST SP 800-53 Rev. 5, Control SC-28: Protection of Information at Rest',
    description: 'The information system protects the confidentiality and integrity of information at rest in datastores, backup media, and secondary storage.',
    remediationAdvice: 'Mandate CMEK key references on all storage buckets, disks, and relational database instances.'
  }
];
