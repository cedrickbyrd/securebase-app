Threat Model

Secure AWS Landing Zone (Terraform)

1. Purpose

This document describes the threat model for the Secure AWS Landing Zone.
It identifies realistic threats applicable to regulated AWS environments and documents the architectural controls used to mitigate, detect, and respond to those threats.

This threat model focuses on:

Platform and account-level risks

Identity, access, and configuration threats

Audit and logging integrity

Application-level and data-layer threats are out of scope.

2. Scope & Assumptions
In Scope

AWS Organization and account structure

Identity and access management

Logging and audit infrastructure

Terraform state and change management

Shared services and security tooling accounts

Out of Scope

Application vulnerabilities

Business logic flaws

Customer data classification

Incident response automation

Assumptions

An external identity provider is in use

MFA is enforced at the identity provider

Terraform is the primary provisioning mechanism

Administrative access is limited and auditable

3. Threat Modeling Approach

This threat model uses a control-oriented approach rather than a theoretical adversary model.

Threats are categorized by:

Threat Description

Impact

Preventive Controls

Detective Controls

This format aligns with audit and risk assessment expectations.

4. Threat Categories & Mitigations
4.1 Compromised Human Credentials

Threat
An attacker gains access to a developer or administrator identity through phishing, credential reuse, or malware.

Impact

Unauthorized access to AWS resources

Potential privilege escalation

Unauthorized configuration changes

Preventive Controls

Centralized authentication via IAM Identity Center

MFA enforced at the identity provider

No long-lived IAM user credentials in workload accounts

Least-privilege permission sets

Short session durations

Detective Controls

CloudTrail authentication and authorization logs

GuardDuty findings for anomalous behavior

Identity Center access logs

4.2 Privilege Escalation Within an AWS Account

Threat
A user or role attempts to elevate privileges beyond intended scope.

Impact

Loss of separation of duties

Potential compromise of sensitive resources

Preventive Controls

SCPs restricting high-risk IAM actions

Permission sets scoped to job function

Administrative privileges limited to specific roles

Separation between management, security, and workload accounts

Detective Controls

CloudTrail monitoring for IAM policy changes

AWS Config tracking IAM configuration drift

Security Hub aggregated findings

4.3 Accidental or Malicious Public Resource Exposure

Threat
Resources (e.g., S3 buckets, services) are unintentionally exposed to the public internet.

Impact

Data exposure

Compliance violations

Reputational damage

Preventive Controls

Account-level S3 public access blocks

SCPs denying public ACL configurations

Private-by-default networking assumptions

Explicit review of ingress patterns

Detective Controls

AWS Config rules detecting public exposure

Security Hub findings

GuardDuty alerts (where applicable)

4.4 Loss or Tampering of Audit Logs

Threat
An attacker attempts to delete, modify, or disable audit logs to conceal activity.

Impact

Loss of forensic evidence

Audit failure

Reduced incident response capability

Preventive Controls

Organization-level CloudTrail

Centralized log archive account

Restricted access to log storage

SCPs denying log deletion

Immutable storage and retention policies

Detective Controls

CloudTrail monitoring for logging configuration changes

AWS Config rules for logging enforcement

Security Hub alerts on logging anomalies

4.5 Insider Misuse of Authorized Access

Threat
An authorized user intentionally or unintentionally misuses their access.

Impact

Unauthorized changes

Data exposure

Compliance violations

Preventive Controls

Least-privilege access model

Role-based access assignments

Separation of duties across accounts

Limited use of administrative roles

Detective Controls

Centralized CloudTrail analysis

Periodic access reviews

Security Hub and Config reporting

4.6 Misconfiguration Through Manual Changes

Threat
Manual changes bypass infrastructure as code controls, introducing configuration drift.

Impact

Security control degradation

Inconsistent environments

Audit findings

Preventive Controls

Terraform as the authoritative provisioning mechanism

Limited apply permissions

SCPs restricting unauthorized changes

Clear separation between organization and workload configuration

Detective Controls

AWS Config drift detection

Terraform plan/apply reviews

CloudTrail change tracking

4.7 Compromise of Terraform State

Threat
Terraform state files are accessed or modified by unauthorized parties.

Impact

Exposure of sensitive metadata

Unauthorized infrastructure manipulation

Preventive Controls

Encrypted remote state storage

DynamoDB state locking

Restricted access to state buckets

Separation of state by environment

Detective Controls

S3 access logging

CloudTrail monitoring for state access

Periodic state access reviews

4.8 Cross-Account Trust Abuse

Threat
Improperly configured trust relationships allow unauthorized cross-account access.

Impact

Lateral movement across accounts

Expanded blast radius

Preventive Controls

Explicit trust policies

Centralized role assumption patterns

SCPs limiting trust relationships

Minimal cross-account access by default

Detective Controls

CloudTrail role assumption logs

Security Hub findings

Periodic trust policy review

5. Residual Risk

No architecture eliminates all risk.
Residual risk is accepted in areas where:

Controls are layered but not absolute

Manual processes remain necessary

External dependencies exist (e.g., identity provider security)

Residual risks should be documented and reviewed periodically.

6. Threat Model Maintenance

This threat model is reviewed:

Upon major architectural changes

When introducing new AWS services

During compliance or risk assessments

Updates to this document should align with Terraform changes and security posture reviews.

7. Relationship to Other Documents

This threat model should be read in conjunction with:

architecture.md

compliance.md

Terraform module documentation

Together, these documents provide a comprehensive view of the landing zone’s security posture.

Why This Document Matters

This threat model:

Demonstrates proactive risk analysis

Supports audit and compliance activities

Reduces ambiguity during assessments

Builds trust with regulated customers

