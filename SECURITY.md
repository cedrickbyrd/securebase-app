# Security Policy

## Supported Versions

SecureBase maintains security support for the following versions:

| Version | Supported          | Environment |
| ------- | ------------------ | ----------- |
| Demo    | :white_check_mark: | demo.securebase.io |
| Staging | :white_check_mark: | staging.securebase.io |
| Production | :white_check_mark: | portal.securebase.io |
| Legacy (< v4.0) | :x: | Deprecated |

## Security Environments

### Production Environment
- **URL:** portal.securebase.io
- **Data:** Real customer data, PII, PHI
- **Compliance:** SOC 2, HIPAA, FedRAMP
- **Contact:** security@securebase.io
- **SLA:** Critical issues <4 hours

### Staging Environment
- **URL:** staging.securebase.io
- **Data:** Test data, no production data
- **Purpose:** Pre-production testing
- **Contact:** devops@securebase.io

### Demo Environment
- **URL:** demo.securebase.io
- **Data:** Mock data only (NO real data)
- **Credentials:** `demo/demo` (public, safe to share)
- **Purpose:** Product demonstrations, sales, evaluation
- **Contact:** demo-support@securebase.io
- **Security Config:** See [DEMO_SECURITY_CONFIG.md](./DEMO_SECURITY_CONFIG.md)

**Important:** The demo environment is intentionally public with known credentials. It contains NO production systems, real data, or secrets.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these guidelines:

### For Production/Staging Issues (CRITICAL)

**Contact:** security@securebase.io  
**PGP Key:** Available at https://securebase.io/.well-known/pgp-key.txt  
**Response Time:** <4 hours for critical issues

**Please include:**
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Your assessment of severity (Low/Medium/High/Critical)
5. Suggested remediation (if any)

**What to expect:**
- **Initial Response:** <4 hours for critical, <24 hours for others
- **Triage:** Within 24 hours
- **Status Updates:** Every 48 hours until resolved
- **Bounty:** Security researchers may be eligible for recognition/bounty
- **Credit:** You will be credited in our security acknowledgements (if desired)

### For Demo Environment Issues (NON-CRITICAL)

**Contact:** demo-support@securebase.io  
**Response Time:** <24 hours

The demo environment is a public demonstration with no sensitive data. Issues with the demo environment are appreciated but not considered critical security vulnerabilities.

**Examples of demo issues:**
- Rate limiting bypass on demo/demo credentials
- Mock data exposure
- Demo UI/UX issues
- Performance problems

**NOT vulnerabilities (by design):**
- Demo credentials are public (`demo/demo`)
- Mock data is intentionally visible
- Demo mode uses simplified security model

## Security Disclosure Policy

### Safe Harbor

SecureBase supports responsible security research and will not pursue legal action against researchers who:

1. **Act in good faith**
   - Make a good faith effort to avoid privacy violations
   - Do not intentionally degrade service quality
   - Do not exploit vulnerabilities beyond what's necessary to prove they exist

2. **Follow disclosure guidelines**
   - Report vulnerabilities privately to security@securebase.io
   - Allow reasonable time for remediation before public disclosure (90 days)
   - Do not publicly disclose until we confirm the fix is deployed

3. **Stay within scope**
   - Test only against demo.securebase.io or staging.securebase.io
   - Do NOT test against production (portal.securebase.io)
   - Do NOT perform denial of service attacks
   - Do NOT engage in social engineering of employees

### Out of Scope

The following are **NOT** considered security vulnerabilities:

- **Demo Environment Behaviors:**
  - Public demo credentials (`demo/demo`)
  - Mock data visibility
  - Simplified authentication in demo mode
  - Rate limiting on demo authentication (it's supposed to be restrictive!)

- **General Issues:**
  - Clickjacking on pages without sensitive data
  - Missing SPF/DKIM/DMARC on non-transactional domains
  - SSL/TLS configuration on third-party services
  - Browser-specific issues in outdated browsers (>2 years old)

- **Social Engineering:**
  - Phishing attacks on employees
  - Physical security testing
  - Insider threats

### Severity Classification

| Severity | Impact | Examples | Response Time |
|----------|--------|----------|---------------|
| **Critical** | Immediate risk to customer data | RCE, SQL injection, authentication bypass in production | <4 hours |
| **High** | Potential data exposure | XSS with data exfiltration, privilege escalation | <24 hours |
| **Medium** | Security control weakness | Missing security headers, weak CSP | <1 week |
| **Low** | Theoretical or minimal impact | Information disclosure, minor misconfigurations | <2 weeks |

## Security Features

### Infrastructure Security (Production)

- ✅ **AWS Organizations** - Multi-account isolation
- ✅ **IAM Identity Center** - SSO with MFA enforcement
- ✅ **Service Control Policies** - Deny-by-default security
- ✅ **CloudTrail** - Centralized audit logging (7-year retention)
- ✅ **GuardDuty** - Threat detection
- ✅ **Security Hub** - Compliance monitoring
- ✅ **Config** - Configuration compliance
- ✅ **VPC Flow Logs** - Network traffic analysis
- ✅ **KMS** - Encryption at rest
- ✅ **Secrets Manager** - Credential rotation

### Application Security

- ✅ **CSP** - Content Security Policy
- ✅ **HSTS** - HTTP Strict Transport Security
- ✅ **XSS Protection** - Input sanitization
- ✅ **CSRF Protection** - Token-based
- ✅ **Rate Limiting** - Authentication and API endpoints
- ✅ **Session Management** - Secure token handling
- ✅ **Dependency Scanning** - npm audit, Dependabot
- ✅ **Code Scanning** - SAST, DAST

### Compliance & Certifications

- ✅ **SOC 2 Type II** - In progress (Q2 2026)
- ✅ **HIPAA** - BAA available
- ✅ **FedRAMP** - Baseline alignment
- ✅ **CIS Benchmarks** - Level 1 & 2
- ✅ **ISO 27001** - Roadmap (2027)

## Security Best Practices

### For Developers

1. **Never commit secrets** - Use environment variables
2. **Keep dependencies updated** - Run `npm audit` regularly
3. **Follow secure coding guidelines** - OWASP Top 10
4. **Review security headers** - Before each deployment
5. **Test authentication** - Including rate limiting
6. **Validate input** - Never trust user input
7. **Use parameterized queries** - Prevent SQL injection
8. **Implement least privilege** - Minimal IAM permissions

### For Users

1. **Use strong passwords** - Minimum 12 characters
2. **Enable MFA** - Required for production access
3. **Don't share credentials** - Use SSO and role-based access
4. **Report suspicious activity** - security@securebase.io
5. **Keep software updated** - Browsers, OS, tools
6. **Verify URLs** - Look for https:// and correct domain
7. **Be wary of phishing** - We'll never ask for your password via email

## Security Updates

We publish security updates in the following channels:

- **Critical Alerts:** Email to all registered users
- **Security Advisories:** https://securebase.io/security
- **Changelog:** https://github.com/cedrickbyrd/securebase-app/releases
- **Status Page:** https://status.securebase.io

## Bug Bounty Program

SecureBase operates a private bug bounty program. Invited researchers can earn rewards for qualifying vulnerabilities:

| Severity | Reward |
|----------|--------|
| Critical | $500 - $2,000 |
| High | $250 - $500 |
| Medium | $100 - $250 |
| Low | Recognition + swag |

**Interested in joining?** Email security@securebase.io with your researcher profile.

## Audit Logs

For compliance customers (Healthcare, Fintech, Government tiers):

- **Retention:** 7 years (2,555 days)
- **Immutability:** Object Lock (Compliance Mode)
- **Access:** Read-only via customer portal
- **Export:** Available in JSON, CSV formats
- **Attestation:** SOC 2 audit reports available upon request

## Contact

### Security Team
- **Email:** security@securebase.io
- **PGP Key:** https://securebase.io/.well-known/pgp-key.txt
- **Response Time:** <4 hours (critical), <24 hours (others)

### Demo Support
- **Email:** demo-support@securebase.io
- **Purpose:** Demo environment issues only
- **Response Time:** <24 hours

### General Support
- **Email:** support@securebase.io
- **Chat:** Available in customer portal
- **Phone:** Available for Enterprise tier

---

**Last Updated:** February 2, 2026  
**Version:** 2.0  
**Next Review:** May 1, 2026
