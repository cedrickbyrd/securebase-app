Compliance Alignment

Secure AWS Landing Zone (Terraform)

1. Purpose

This document maps the controls implemented by the Secure AWS Landing Zone to:

CIS AWS Foundations Benchmark

NIST SP 800-53 Rev. 5 (selected families)

The intent is to demonstrate how the landing zone supports baseline security and audit readiness for regulated AWS environments, including fintech and government contractor use cases.

This document does not assert certification or authorization.

2. Compliance Philosophy

The landing zone focuses on foundational platform controls rather than application-specific or organization-specific requirements.

Controls are implemented as:

Preventive guardrails (SCPs, IAM patterns)

Detective mechanisms (logging, monitoring)

Configuration baselines enforced via infrastructure as code

Where applicable, controls are shared responsibility between the platform and the customer.

3. CIS AWS Foundations Benchmark Mapping

The table below maps implemented landing zone controls to relevant CIS AWS Foundations controls.

Identity & Access Management
CIS Control	Description	Landing Zone Implementation
1.1	Avoid use of root account	Root usage denied via SCP; break-glass only
1.2	MFA on root account	Required; documented as precondition
1.3	IAM policies not overly permissive	Role-based permission sets; least privilege
1.4	No access keys for root	Enforced by SCP and process
1.5	MFA for IAM users	IAM users discouraged; Identity Center primary
1.16	IAM policies attached to roles	Role-based access model
Logging & Monitoring
CIS Control	Description	Landing Zone Implementation
2.1	CloudTrail enabled	Organization-wide CloudTrail
2.2	CloudTrail in all regions	Enabled by default
2.3	Log file validation	Enabled for CloudTrail
2.4	CloudTrail logs protected	Central log archive with restricted access
2.5	Config enabled	AWS Config enabled centrally
2.6	S3 access logging	Enabled for log buckets
Networking & Resource Configuration
CIS Control	Description	Landing Zone Implementation
3.1	No unrestricted SSH	Private-by-default networking intent
3.2	No unrestricted RDP	Enforced through network patterns
3.3	VPC flow logs	Enabled centrally
3.4	Default VPC monitoring	Explicit VPC design encouraged
Data Protection
CIS Control	Description	Landing Zone Implementation
4.1	EBS encryption	Encryption enabled by default
4.2	S3 encryption	Default encryption enforced
4.3	KMS key management	Centralized KMS usage
4. NIST SP 800-53 Rev. 5 Mapping (Selected Families)

The following mappings are high-level and intended to support RMF narratives.

Access Control (AC)
NIST Control	Control Description	Landing Zone Support
AC-2	Account Management	Centralized Identity Center; no IAM users
AC-3	Access Enforcement	SCPs + IAM policies
AC-5	Separation of Duties	Multi-account model
AC-6	Least Privilege	Role-based permission sets
AC-17	Remote Access	Identity Center with MFA
AC-20	External Systems	Trust relationships explicitly defined
Identification & Authentication (IA)
NIST Control	Control Description	Landing Zone Support
IA-2	User Identification & Authentication	External IdP + Identity Center
IA-5	Authenticator Management	MFA enforced; no static credentials
IA-7	Cryptographic Authentication	AWS-managed auth mechanisms
Audit & Accountability (AU)
NIST Control	Control Description	Landing Zone Support
AU-2	Auditable Events	CloudTrail org-wide
AU-3	Audit Record Content	Default CloudTrail event capture
AU-6	Audit Review	Centralized log aggregation
AU-9	Audit Information Protection	Log archive account + SCPs
AU-11	Audit Retention	Retention and immutability policies
Configuration Management (CM)
NIST Control	Control Description	Landing Zone Support
CM-2	Baseline Configuration	Terraform-managed baseline
CM-3	Configuration Change Control	IaC + change review
CM-6	Configuration Settings	Secure defaults enforced
CM-8	System Component Inventory	AWS Config resource inventory
System & Communications Protection (SC)
NIST Control	Control Description	Landing Zone Support
SC-7	Boundary Protection	Account-level isolation
SC-12	Cryptographic Key Establishment	AWS KMS usage
SC-13	Cryptographic Protection	Encryption at rest and in transit
SC-28	Protection of Information at Rest	Default encryption enforced
System & Information Integrity (SI)
NIST Control	Control Description	Landing Zone Support
SI-2	Flaw Remediation	Shared responsibility
SI-4	System Monitoring	GuardDuty + Security Hub
SI-7	Integrity Monitoring	Config + CloudTrail
SI-10	Input Validation	Out of scope (application-level)
5. Shared Responsibility Clarification

The landing zone provides platform-level controls. Customers are responsible for:

Application security

Data classification and handling

Incident response execution

Compliance documentation completion

This division aligns with AWS shared responsibility principles.

6. Limitations & Non-Claims

This landing zone:

Does not guarantee compliance or authorization

Is not FedRAMP authorized

Does not implement all NIST 800-53 controls

It provides a defensible baseline upon which compliance programs can be built.

7. Evidence Generation & Audit Support

The architecture supports evidence generation through:

CloudTrail logs

AWS Config snapshots

IAM policy artifacts

Terraform code history

These artifacts may be used to support audit and assessment activities.

8. Document Maintenance

This compliance mapping is reviewed:

When CIS benchmarks or NIST guidance change

When architecture or control implementation changes

During customer compliance assessments

9. Relationship to Other Documents

This document should be used with:

architecture.md

threat-model.md

Terraform module documentation

Together, they provide architectural, risk, and compliance context.

10. SOC 2 Trust Services Criteria Mapping
Purpose

This section maps Secure AWS Landing Zone controls to the SOC 2 Trust Services Criteria (TSC), with emphasis on the Common Criteria (CC) and Security principle, which are mandatory for all SOC 2 reports.

This mapping is intended to:

Support SOC 2 readiness and audits

Clarify shared responsibility boundaries

Provide defensible control narratives

This landing zone does not guarantee SOC 2 compliance; it provides platform-level supporting controls.

10.1 Common Criteria (CC)
CC1 – Control Environment
SOC 2 Criteria	Description	Landing Zone Support
CC1.1	Integrity and ethical values	Role separation and restricted admin access
CC1.2	Oversight responsibility	Centralized management and security accounts
CC1.4	Organizational structure	Multi-account AWS Organization model

Notes:
The landing zone supports governance structures but does not define organizational policies.

CC2 – Communication and Information
SOC 2 Criteria	Description	Landing Zone Support
CC2.1	Information required for controls	Centralized logging and audit trails
CC2.2	Internal communication	Shared services and security account visibility
CC2.3	External communication	Explicit trust boundaries and access models
CC3 – Risk Assessment
SOC 2 Criteria	Description	Landing Zone Support
CC3.1	Risk identification	Documented threat model
CC3.2	Risk analysis	Layered control design
CC3.3	Risk mitigation	Preventive and detective controls

Evidence:

threat-model.md

Architecture documentation

CC4 – Monitoring Activities
SOC 2 Criteria	Description	Landing Zone Support
CC4.1	Ongoing evaluations	AWS Config + Security Hub
CC4.2	Deficiencies identified	GuardDuty findings
CC4.3	Corrective actions	Manual or automated response hooks
CC5 – Control Activities
SOC 2 Criteria	Description	Landing Zone Support
CC5.1	Control implementation	Terraform-managed baselines
CC5.2	Technology controls	SCPs, IAM policies
CC5.3	Change management	Infrastructure as code workflow
CC6 – Logical and Physical Access Controls
SOC 2 Criteria	Description	Landing Zone Support
CC6.1	Logical access security	IAM Identity Center
CC6.2	User access provisioning	Group-based permission sets
CC6.3	Access revocation	Centralized identity management
CC6.6	Least privilege	Role-based access model
CC6.7	MFA	Enforced at identity provider
CC6.8	Session security	Time-bound sessions
CC7 – System Operations
SOC 2 Criteria	Description	Landing Zone Support
CC7.1	System monitoring	CloudTrail, GuardDuty
CC7.2	Incident detection	Security Hub aggregation
CC7.3	Incident response	Out of scope (customer responsibility)
CC7.4	Security event response	Alerting integration points
CC8 – Change Management
SOC 2 Criteria	Description	Landing Zone Support
CC8.1	Change authorization	Restricted Terraform apply access
CC8.2	Change testing	Terraform plan review
CC8.3	Change documentation	Version-controlled IaC
CC9 – Risk Mitigation
SOC 2 Criteria	Description	Landing Zone Support
CC9.1	Vendor risk mitigation	AWS shared responsibility alignment
CC9.2	Business continuity	Account-level isolation reduces blast radius
10.2 Security Principle (AICPA)

The Security principle focuses on protection against unauthorized access.

Security Criteria	Description	Landing Zone Support
S1.1	System protection	SCPs, IAM controls
S1.2	Boundary defense	Account and network isolation
S1.3	Threat detection	GuardDuty, CloudTrail
S1.4	Vulnerability mitigation	Shared responsibility
S1.5	Monitoring	Centralized logging
10.3 Shared Responsibility for SOC 2

The landing zone supports SOC 2 controls at the infrastructure and platform layer.

Customers are responsible for:

Policies and procedures

User provisioning governance

Incident response execution

Application security controls

Data handling and classification

Auditors will expect customer evidence to complement platform controls.

10.4 SOC 2 Evidence Examples

The landing zone enables the following evidence artifacts:

CloudTrail logs

AWS Config snapshots

IAM permission sets

Terraform code repositories

Access review records

Security Hub findings

These artifacts support both Type I and Type II audits.

10.5 Non-Claims and Limitations

This landing zone:

Does not certify SOC 2 compliance

Does not implement all Trust Services Criteria

Does not replace organizational controls

It provides a repeatable, auditable platform foundation.

10.6 Relationship to Other Compliance Frameworks

SOC 2 mappings complement:

CIS AWS Foundations Benchmark

NIST SP 800-53 Rev. 5

Many controls overlap, reducing duplication of effort.

Appendix A: Control → Evidence Matrix (v1)
Purpose

This matrix provides traceability between selected compliance controls and the concrete evidence artifacts generated by the Secure AWS Landing Zone.

It is intended to:

Support audit readiness and assessments

Reduce ambiguity during compliance reviews

Clarify shared responsibility boundaries

This matrix reflects platform-level controls only.

Control → Evidence Matrix
Framework	Control ID	Control Description	Implemented By	Evidence Artifact	Responsibility
CIS AWS	1.1	Avoid use of root account	AWS Organizations SCP	SCP denying root usage	Platform
CIS AWS	1.2	MFA on root account	Account baseline requirement	Root MFA configuration	Customer
CIS AWS	1.3	Least privilege IAM policies	IAM Identity Center	Permission set definitions	Platform
CIS AWS	1.4	No root access keys	SCP + process	SCP policy + IAM reports	Platform
CIS AWS	1.16	IAM policies attached to roles	Role-based access model	IAM role and policy JSON	Platform
CIS AWS	2.1	CloudTrail enabled	Org-wide CloudTrail	CloudTrail configuration	Platform
CIS AWS	2.2	CloudTrail all regions	CloudTrail org trail	Trail settings	Platform
CIS AWS	2.4	CloudTrail log protection	Log archive account	S3 bucket policy + SCPs	Platform
CIS AWS	2.5	AWS Config enabled	Central Config aggregator	Config recorder settings	Platform
CIS AWS	3.3	VPC Flow Logs enabled	Network baseline	Flow log configuration	Platform
CIS AWS	4.1	EBS encryption	Default encryption	EC2 encryption settings	Platform
CIS AWS	4.2	S3 encryption	Default bucket encryption	S3 bucket policies	Platform
NIST 800-53	AC-2	Account Management	Identity Center	User/group assignments	Shared
NIST 800-53	AC-6	Least Privilege	SCPs + IAM policies	Policy documents	Platform
NIST 800-53	IA-2	Identification & Authentication	External IdP + SSO	IdP config + SSO logs	Shared
NIST 800-53	AU-2	Auditable Events	CloudTrail	Event logs	Platform
NIST 800-53	AU-9	Audit Protection	Log archive account	Bucket policies	Platform
NIST 800-53	CM-2	Baseline Configuration	Terraform IaC	Terraform state + code	Platform
NIST 800-53	CM-8	System Inventory	AWS Config	Resource inventory	Platform
SOC 2	CC6.1	Logical access controls	IAM Identity Center	Permission sets	Platform
SOC 2	CC6.7	MFA enforcement	External IdP	MFA policy evidence	Customer
SOC 2	CC7.2	Threat detection	GuardDuty	Findings reports	Platform
SOC 2	CC8.1	Change authorization	Terraform workflow	Git history + reviews	Shared
Notes on Interpretation

Implemented By reflects the AWS service or Terraform module enforcing the control.

Evidence Artifact represents concrete, inspectable items an auditor may request.

Responsibility aligns with AWS shared responsibility principles:

Platform — Landing zone–provided controls

Customer — Organizational or application-level controls

Shared — Requires both platform capability and customer governance

Scope and Limitations

This matrix:

Includes only controls explicitly implemented or supported by the landing zone

Does not represent full framework coverage

Is expected to evolve as modules and guardrails expand

Future versions may:

Expand control coverage

Add control maturity indicators

Include automated evidence collection references
