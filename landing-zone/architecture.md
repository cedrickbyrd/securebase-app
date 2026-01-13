Architecture Overview: 

SecureBase AWS Landing Zone (Terraform)

1. Purpose & Scope 

This document describes the architecture, design principles, and security intent of the Secure AWS Landing Zone, a Terraform-based foundation for deploying regulated workloads on AWS.
 
The landing zone is designed to support:

-Fintech environments subject to SOC 2, PCI-aligned controls, and internal audits
-Government contractors preparing for RMF/ATO assessments
-Organizations requiring strong isolation, auditability, and least-privilege access

This document focuses on platform architecture, not application-level design.

2. High-Level Architecture

Overview

SecureBase is a modular, Terraform-based Landing Zone designed to establish a multi-account AWS environment following the AWS Well-Architected Framework. It is specifically engineered for regulated industries (Fintech, Healthcare, GovTech) that require strict isolation, centralized logging, and automated compliance guardrails without the "black box" constraints of AWS Control Tower.

1. Multi-Account Strategy

SecureBase implements a Workload-Oriented Organizational Unit (OU) structure. This minimizes the blast radius of any single security incident and ensures clear billing and operational boundaries.

Key Characteristics:
--AWS Organizations with Service Control Policies (SCPs)
--Centralized identity via AWS IAM Identity Center
--Dedicated security and log archive accounts
--Infrastructure provisioned exclusively via Terraform

OPINIONATED ACCOUNT STRUCTURE
Designed for audit compliance and blast-radius control:

Management (Root Account)
├── Security OU
│   ├── Log Archive (centralized logs, 7yr retention)
│   └── Audit (read-only, compliance team access)
├── SharedServices OU
│   ├── Networking (Transit Gateway, VPC hub)
│   └── CI/CD (build pipelines, artifact storage)
└── Workloads OU
    ├── Production (customer-facing, isolated)
    ├── Staging (pre-prod validation)
    └── Development (sandbox, auto-shutdown)

Why This Structure:
- Passes SOC2, ISO27001, PCI-DSS audits
- Clear separation of duties (security vs workloads)
- Scales from 5 to 500 accounts
- No cross-environment contamination

##################
#Account Type	Purpose	Key Services
#
#Management	Root of the Organization; consolidated billing.	AWS Organizations, Service Control Policies (SCPs)
#
#Log Archive	Immutable central repository for all audit logs.	S3 (Locked), CloudTrail, VPC Flow Logs
#
#Security/Audit	Security tooling and read-only cross-account audit access.	Security Hub, GuardDuty, IAM Access Analyzer
#
#Shared Services	Centralized networking and shared tools (CI/CD, DNS).	Transit Gateway, IPAM, Route53
#
#Workloads	Isolated accounts for Dev, Staging, and Prod apps.	VPC, IAM Roles, Workload-specific resources
##################

2. Logical Architecture Layers

	A. Core Governance Layer

	--    SCPs (Service Control Policies): Deny-by-default logic for sensitive actions (e.g., disabling CloudTrail, leaving the Organization, or creating resources in unauthorized Regions).

	--    Tagging Policies: Enforces cost-center and environment tags at the API level to ensure 100% cost visibility.

	B. Security & Compliance Layer

    Identity Management: Integrated with AWS IAM Identity Center (SSO). SecureBase eliminates long-lived IAM user keys in favor of short-lived, role-based credentials.

	--    Centralized Logging: All cloudtrail and config logs are shipped to a dedicated Log Archive account with S3 Object Lock enabled to prevent tampering (critical for SOC2/NIST).

	--    Encryption: Enforces AES-256 encryption at rest for all S3 buckets and EBS volumes using Customer Managed Keys (CMKs) in AWS KMS.

	C. Network Infrastructure Layer

	--    Hub-and-Spoke Topology: Uses AWS Transit Gateway to route traffic between workload VPCs and the internet, ensuring all egress traffic can be inspected.

	--    VPC Design: Standardized 3-tier VPCs (Public, Private, Isolated) across all workload accounts.

3. Compliance Mapping

SecureBase is pre-configured to accelerate the following certifications:

    SOC 2 Type II: Specifically addressing Common Criteria (CC) 6.1 (Access) and CC 7.2 (Audit Logs) via centralized identity and logging.

    NIST 800-53: Implements Technical Controls for Least Privilege (AC-6) and Configuration Management (CM-2).

    PCI-DSS: Provides the required network segmentation and audit trail isolation for cardholder data environments (CDE).

4. Deployment Workflow (The "Account Factory")

SecureBase utilizes a GitOps-ready deployment pattern:

    VCS: Infrastructure code is stored in GitHub/GitLab.

    Plan: Terraform generates an execution plan showing exactly what will change.

    Apply: Terraform provisions the new account via the Management account's "Account Factory" module.

    Baseline: The new account is automatically bootstrapped with IAM roles, logging agents, and security guardrails.

5. Decision Log (ADR)

    Why not Control Tower? To provide "Infrastructure as Code" transparency. Engineers can see, audit, and modify every line of HCL without AWS-managed service interference.

    Why Terraform? For state management maturity and the ability to integrate with third-party providers (Datadog, Cloudflare) within the same landing zone. All resources are provisioned and managed via Terraform to enable repeatability, and reviewability, and change tracking.

3. Design Principles
######################
The landing zone is guided by the following principles:

Least Privilege

Access is granted using role-based permissions with narrowly scoped policies. Long-lived credentials are avoided wherever possible.

Account-Level Isolation

Workloads are isolated at the account boundary to limit blast radius and simplify compliance scoping.

Centralized Visibility

Security telemetry and audit logs are aggregated into dedicated accounts with restricted access.

Infrastructure as Code

All resources are provisioned and managed via Terraform to enable repeatability, reviewability, and change tracking.

Secure by Default

Security services, encryption, and logging are enabled by default rather than as optional add-ons.

4. AWS Organization & Account Responsibilities
Management Account

Owns AWS Organization configuration

Manages SCPs and account creation

Does not host workloads

Direct access to this account is tightly restricted.

Security / Log Archive Accounts

Centralized CloudTrail logs

Security services (GuardDuty, Security Hub, AWS Config)

Immutable log storage with retention controls

These accounts are designed to remain isolated from application administrators.

Shared Services Accounts

Networking primitives (hub VPCs, egress)

CI/CD pipelines and shared tooling

No customer data stored

Workload Accounts

Application and data resources

Environment separation (prod vs non-prod)

No centralized security tooling hosted locally

5. Identity & Access Architecture
Identity Model

The landing zone uses AWS IAM Identity Center as the primary authentication and authorization mechanism.

Access flow:

User → Identity Provider → IAM Identity Center → AWS Account Role


Key characteristics:

No IAM users in workload accounts

Group-based access via permission sets

Time-bound sessions

MFA enforced at the identity provider

Permission Sets

Standardized permission sets are defined for common roles:

Platform Engineer

Read-Only Auditor

Emergency Administrator (break-glass)

Permission sets are assigned consistently across accounts to simplify access reviews.

Break-Glass Access

A dedicated emergency administrator role exists for account recovery scenarios.

Controls include:

Manual MFA

Short session duration

Offline credential storage

Mandatory logging via CloudTrail

6. Security Control Layers

Security controls are applied in layers:

Preventive Controls

SCPs restricting high-risk actions

IAM policies enforcing least privilege

Account-level public access blocks

Detective Controls

Organization-wide CloudTrail

AWS Config rules

GuardDuty findings

Security Hub aggregation

Corrective Controls

Manual or automated response outside the scope of v1

Alerting integration points documented

7. Logging & Auditability
Centralized Logging

All accounts forward logs to a dedicated Log Archive account.

Characteristics:

Organization-level CloudTrail

Logs stored in encrypted S3 buckets

Access restricted to security personnel

Log Integrity

Logs are protected using:

S3 Object Lock (where supported)

Retention policies

Denial of delete actions via SCPs

This architecture is designed to prevent unauthorized modification or deletion of audit evidence.

8. Network Trust Boundaries (Design Intent)

While networking implementation details may vary, the landing zone assumes:

Workload accounts are private by default

No direct internet ingress to production workloads

Centralized egress and inspection patterns

Networking controls are treated as defense-in-depth, not the sole security boundary.

9. Terraform State & Change Management

Terraform state is treated as sensitive infrastructure metadata.

Expected controls:

Remote state stored in encrypted S3

State locking via DynamoDB

Restricted access to apply permissions

Separation between organization-level and workload-level applies

All changes are expected to be reviewed prior to application.

10. Threat Model (Summary)

The architecture is designed to mitigate common cloud threats, including:

Compromised developer credentials

Accidental public resource exposure

Privilege escalation within accounts

Insider misuse

Loss or tampering of audit logs

Mitigations are implemented through layered preventive and detective controls.

Detailed threat analysis is documented separately.

11. Compliance Alignment (High-Level)

This landing zone aligns with the intent of:

CIS AWS Foundations Benchmark

NIST SP 800-53 (AC, IA, AU, CM families)

SOC 2 Trust Service Criteria

Detailed control mappings are provided in compliance.md.

12. Out of Scope

The following are explicitly out of scope for v1:

Application security controls

Data classification enforcement

Automated incident response

FedRAMP High or IL5-specific controls

13. Assumptions & Preconditions

This architecture assumes:

The customer controls root account email addresses

An external identity provider is available

Terraform is the primary provisioning tool

Separate billing arrangements are handled outside this module

14. Document Lifecycle

This document evolves with the landing zone and reflects the current supported architecture.

Changes should be reviewed alongside Terraform updates.



######################

graph TD
    subgraph "AWS Organization"
        Root((Organization Root))
        
        subgraph "Security OU"
            Log[Log Archive Account]
            Audit[Security/Audit Account]
        end
        
        subgraph "Shared Services OU"
            Net[Networking Account]
            CI[Tools/DevOps Account]
        end
        
        subgraph "Workloads OU"
            Prod[Production Account]
            Staging[Staging Account]
            Dev[Development Account]
        end
    end

    Root --> Security_OU
    Root --> Shared_Services_OU
    Root --> Workloads_OU

    %% Flow of Logs
    Prod -.->|CloudTrail/Config| Log
    Staging -.->|CloudTrail/Config| Log
    
    %% Connectivity
    Net ---|Transit Gateway| Prod
    Net ---|Transit Gateway| Staging
    
    %% Styles
    style Root fill:#2563eb,color:#fff
    style Log fill:#1e293b,color:#fff
    style Audit fill:#1e293b,color:#fff
    style Prod fill:#059669,color:#fff
