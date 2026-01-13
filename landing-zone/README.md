SecureBase

SecureBase is a Terraform-based secure AWS landing zone that delivers a multi-account AWS Organization with centralized identity, logging, and baseline security guardrails, suitable for SOC 2 readiness and RMF-aligned environments.

SecureBase provides platform-level security foundations for regulated workloads.
It does not claim compliance or authorization.

Who SecureBase Is For

SecureBase is designed for teams that need credible security foundations, not marketing claims.

Typical users include:

Fintech startups preparing for SOC 2 audits

Government contractors operating in RMF-informed environments

SaaS companies with security and audit requirements

Platform and security teams standardizing AWS foundations

Consultants delivering regulated AWS environments

If you need a defensible baseline you can explain to auditors, SecureBase is for you.

What SecureBase Delivers (v0.1)

SecureBase v0.1 delivers a repeatable AWS foundation with the following outcomes:

🏢 Multi-Account AWS Organization

AWS Organizations with clear trust boundaries

Dedicated accounts for:

Management

Security

Log archive

Workloads

Service Control Policies (SCPs) enforcing guardrails

Reduced blast radius through account isolation

🔐 Centralized Identity & Access

AWS IAM Identity Center (SSO) as the primary access mechanism

Role-based permission sets aligned to least privilege

MFA enforced via external identity provider

IAM users discouraged in favor of centralized identity

📜 Centralized Logging & Visibility

Organization-wide AWS CloudTrail (all accounts, all regions)

CloudTrail log file integrity validation

Centralized log storage in a protected log archive account

AWS Config enabled with centralized aggregation

Amazon GuardDuty enabled organization-wide

AWS Security Hub enabled with delegated administration

🛡️ Baseline Security Guardrails

Preventive controls enforced via SCPs

Secure-by-default configuration patterns

Encryption at rest enabled by default

Explicit shared responsibility boundaries

What SecureBase Does Not Do

SecureBase is intentionally scoped.

It does not:

Guarantee SOC 2, FedRAMP, or NIST compliance

Provide authorization or certification

Implement application-level security controls

Manage customer workloads or data

Replace organizational policies or procedures

Perform incident response or SOAR automation

SecureBase is a foundation, not a full compliance program.

Compliance Positioning

SecureBase supports compliance efforts by providing traceable, auditable platform controls.

It includes documented mappings to:

CIS AWS Foundations Benchmark

NIST SP 800-53 Rev. 5 (selected families)

SOC 2 Trust Services Criteria (Security & Common Criteria)

A Control → Evidence Matrix is included to support audit discussions.

SecureBase does not assert compliance or authorization.

Day 0 → Day 30 Outcomes
Day 0 (Initial Deployment)

AWS Organization created

Accounts provisioned and isolated

Central identity enabled

Logging and monitoring active

Guardrails enforced

Day 30 (Operational Use)

Auditable access model in place

Centralized logs available for review

Configuration inventory established

Security findings aggregated

Compliance narratives defensible

Deployment Overview

SecureBase is deployed using Terraform modules in a defined order:

org-baseline

identity-baseline

logging-baseline

config-baseline

security-detection

Deployment prerequisites and example configurations are documented in the module directories.

Evidence & Audit Support

SecureBase generates inspectable artifacts commonly requested by auditors, including:

CloudTrail logs

AWS Config snapshots

IAM permission sets

SCP policy documents

Terraform code and state history

GuardDuty and Security Hub findings

These artifacts support SOC 2 Type I and RMF narratives when combined with customer controls.

Shared Responsibility

SecureBase provides platform-level controls.

Customers remain responsible for:

Application security

Data classification and handling

Incident response execution

Policies and procedures

User provisioning governance

This aligns with AWS shared responsibility principles.

Documentation

SecureBase includes:

architecture.md — architectural intent and boundaries

threat-model.md — threat assumptions and mitigations

compliance.md — control mappings and evidence references

Terraform module documentation

These documents are intended to be reviewed together.

Versioning

Current release: v0.1.0

Scope is intentionally limited

No upgrade guarantees prior to v1.0

Breaking changes may occur between minor versions

Philosophy

SecureBase favors:

Clarity over coverage

Defensible controls over checklists

Infrastructure you can explain to auditors

Honest scope boundaries

If that aligns with how you build regulated systems, SecureBase will fit.
