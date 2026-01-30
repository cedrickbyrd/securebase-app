# ❓ SecureBase FAQ

**Frequently Asked Questions**

Can't find what you're looking for? [Contact us](mailto:sales@securebase.io) and we'll get back to you within 2 hours.

[🚀 Start Free Trial](https://portal.securebase.io/signup) | [📞 Book Demo](https://calendly.com/securebase/demo) | [💰 View Pricing](./PRICING.md)

---

## General Questions

### 1. **Q: What is SecureBase?**
**A:** SecureBase is a Platform-as-a-Service (PaaS) that deploys production-ready, compliance-focused AWS infrastructure in under 10 minutes. We provide multi-tenant AWS Organizations with built-in SOC 2, HIPAA, and FedRAMP controls, eliminating 6-12 weeks of setup time and $50K-200K in engineering costs.

### 2. **Q: Who is SecureBase for?**
**A:** SecureBase is designed for regulated industries and fast-moving companies: healthcare startups needing HIPAA compliance, fintech companies preparing for SOC 2 audits, government contractors requiring FedRAMP alignment, and SaaS companies needing secure multi-tenant infrastructure. If you need compliant AWS infrastructure without hiring a dedicated DevOps team, SecureBase is for you.

### 3. **Q: How is SecureBase different from a DIY AWS setup?**
**A:** DIY AWS setup takes 6-12 weeks, requires AWS-certified architects, costs $50K-200K upfront, and needs 1-2 FTEs for ongoing maintenance. SecureBase deploys in <10 minutes, requires no AWS expertise, costs $2K-25K/month all-inclusive, and has zero maintenance overhead. You also get compliance automation, audit logs, and pre-built security controls that would take months to implement yourself.

### 4. **Q: How is SecureBase different from Terraform Cloud?**
**A:** Terraform Cloud is an infrastructure management tool that requires you to write and maintain your own Terraform code. SecureBase provides pre-built, compliance-focused infrastructure templates (Terraform-based) with automated deployment, ongoing compliance monitoring, customer portal, billing integration, and managed services. We're infrastructure-as-a-product, not just infrastructure-as-code.

### 5. **Q: How is SecureBase different from security platforms like Fugue or Lacework?**
**A:** Fugue and Lacework are monitoring and remediation tools for existing AWS infrastructure. SecureBase deploys and manages the entire AWS foundation for you—AWS Organizations, accounts, logging, identity, and compliance controls. Think of us as "AWS Landing Zone as a Service" vs. "AWS monitoring tools." We can complement tools like Lacework if you need additional runtime security.

### 6. **Q: What compliance frameworks do you support?**
**A:** We support four compliance tiers: **Standard** (CIS AWS Foundations Benchmark), **Fintech** (SOC 2 Type II all 5 TSCs), **Healthcare** (HIPAA Security & Privacy Rule, HITECH), and **Government** (FedRAMP Low, NIST 800-53). Each tier includes automated controls, audit logging, compliance reports, and documentation to support your audit process.

### 7. **Q: Is there a free trial?**
**A:** Yes! We offer a 30-day free trial with full access to all features in your selected tier. No credit card required to start. You can deploy infrastructure, test compliance controls, and explore the customer portal completely free for 30 days.

### 8. **Q: How long does deployment take?**
**A:** Typically 7-10 minutes from signup to fully deployed infrastructure. This includes AWS Organization setup, dedicated customer accounts, IAM Identity Center (SSO) configuration, centralized logging (CloudTrail, Config, GuardDuty), and customer portal access. Note: White-label branding capabilities will be available in March 2026.

---

## Technical Questions

### 9. **Q: Do I need AWS expertise to use SecureBase?**
**A:** No. SecureBase is designed for teams without dedicated AWS architects or DevOps engineers. Our platform handles all infrastructure setup, configuration, and maintenance automatically. You only need basic AWS knowledge to deploy your applications on top of our secure foundation. We provide onboarding assistance and documentation to help you get started.

### 10. **Q: Can I use my existing AWS account?**
**A:** SecureBase creates a new AWS Organization structure with dedicated accounts for security, logging, and customer workloads. If you have an existing AWS account, we can help you migrate resources or run SecureBase alongside your current infrastructure. Contact our team for migration assistance and architectural guidance.

### 11. **Q: What AWS services does SecureBase use?**
**A:** Core services include: AWS Organizations (multi-account management), IAM Identity Center (SSO), CloudTrail (audit logs), AWS Config (compliance monitoring), GuardDuty (threat detection), Security Hub (security findings), VPC (network isolation), KMS (encryption), S3 (log storage), Lambda (automation), and RDS Aurora (customer portal database). All services are managed and configured by SecureBase.

### 12. **Q: How does multi-tenant isolation work?**
**A:** Each customer gets a dedicated AWS account within your Organization, providing account-level isolation (strongest AWS boundary). We use Service Control Policies (SCPs) to enforce guardrails, VPC isolation for network segmentation, and IAM roles with least-privilege access. Customer data in our portal uses row-level security (RLS) in PostgreSQL to ensure complete data isolation.

### 13. **Q: Can I customize the infrastructure?**
**A:** Yes. All SecureBase infrastructure is deployed as Terraform code, which you can export and customize. Changes can be requested through our support team, or you can extend the infrastructure yourself. For advanced customization, we recommend the Healthcare or Government tiers, which will include white-label capabilities (available March 2026) and dedicated support.

### 14. **Q: What if I outgrow SecureBase?**
**A:** You can export your complete Terraform configuration at any time and run the infrastructure independently. We provide 30 days of transition support to ensure a smooth handoff. Many customers choose to stay with SecureBase long-term because we continuously update the infrastructure, maintain compliance, and handle all operational overhead.

### 15. **Q: How do you handle updates and patches?**
**A:** We automatically apply security patches, compliance updates, and infrastructure improvements to all customer accounts. Critical security updates are applied immediately; non-critical updates are scheduled during maintenance windows. You receive advance notification (7 days) for any changes that might impact your applications.

### 16. **Q: What AWS regions do you support?**
**A:** We support all standard AWS commercial regions. Default deployment is **us-east-1** (N. Virginia), with optional multi-region deployment for high availability. Healthcare and Government tiers include multi-region backup and disaster recovery. Contact sales for GovCloud or region-specific requirements.

### 17. **Q: Do you support on-premise deployment?**
**A:** Not currently. SecureBase is designed for AWS cloud deployment only. On-premise and hybrid cloud deployments are on our roadmap for late 2026. If you have air-gapped or on-premise requirements, contact our enterprise team to discuss future options or custom solutions.

---

## Compliance Questions

### 18. **Q: Are you SOC 2 certified?**
**A:** SecureBase is currently completing our SOC 2 Type II audit (expected completion Q2 2026). Our Fintech tier implements all SOC 2 Trust Service Criteria controls and generates audit-ready documentation. Many customers have successfully passed their own SOC 2 audits using SecureBase infrastructure.

### 19. **Q: Are you HIPAA compliant?**
**A:** SecureBase implements HIPAA Security Rule and Privacy Rule controls as outlined in our Healthcare tier. We provide a Business Associate Agreement (BAA) with all Healthcare and Government tier customers. Our infrastructure includes encryption, audit logging, access controls, and 7-year retention to meet HIPAA requirements.

### 20. **Q: Do you provide a Business Associate Agreement (BAA)?**
**A:** Yes. All Healthcare and Government tier customers receive a signed Business Associate Agreement (BAA) at no additional cost. The BAA is reviewed by our legal team and complies with HIPAA requirements for handling Protected Health Information (PHI). Standard and Fintech tiers do not include a BAA.

### 21. **Q: What about FedRAMP?**
**A:** Our Government tier provides partial FedRAMP Low baseline alignment with 200+ NIST 800-53 controls. We are not FedRAMP authorized (formal ATO), but many government contractors use our infrastructure as a foundation for their own FedRAMP compliance journey. Full FedRAMP authorization is planned for 2027.

### 22. **Q: How do you handle audit logs?**
**A:** All AWS API calls are logged via CloudTrail to a centralized log archive account with S3 Object Lock (immutable, tamper-proof). Logs are encrypted at rest (AES-256), replicated across regions for durability, and retained per your tier (1-10 years). You can search, export, and analyze logs through the customer portal or directly in AWS.

### 23. **Q: Can I get compliance reports?**
**A:** Yes. All tiers include automated compliance reports: Standard (monthly), Fintech (quarterly), Healthcare (monthly + quarterly), Government (weekly). Reports include security findings, Config rule compliance, GuardDuty alerts, cost breakdowns, and audit-ready documentation. Custom reports are available in Healthcare and Government tiers.

### 24. **Q: How long do you retain audit data?**
**A:** Retention varies by tier: Standard (1 year), Fintech (3 years), Healthcare (7 years for HIPAA), Government (10 years for federal requirements). Extended retention is available as an add-on. All audit logs are stored in immutable S3 buckets with multi-region replication.

---

## Pricing & Billing Questions

### 25. **Q: How does pricing work?**
**A:** SecureBase uses tier-based pricing: Standard ($2K/mo), Fintech ($8K/mo), Healthcare ($15K/mo), Government ($25K/mo). Each tier includes a base number of customer environments, users, and features. Usage-based add-ons apply for additional environments, storage, users, and API calls. See our [Pricing Page](./PRICING.md) for full details.

### 26. **Q: What's included in each tier?**
**A:** All tiers include multi-tenant AWS Organization, dedicated customer accounts, IAM Identity Center (SSO), centralized logging, compliance controls, customer portal, and email support. Higher tiers add advanced features: SOC 2 controls, advanced analytics (deploying February 2026), team collaboration (available February-March 2026), white-label branding (available March 2026), enhanced support, and more stringent compliance frameworks. See the [Feature Comparison Table](./PRICING.md#-feature-comparison-table).

### 27. **Q: Are there setup fees?**
**A:** No. SecureBase has zero setup fees, ever. Your monthly or annual subscription includes everything: deployment, onboarding, training, and ongoing support. We make money when you succeed, not from upfront charges.

### 28. **Q: Can I change tiers?**
**A:** Yes, you can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades take effect at the start of your next billing cycle. Contact support to initiate a tier change. Note: Downgrading may require adjustments to upcoming features (white-label branding available March 2026, team collaboration available February-March 2026) to meet lower tier limits.

### 29. **Q: What payment methods do you accept?**
**A:** We accept credit cards (Visa, Mastercard, Amex), ACH direct debit (US only), and wire transfers (international). Annual contracts qualify for Net 30 invoice terms. All payments are processed securely via Stripe.

### 30. **Q: Do you offer annual discounts?**
**A:** Yes! Annual billing saves 15% compared to monthly billing. For example, the Fintech tier is $96K/year monthly vs. $81,600/year annually (save $14,400). Annual contracts also qualify for Net 30 payment terms and wire transfer options.

### 31. **Q: What happens if I cancel?**
**A:** You can cancel anytime with 30-day notice. We'll provide a complete export of your Terraform infrastructure configuration, documentation, and 30 days of transition support. Your AWS accounts remain active (billed directly by AWS), so there's zero downtime or data loss. No cancellation fees, no lock-in.

### 32. **Q: Do you offer refunds?**
**A:** Yes. We offer a 30-day money-back guarantee on your first month of service (excludes pilot program pricing). If you're not satisfied for any reason, we'll refund your payment in full. Annual contracts are non-refundable after 30 days but can be canceled with prorated credit.

### 33. **Q: Are there volume discounts?**
**A:** Yes. Volume discounts apply when you deploy multiple customer environments: 5-20 environments (10% off), 21-50 (15% off), 51-100 (20% off), 100+ (custom enterprise pricing). Multi-year contracts (3+ years) also qualify for additional discounts. Contact [sales@securebase.io](mailto:sales@securebase.io).

### 34. **Q: What are the overage charges?**
**A:** Overage charges apply when you exceed your tier's included limits. Additional environments cost $40-100/month (tier-dependent). Storage overages are $0.30-0.50/GB. Users cost $40-50/user/month (Fintech/Healthcare only). API calls cost $2-3 per million requests. We notify you at 80% capacity so you can upgrade or adjust usage.

---

## Support & Implementation Questions

### 35. **Q: What support do you offer?**
**A:** All tiers include support: Standard (email, 24h response), Fintech (email + Slack, 4h response), Healthcare (phone + email + Slack, 2h response, account manager), Government (24/7 phone/email/Slack, 1h critical response, technical account manager). All customers get access to our knowledge base, API documentation, and community Slack.

### 36. **Q: How fast do you respond to support requests?**
**A:** Response times vary by tier: Standard (24 hours), Fintech (4 hours), Healthcare (2 hours), Government (1 hour for critical, 4 hours for normal). All times are measured during business hours (9am-5pm ET, Mon-Fri) except Government tier, which includes 24/7 support.

### 37. **Q: Do you offer onboarding assistance?**
**A:** Yes. All tiers include onboarding: Standard (2 hours), Fintech (4 hours), Healthcare (8 hours), Government (16 hours). Onboarding includes deployment walkthrough, portal training, API key setup, compliance overview, and best practices. Additional onboarding can be purchased at $200/hour.

### 38. **Q: Can I see customer references?**
**A:** We're currently building our pilot program with 20 early customers. References will be available after March 2026 when pilot customers complete their initial deployment and compliance audits. Pilot participants have the option to participate in case studies showcasing their success with SecureBase.

### 39. **Q: What happens to my data if SecureBase shuts down?**
**A:** All your infrastructure runs in your own AWS accounts, so it continues operating independently even if SecureBase stops providing service. We'll provide 90 days notice and full Terraform configuration export. Your data is yours—we never have custody of your application data, only portal metadata (users, invoices, API keys).

### 40. **Q: How do I migrate from DIY AWS to SecureBase?**
**A:** We offer migration assistance for all tiers. The process typically involves: (1) Assessment of your current AWS setup, (2) Mapping resources to SecureBase architecture, (3) Deploying SecureBase alongside your existing infrastructure, (4) Gradual migration of workloads, (5) Decommissioning old resources. Healthcare and Government tiers include dedicated migration support. Contact us for a free migration assessment.

### 41. **Q: Can I export my infrastructure configuration?**
**A:** Yes. All SecureBase infrastructure is built with Terraform, and you can export the complete configuration at any time (no fees, no restrictions). Exports include all modules, variables, state files, and documentation. This ensures you're never locked into SecureBase—you can take your infrastructure and run it independently whenever you choose.

### 42. **Q: Do you offer professional services?**
**A:** Yes. We offer professional services for complex migrations, custom integrations, compliance consulting, and audit preparation. Services are billed at $200/hour (Standard/Fintech) or included in your onboarding hours (Healthcare/Government). Contact [enterprise@securebase.io](mailto:enterprise@securebase.io) for a scoped engagement.

---

## Still Have Questions?

We're here to help! Our team typically responds within 2 hours during business hours.

### 📧 General Questions
**Email:** [support@securebase.io](mailto:support@securebase.io)

### 💰 Sales & Pricing
**Email:** [sales@securebase.io](mailto:sales@securebase.io)  
**Phone:** Coming soon  
**Schedule Call:** [https://calendly.com/securebase/demo](https://calendly.com/securebase/demo)

### 🏢 Enterprise & Custom Solutions
**Email:** [enterprise@securebase.io](mailto:enterprise@securebase.io)  
**Schedule Call:** [https://calendly.com/securebase/enterprise](https://calendly.com/securebase/enterprise)

### 🛠️ Technical Support
**Email:** [support@securebase.io](mailto:support@securebase.io)  
**Slack:** Available for Fintech+ tiers  
**Phone:** Available for Healthcare+ tiers

### 📚 Additional Resources

- **[Pricing & Plans](./PRICING.md)** - Detailed pricing, features, ROI calculator
- **[Product Overview](./README.md)** - What SecureBase does, who it's for
- **[Security Policy](./SECURITY.md)** - Security practices and vulnerability disclosure
- **[Getting Started](./GETTING_STARTED.md)** - Quick start deployment guide
- **[API Documentation](./API_REFERENCE.md)** - API reference for developers
- **[Pilot Program](https://portal.securebase.io/pilot)** - 50% off, 8 spots remaining

---

## 🚀 Ready to Get Started?

**[Start Your Free 30-Day Trial →](https://portal.securebase.io/signup)**

No credit card required. Full access to all features. Cancel anytime.

---

*Last Updated: January 30, 2026*  
*Have a question not listed here? Email us at [support@securebase.io](mailto:support@securebase.io)*
