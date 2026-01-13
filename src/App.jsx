import React, { useState } from 'react';
import { Shield, CheckCircle, FileCode, Download, Play, Settings, Lock, Eye, AlertTriangle, Zap, GitBranch, Database, Users, Cloud, Terminal, Rocket, DollarSign, Clock, Code } from 'lucide-react';

export default function SecureBaseLandingZone() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedModule, setSelectedModule] = useState(null);
  const [deploymentLog, setDeploymentLog] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [devEnvStep, setDevEnvStep] = useState('config');
  const [devConfig, setDevConfig] = useState({
    environment: 'development',
    region: 'us-east-1',
    orgName: '',
    email: '',
    enabledModules: {
      core: true,
      identity: true,
      security: true,
      logging: true,
      networking: false,
      monitoring: false
    }
  });

  const modules = [
    { 
      id: 'core', 
      name: 'AWS Organizations', 
      icon: Cloud, 
      description: 'Production-grade org structure with account factory and SCP guardrails', 
      resources: ['Organizations', 'OUs', 'Accounts', 'SCPs'], 
      status: 'essential', 
      devCost: '$0/month', 
      compliance: ['CIS', 'SOC2', 'NIST 800-53'] 
    },
    { 
      id: 'identity', 
      name: 'IAM Identity Center', 
      icon: Users, 
      description: 'Zero long-lived credentials with SSO, MFA enforcement, and break-glass access', 
      resources: ['Identity Center', 'Permission Sets', 'Break-Glass Role', 'Password Policy'], 
      status: 'essential', 
      devCost: '$0/month', 
      compliance: ['CIS', 'SOC2', 'NIST AC/IA'] 
    },
    { 
      id: 'security', 
      name: 'Security & Compliance', 
      icon: Shield, 
      description: 'GuardDuty, Security Hub, Config Rules, and compliance monitoring', 
      resources: ['GuardDuty', 'Security Hub', 'Config', 'CloudTrail', 'KMS'], 
      status: 'essential', 
      devCost: '$10-15/month', 
      compliance: ['CIS', 'PCI-DSS', 'HIPAA'] 
    },
    { 
      id: 'logging', 
      name: 'Centralized Logging', 
      icon: Database, 
      description: 'CloudTrail, VPC Flow Logs, and centralized log aggregation', 
      resources: ['CloudTrail', 'CloudWatch', 'S3 Log Buckets', 'VPC Flow Logs'], 
      status: 'essential', 
      devCost: '$5-10/month', 
      compliance: ['NIST AU', 'SOC2', 'RMF'] 
    },
    { 
      id: 'networking', 
      name: 'Network Foundation', 
      icon: GitBranch, 
      description: 'Transit Gateway, VPC setup, and network segmentation', 
      resources: ['Transit Gateway', 'VPCs', 'Subnets', 'Route Tables', 'NACLs'], 
      status: 'recommended', 
      devCost: '$30-40/month', 
      compliance: ['NIST SC', 'Zero Trust'] 
    },
    { 
      id: 'monitoring', 
      name: 'Monitoring & Alerts', 
      icon: Eye, 
      description: 'CloudWatch dashboards, alarms, and SNS notifications', 
      resources: ['CloudWatch Dashboards', 'SNS Topics', 'EventBridge Rules'], 
      status: 'recommended', 
      devCost: '$5-8/month', 
      compliance: ['NIST SI', 'SOC2'] 
    }
  ];

  const features = [
    { icon: Shield, title: 'Audit-Ready', description: 'CIS, SOC2, NIST 800-53, RMF compliant from day one' },
    { icon: Zap, title: 'Deploy in Hours', description: 'Production Terraform with no Control Tower dependency' },
    { icon: Lock, title: 'Zero Trust', description: 'No long-lived credentials, MFA enforced, SCPs enabled' },
    { icon: CheckCircle, title: 'Fintech Grade', description: 'Built for fintech audits and government requirements' },
    { icon: GitBranch, title: 'Multi-Account', description: 'Opinionated OU structure with blast-radius control' },
    { icon: Eye, title: 'Break-Glass Ready', description: 'Auditor-approved emergency access with CloudTrail logging' }
  ];

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDeploymentLog(prev => [...prev, { timestamp, message, type }]);
  };

  const simulateDeployment = async () => {
    if (!devConfig.orgName || !devConfig.email) {
      alert('Please provide organization name and email');
      return;
    }

    setIsDeploying(true);
    setDeploymentLog([]);
    setDevEnvStep('deploying');
    
    const steps = [
      { msg: 'Initializing Terraform backend...', delay: 1000 },
      { msg: 'Validating AWS credentials...', delay: 800 },
      { msg: `Creating organization: ${devConfig.orgName}`, delay: 600 },
      { msg: 'Running terraform init...', delay: 1200 },
      { msg: '✓ Terraform initialized successfully', delay: 500, type: 'success' },
      { msg: 'Generating deployment plan...', delay: 1500 },
      { msg: 'Planning to create 23 resources...', delay: 800 },
    ];

    if (devConfig.enabledModules.core) {
      steps.push(
        { msg: '[Core] Creating AWS Organization...', delay: 1000 },
        { msg: '[Core] Configuring organizational units...', delay: 800 },
        { msg: '[Core] ✓ Core infrastructure ready', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.identity) {
      steps.push(
        { msg: '[Identity] Setting up IAM Identity Center...', delay: 1000 },
        { msg: '[Identity] Creating permission sets...', delay: 900 },
        { msg: '[Identity] ✓ Identity Center configured', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.security) {
      steps.push(
        { msg: '[Security] Enabling GuardDuty...', delay: 1200 },
        { msg: '[Security] Configuring Security Hub...', delay: 900 },
        { msg: '[Security] Setting up Config rules...', delay: 800 },
        { msg: '[Security] ✓ Security services active', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.logging) {
      steps.push(
        { msg: '[Logging] Creating S3 buckets for logs...', delay: 1000 },
        { msg: '[Logging] Enabling CloudTrail...', delay: 900 },
        { msg: '[Logging] ✓ Logging infrastructure deployed', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.networking) {
      steps.push(
        { msg: '[Networking] Creating Transit Gateway...', delay: 1200 },
        { msg: '[Networking] Configuring VPCs...', delay: 1000 },
        { msg: '[Networking] ✓ Network foundation ready', delay: 600, type: 'success' }
      );
    }

    if (devConfig.enabledModules.monitoring) {
      steps.push(
        { msg: '[Monitoring] Creating CloudWatch dashboards...', delay: 1000 },
        { msg: '[Monitoring] Setting up alarms...', delay: 800 },
        { msg: '[Monitoring] ✓ Monitoring configured', delay: 600, type: 'success' }
      );
    }

    steps.push(
      { msg: '', delay: 500 },
      { msg: '🎉 Deployment complete!', delay: 1000, type: 'success' },
      { msg: `Environment: ${devConfig.environment}`, delay: 300, type: 'info' },
      { msg: `Region: ${devConfig.region}`, delay: 300, type: 'info' },
      { msg: 'Next: Review resources in AWS Console', delay: 500, type: 'info' }
    );

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      addLog(step.msg, step.type || 'info');
    }

    setIsDeploying(false);
    setDevEnvStep('complete');
  };

  const calculateCost = () => {
    let total = 0;
    Object.entries(devConfig.enabledModules).forEach(([key, enabled]) => {
      if (enabled) {
        const module = modules.find(m => m.id === key);
        if (module?.devCost) {
          const match = module.devCost.match(/\$(\d+)/);
          if (match) total += parseInt(match[1]);
        }
      }
    });
    return total;
  };

  const moduleDetails = {
    core: `Module 1: AWS Organizations

Production-grade org structure with account factory and SCP guardrails.

ACCOUNT STRUCTURE:
Management (root)
├── Security OU
│   ├── Log Archive
│   └── Audit
├── Shared Services OU
│   ├── Networking
│   └── CI/CD
└── Workloads OU
    ├── Production
    └── Non-Production

SERVICE CONTROL POLICIES:
- Deny root user access across all accounts
- Deny public S3 bucket creation
- Enforce MFA for console access
- Restrict deployments to approved regions
- Prevent GuardDuty/Config disabling

ACCOUNT FACTORY:
Automated account provisioning with:
- Unique email per account
- Automatic OU assignment
- Baseline SCPs applied
- Prevent_destroy lifecycle protection

COMPLIANCE:
✓ CIS AWS Foundations Benchmark
✓ SOC2 Type II organizational controls
✓ NIST 800-53 AC family
✓ No Control Tower dependency
✓ Terraform-native (no ClickOps)`,

    identity: `Module 2: IAM Identity Center

Zero long-lived credentials with SSO, MFA, and break-glass access.

PERMISSION SETS:

Admin Access (Emergency Only)
- Session: 1 hour maximum
- Policy: AdministratorAccess
- Use case: Break-glass scenarios
- MFA: Required

Platform Engineer (Day-to-Day)
- Session: 4 hours
- Permissions: EC2, ECS, EKS, Lambda, S3, RDS, DynamoDB
- Denies: IAM, Organizations, Account changes
- Use case: Application deployment and management

Read-Only Auditor
- Session: 8 hours
- Policy: ReadOnlyAccess + CloudTrail
- Use case: Compliance and audit teams
- Access: All accounts in read-only mode

BREAK-GLASS ROLE:
Emergency access with:
- MFA device required
- 1 hour max session
- All actions logged to CloudTrail
- Credentials stored offline
- Manual activation only

IAM PASSWORD POLICY:
- Minimum: 16 characters
- Complexity: upper, lower, numbers, symbols
- Max age: 90 days
- Reuse prevention: 24 passwords
- User self-service: enabled

COMPLIANCE:
✓ NIST 800-53 IA (Identification and Authentication)
✓ NIST 800-53 AC (Access Control)
✓ CIS AWS Foundations (IAM controls)
✓ SOC2 logical access controls`,

    security: `Module 3: Security & Compliance ($10-15/month)

Production-grade security services with continuous monitoring.

GUARDDUTY:
- Multi-account delegated administrator
- S3 protection (malware, unusual access)
- EKS protection (runtime monitoring)
- Finding frequency: 15 minutes
- Auto-archive false positives
- Integration with Security Hub

SECURITY HUB:
Standards Enabled:
- CIS AWS Foundations (161 controls)
- AWS Foundational Security (220+ controls)
- PCI DSS v3.2.1 (53 controls)

Features:
- Centralized findings aggregation
- Custom compliance dashboards
- Auto-remediation via EventBridge
- Security score tracking

AWS CONFIG:
Compliance Rules:
- encrypted-volumes (EBS required)
- rds-encryption-enabled
- s3-bucket-public-read-prohibited
- iam-password-policy (CIS compliant)
- mfa-enabled-for-iam-console-access
- root-account-mfa-enabled
- cloudtrail-enabled
- access-keys-rotated (90 day max)

Auto-Remediation:
- S3 public access blocking
- Default encryption enforcement
- Security group rule violations

KMS KEY MANAGEMENT:
- Automatic annual rotation
- Cross-account policies for logging
- CloudTrail encryption (required)
- S3 SSE-KMS encryption
- Separate keys per environment
- 30-day deletion waiting period

MACIE (Optional):
- PII discovery in S3
- Credit card detection
- SSN pattern matching
- Automated classification jobs

COMPLIANCE:
✓ CIS AWS Foundations Benchmark
✓ PCI DSS 3.2.1 technical requirements
✓ HIPAA technical safeguards
✓ SOC2 Type II security controls
✓ FedRAMP Moderate baseline`,

    logging: `Module 4: Centralized Logging ($5-10/month)

All logs aggregated with 7-year retention for compliance.

CLOUDTRAIL (Organization Trail):
- Multi-region coverage
- All accounts included
- Management + data events
- Log file validation (SHA-256, RSA)
- S3 delivery within 15 minutes
- CloudWatch Logs integration
- SNS notifications

Events Logged:
- All API calls (read + write)
- Console sign-ins
- AssumeRole events
- Failed authentication
- Resource creation/deletion

S3 LOG ARCHIVE:
Configuration:
- Versioning enabled
- MFA delete protection
- SSE-KMS encryption
- Public access blocked
- Cross-account write only
- Object lock available

Lifecycle Policies:
- Day 0-90: S3 Standard
- Day 91-365: Glacier Instant
- Day 366-2555: Glacier Deep
- Day 2555: Expiration (7 years)

VPC FLOW LOGS:
- All VPCs in all accounts
- Accepted + rejected traffic
- CloudWatch + S3 delivery
- 365 day retention minimum
- Athena query integration
- Security analysis ready

ACCESS LOGGING:
- S3 access logs (all buckets)
- ALB/NLB access logs
- Source IPs captured
- Request/response codes
- Centralized storage

COMPLIANCE:
✓ NIST 800-53 AU (Audit and Accountability)
✓ Tamper-proof logs (validation)
✓ 7-year retention (regulatory)
✓ Centralized audit trail
✓ Cross-account isolation`,

    networking: `Module 5: Network Foundation ($30-40/month)

Secure, scalable multi-account network with zero-trust.

TRANSIT GATEWAY:
- Hub-and-spoke topology
- ASN: 64512
- Manual attachment approval
- Separate route tables per env
- Prod isolated from non-prod

VPC ARCHITECTURE (3-Tier):

Public Subnets:
- Internet-facing load balancers
- NAT Gateways (one per AZ)
- Bastion hosts (optional)
- /24 per AZ

Private Subnets (App Tier):
- EC2, ECS, Lambda
- Egress via NAT Gateway
- /20 per AZ

Database Subnets (Isolated):
- RDS, Aurora, ElastiCache
- No internet route
- App tier access only
- /24 per AZ

CIDR ALLOCATION:
- Management: 10.0.0.0/16
- Security: 10.1.0.0/16
- Shared Services: 10.2.0.0/16
- Production: 10.10.0.0/16
- Staging: 10.20.0.0/16
- Development: 10.30.0.0/16

NETWORK SECURITY:
- NACLs (stateless, subnet-level)
- Security Groups (stateful, instance)
- Least privilege rules
- No 0.0.0.0/0 ingress (except LB)

VPC ENDPOINTS:
Gateway: S3, DynamoDB (free)
Interface: EC2, ECR, Secrets Manager,
  Systems Manager, CloudWatch, KMS

SHARED SERVICES VPC:
- Route53 Resolver endpoints
- Shared VPC endpoints
- Central egress (NAT/Firewall)
- DNS forwarding

COMPLIANCE:
✓ NIST 800-53 SC (System/Comms)
✓ Zero-trust architecture
✓ Defense in depth
✓ Blast radius containment
✓ FedRAMP network segmentation`,

    monitoring: `Module 6: Monitoring & Alerts ($5-8/month)

Complete observability with security-first incident response.

CLOUDWATCH DASHBOARDS:

Security Operations:
- GuardDuty findings by severity
- Security Hub compliance score
- Config rule violations
- IAM credential usage
- Root account activity
- Failed login attempts

Cost Management:
- Daily spend by service
- Month-to-date vs budget
- Top 10 cost resources
- Anomaly detection
- RI/SP utilization

Operational:
- EC2 CPU/memory
- RDS connections/IOPS
- Lambda errors/duration
- ALB target health
- NAT Gateway bandwidth

CRITICAL ALARMS:
Security:
- Root account usage (immediate)
- Unauthorized API calls
- IAM policy changes
- Security group changes
- KMS key deletion attempts
- GuardDuty High findings

Operations:
- EC2 CPU > 80% (5 min)
- RDS storage < 20%
- Lambda errors > 1%
- ALB 5xx > 5%

Cost:
- Daily spend threshold
- Budget 50%/80%/100%
- Anomaly detected
- Unused resources

EVENTBRIDGE AUTOMATION:
- GuardDuty → Slack/PagerDuty
- Security Hub → Incident creation
- Config → Auto-remediation
- Root usage → Immediate alert
- IAM key age → Auto-deactivate

SNS TOPICS:
- Critical Security (encrypted)
- Operations (encrypted)
- Cost Alerts (encrypted)
- Multi-channel delivery

COST ANOMALY DETECTION:
- 20% variance threshold
- ML-based analysis
- Root cause included
- Historical comparison

INTEGRATIONS:
- Slack, PagerDuty
- ServiceNow, Jira
- Microsoft Teams
- Custom webhooks

COMPLIANCE:
✓ NIST 800-53 SI (System Integrity)
✓ SOC2 monitoring requirements
✓ Proactive detection
✓ Complete audit trail`
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-500 w-8 h-8" />
            <div>
              <div className="text-2xl font-bold tracking-tight">SecureBase</div>
              <div className="text-xs text-slate-400">AWS Landing Zone Terraform</div>
            </div>
          </div>
          <nav className="flex gap-6 items-center">
            <button onClick={() => setActiveTab('overview')} className={`text-sm font-medium ${activeTab === 'overview' ? 'text-blue-400' : 'text-slate-400 hover:text-white'} transition`}>Overview</button>
            <button onClick={() => setActiveTab('modules')} className={`text-sm font-medium ${activeTab === 'modules' ? 'text-blue-400' : 'text-slate-400 hover:text-white'} transition`}>Modules</button>
            <button onClick={() => setActiveTab('devenv')} className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Deploy Dev
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            <section className="text-center space-y-6">
              <div className="inline-block px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-full text-blue-300 text-sm mb-4">
                Production-Grade Terraform • CIS Compliant • SOC2 + Gov Ready
              </div>
              <h1 className="text-6xl font-extrabold bg-gradient-to-r from-white via-blue-100 to-slate-400 bg-clip-text text-transparent leading-tight">
                Fintech & Gov-Ready<br />AWS Landing Zone
              </h1>
              <p className="text-slate-400 text-xl max-w-3xl mx-auto leading-relaxed">
                Real Terraform modules with zero Control Tower dependency. Built for SOC2, NIST 800-53, RMF, and fintech audits. Deploy in hours with production-grade security controls.
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-4 gap-6 max-w-4xl mx-auto mt-12">
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                  <div className="text-3xl font-bold text-green-400">2-4hrs</div>
                  <div className="text-sm text-slate-400">Deploy Time</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                  <div className="text-3xl font-bold text-blue-400">430+</div>
                  <div className="text-sm text-slate-400">Controls</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                  <div className="text-3xl font-bold text-purple-400">6</div>
                  <div className="text-sm text-slate-400">Modules</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                  <div className="text-3xl font-bold text-cyan-400">100%</div>
                  <div className="text-sm text-slate-400">IaC</div>
                </div>
              </div>
            </section>
            
            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((f, i) => (
                <div key={i} className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition">
                  <f.icon className="text-blue-500 mb-4 w-10 h-10" />
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>

            {/* Architecture Overview */}
            <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6">Account Architecture</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-blue-300 mb-4">Organizational Units</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Management Account</div>
                        <div className="text-slate-400">Organization root, billing consolidation</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Security OU</div>
                        <div className="text-slate-400">GuardDuty, Security Hub, Log Archive</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Shared Services OU</div>
                        <div className="text-slate-400">Networking, CI/CD, shared resources</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Workloads OU</div>
                        <div className="text-slate-400">Production, Staging, Development</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-300 mb-4">Security Controls</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>Multi-region CloudTrail with log validation</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>GuardDuty threat detection across all accounts</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>AWS Config with auto-remediation</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>SCPs enforcing security baselines</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modules Tab */}
        {activeTab === 'modules' && (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Production Modules</h2>
              <p className="text-slate-400 text-lg">Click any module to view detailed specifications</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {modules.map((m) => (
                <div 
                  key={m.id} 
                  className={`p-6 bg-slate-800 rounded-xl border cursor-pointer transition ${
                    selectedModule === m.id ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-700 hover:border-blue-500/50'
                  }`}
                  onClick={() => setSelectedModule(selectedModule === m.id ? null : m.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <m.icon className="text-blue-400" size={32} />
                    <div className="flex gap-2">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${
                        m.status === 'essential' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {m.status}
                      </span>
                      <span className="text-xs font-mono text-green-300 bg-green-500/10 px-2 py-1 rounded">
                        {m.devCost}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{m.name}</h3>
                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">{m.description}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {m.resources.map((r, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-slate-700/50 rounded text-slate-300">
                        {r}
                      </span>
                    ))}
                  </div>

                  {m.compliance && (
                    <div className="flex flex-wrap gap-1">
                      {m.compliance.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded border border-purple-700/30">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {selectedModule === m.id && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <pre className="p-4 bg-black/50 rounded text-xs text-green-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                        {moduleDetails[m.id]}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dev Environment Tab */}
        {activeTab === 'devenv' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4">Deploy Development Environment</h2>
              <p className="text-slate-400 text-lg">Test SecureBase with minimal AWS resources</p>
            </div>

            {devEnvStep === 'config' && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Configuration */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Organization Name</label>
                      <input
                        type="text"
                        value={devConfig.orgName}
                        onChange={(e) => setDevConfig({...devConfig, orgName: e.target.value})}
                        placeholder="my-company"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Root Email</label>
                      <input
                        type="email"
                        value={devConfig.email}
                        onChange={(e) => setDevConfig({...devConfig, email: e.target.value})}
                        placeholder="aws-root@company.com"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Region</label>
                      <select
                        value={devConfig.region}
                        onChange={(e) => setDevConfig({...devConfig, region: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="us-east-1">us-east-1 (N. Virginia)</option>
                        <option value="us-west-2">us-west-2 (Oregon)</option>
                        <option value="eu-west-1">eu-west-1 (Ireland)</option>
                        <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Module Selection */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    Select Modules
                  </h3>
                  <div className="space-y-3">
                    {modules.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition ${
                          devConfig.enabledModules[m.id]
                            ? 'bg-blue-900/30 border-blue-500'
                            : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={devConfig.enabledModules[m.id]}
                          onChange={(e) => setDevConfig({
                            ...devConfig,
                            enabledModules: {
                              ...devConfig.enabledModules,
                              [m.id]: e.target.checked
                            }
                          })}
                          className="w-4 h-4"
                        />
                        <m.icon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.devCost}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-slate-400">Est. Monthly Cost:</span>
                      <span className="text-2xl font-bold text-green-400">
                        ${calculateCost()}-{calculateCost() + 15}
                      </span>
                    </div>
                    <button
                      onClick={simulateDeployment}
                      disabled={!devConfig.orgName || !devConfig.email}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <Rocket className="w-5 h-5" />
                      Deploy Environment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {devEnvStep === 'deploying' && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-green-400" />
                      Deployment in Progress
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-500 border-t-transparent"></div>
                      <span className="text-sm text-slate-400">Running Terraform</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-black/30 font-mono text-sm h-96 overflow-y-auto">
                  {deploymentLog.map((log, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        log.type === 'success' ? 'text-green-400' : 'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))}
                  {isDeploying && (
                    <div className="text-blue-400 animate-pulse">▊</div>
                  )}
                </div>
              </div>
            )}

            {devEnvStep === 'complete' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-900/20 to-emerald-800/20 border border-green-700/50 rounded-xl p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-300 mb-2">Deployment Complete!</h3>
                  <p className="text-green-100 mb-6">Your SecureBase environment is ready</p>
                  
                  <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Resources</div>
                      <div className="text-2xl font-bold text-white">23</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Deploy Time</div>
                      <div className="text-2xl font-bold text-white">14m 32s</div>
                    </div>
                    <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Security Score</div>
                      <div className="text-2xl font-bold text-green-400">A+</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDevEnvStep('config');
                      setDeploymentLog([]);
                    }}
                    className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                  >
                    Deploy Another
                  </button>
                  <button className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                    View AWS Console
                  </button>
                  <button className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition">
                    Destroy
                  </button>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700">
                  <div className="p-6 border-b border-slate-700">
                    <h4 className="text-lg font-semibold">Deployment Log</h4>
                  </div>
                  <div className="p-6 bg-black/30 font-mono text-sm max-h-64 overflow-y-auto">
                    {deploymentLog.map((log, i) => (
                      <div key={i} className={log.type === 'success' ? 'text-green-400 mb-1' : 'text-slate-300 mb-1'}>
                        <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {devEnvStep === 'config' && (
              <div className="mt-8 bg-blue-900/20 border border-blue-700/50 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-blue-300 mb-2">Development Environment Notes</h4>
                    <ul className="text-blue-100 space-y-1 text-sm">
                      <li>• Simulated deployment for demonstration purposes</li>
                      <li>• In production, run actual Terraform in your terminal</li>
                      <li>• Dev environments use minimal resources to reduce costs</li>
                      <li>• All security features are production-ready</li>
                      <li>• Remember to destroy when done testing</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer CTA */}
      {activeTab !== 'devenv' && (
        <footer className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-12 text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to Deploy?</h3>
            <p className="text-blue-100 mb-8 text-lg">
              Get started with SecureBase and have your AWS foundation running in hours
            </p>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition flex items-center gap-2">
                <Download className="w-5 h-5" />
                Download Modules
              </button>
              <button 
                onClick={() => setActiveTab('devenv')}
                className="px-8 py-3 bg-blue-800 text-white font-semibold rounded-lg hover:bg-blue-900 transition flex items-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                Try Dev Environment
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
