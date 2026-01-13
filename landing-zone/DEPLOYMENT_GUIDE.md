      'DEPLOYMENT_GUIDE.md': `# SecureBase Deployment Guide

## Prerequisites
- Terraform >= 1.5.0
- AWS CLI configured
- Admin AWS credentials
- Unique email addresses

## Quick Start

Step 1: Configure AWS
aws configure

Step 2: Get Account ID
aws sts get-caller-identity

Step 3: Setup Environment
cd environments/dev
cp terraform.tfvars.example terraform.tfvars
Edit terraform.tfvars with your details

Step 4: Deploy Phase 1
terraform init
terraform plan
terraform apply

Step 5: Note OU IDs from outputs

Step 6: Update terraform.tfvars with OU IDs

Step 7: Deploy Phase 2
terraform apply

## Common Issues

Email already in use - Use unique emails
Organization exists - Import it first
IAM Identity Center not enabled - Enable in Console

## Costs
Free: Organizations, IAM Identity Center
Paid: GuardDuty ~$10-15/month if deployed

Total dev: $15-30/month
`
    };

    // Create download package
    let downloadContent = '# SecureBase Terraform Package\\n\\n';
    downloadContent += 'Files included:\\n\\n';
    Object.keys(files).forEach(filename => {
      downloadContent += `- ${filename}\\n`;
    });
    downloadContent += '\\n\\nTo deploy:\\n';
    downloadContent += '1. Extract all files to your securebase-app/landing-zone directory\\n';
    downloadContent += '2. cd environments/dev\\n';
    downloadContent += '3. cp terraform.tfvars.example terraform.tfvars\\n';
    downloadContent += '4. Edit terraform.tfvars with your account details\\n';
    downloadContent += '5. terraform init\\n';
    downloadContent += '6. terraform plan\\n';
    downloadContent += '7. terraform apply\\n';
    
    return files;
  };

  const downloadPackage = () => {
    setShowDownloadModal(true);
  };

  const confirmDownload = () => {
    const files = generateTerraformPackage();
    
    // Create a text representation of all files
    let content = 'SECUREBASE TERRAFORM PACKAGE\\n';
    content += '================================\\n\\n';
    content += 'Extract these files to your landing-zone directory.\\n';
    content += 'File structure matches your existing setup.\\n\\n';
    content += '================================\\n\\n';
    
    Object.entries(files).forEach(([filename, fileContent]) => {
      content += `\\n\\n=== FILE: ${filename} ===\\n`;
      content += fileContent;
      content += `\\n=== END: ${filename} ===\\n`;
    });

    // Create download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'securebase-terraform-package.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowDownloadModal(false);
  };

  const confirmDownload = () => {
    const files = generateTerraformPackage();
    
    // Create a text representation of all files
    let content = 'SECUREBASE TERRAFORM PACKAGE\n';
    content += '================================\n\n';
    content += 'Extract these files to your landing-zone directory.\n';
    content += 'File structure matches your existing setup.\n\n';
    content += '================================\n\n';
    
    Object.entries(files).forEach(([filename, fileContent]) => {
      content += `\n\n=== FILE: ${filename} ===\n`;
      content += fileContent;
      content += `\n=== END: ${filename} ===\n`;
    });

    // Create download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'securebase-terraform-package.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('✓ Package downloaded successfully', 'success');
    setShowDownloadModal(false);
  };
    // Verify admin password (demo: use "SecureBase2026")
    if (adminPassword !== 'SecureBase2026') {
      addLog('❌ Invalid admin password', 'error');
      return;
    }

    // Verify confirmation text
    if (destroyConfirmation !== devConfig.orgName) {
      addLog('❌ Organization name confirmation mismatch', 'error');
      return;
    }

    setIsDestroying(true);
    setShowDestroyModal(false);
    setDeploymentLog([]);

    const destroySteps = [
      { msg: '⚠️  DESTROY MODE ACTIVATED', delay: 500, type: 'error' },
      { msg: 'Admin privileges verified', delay: 800, type: 'success' },
      { msg: 'Generating destroy plan...', delay: 1000 },
      { msg: 'Planning to destroy 23 resources...', delay: 1200 },
      { msg: '', delay: 300 },
    ];

    // Destroy in reverse order
    if (devConfig.enabledModules.monitoring) {
      destroySteps.push(
        { msg: '[Monitoring] Deleting CloudWatch dashboards...', delay: 800 },
        { msg: '[Monitoring] Removing SNS topics...', delay: 600 },
        { msg: '[Monitoring] ✓ Monitoring destroyed', delay: 500, type: 'success' }
      );
    }

    if (devConfig.enabledModules.networking) {
      destroySteps.push(
        { msg: '[Networking] Deleting Transit Gateway attachments...', delay: 1000 },
        { msg: '[Networking] Removing VPCs...', delay: 900 },
        { msg: '[Networking] ✓ Network infrastructure destroyed', delay: 500, type: 'success' }
      );
    }

    if (devConfig.enabledModules.logging) {
      destroySteps.push(
        { msg: '[Logging] Disabling CloudTrail...', delay: 800 },
        { msg: '[Logging] Removing S3 log buckets...', delay: 1000 },
        { msg: '[Logging] ⚠️  Logs will be retained for 90 days', delay: 600 },
        { msg: '[Logging] ✓ Logging infrastructure destroyed', delay: 500, type: 'success' }
      );
    }

    if (devConfig.enabledModules.security) {
      destroySteps.push(
        { msg: '[Security] Disabling GuardDuty...', delay: 900 },
        { msg: '[Security] Removing Security Hub standards...', delay: 800 },
        { msg: '[Security] Deleting Config rules...', delay: 700 },
        { msg: '[Security] ✓ Security services deactivated', delay: 500, type: 'success' }
      );
    }

    if (devConfig.enabledModules.identity) {
      destroySteps.push(
        { msg: '[Identity] Removing account assignments...', delay: 800 },
        { msg: '[Identity] Deleting permission sets...', delay: 900 },
        { msg: '[Identity] ⚠️  Break-glass role preserved', delay: 600 },
        { msg: '[Identity] ✓ Identity Center cleaned up', delay: 500, type: 'success' }
      );
    }

    if (devConfig.enabledModules.core) {
      destroySteps.push(
        { msg: '[Core] Detaching SCPs...', delay: 800 },
        { msg: '[Core] ⚠️  Accounts marked for deletion (90-day wait)', delay: 1000 },
        { msg: '[Core] Removing organizational units...', delay: 900 },
        { msg: '[Core] ✓ Organization structure removed', delay: 500, type: 'success' }
      );
    }

    destroySteps.push(
      { msg: '', delay: 500 },
      { msg: '🗑️  Destroy complete', delay: 1000, type: 'success' },
      { msg: `Destroyed environment: ${devConfig.environment}`, delay: 300 },
      { msg: `Region: ${devConfig.region}`, delay: 300 },
      { msg: 'All resources scheduled for deletion', delay: 500 },
      { msg: '⚠️  CloudTrail logs preserved for audit', delay: 500 }
    );

    for (const step of destroySteps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      addLog(step.msg, step.type || 'info');
    }

    setIsDestroying(false);
    setTimeout(() => {
      setDevEnvStep('config');
      setDeploymentLog([]);
      setDestroyConfirmation('');
      setAdminPassword('');
    }, 3000);
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
    core: `Module 1: AWS Organizations + Account Factory

TERRAFORM-NATIVE ACCOUNT FACTORY
No Control Tower dependency. Pure Terraform account provisioning.

Resource: aws_organizations_organization
  feature_set = "ALL"
  enabled_policy_types = ["SERVICE_CONTROL_POLICY"]

Resource: aws_organizations_organizational_unit
  Security OU - parent_id = org.roots[0].id
  SharedServices OU - parent_id = org.roots[0].id  
  Workloads OU - parent_id = org.roots[0].id

Resource: aws_organizations_account
  for_each = var.accounts
  name = each.key
  email = each.value.email
  parent_id = each.value.ou_id
  lifecycle { prevent_destroy = true }

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

SERVICE CONTROL POLICIES (SCPs)

SCP 1: DenyRootUser (Applied to all OUs)
Prevents root account usage across organization:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyRootUser",
    "Effect": "Deny",
    "Action": "*",
    "Resource": "*",
    "Condition": {
      "StringLike": {
        "aws:PrincipalArn": "arn:aws:iam::*:root"
      }
    }
  }]
}

SCP 2: DenyPublicS3 (Applied to Workloads OU)
Prevents accidental data exposure:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyPublicS3",
    "Effect": "Deny",
    "Action": [
      "s3:PutBucketAcl",
      "s3:PutObjectAcl",
      "s3:PutBucketPolicy"
    ],
    "Resource": "*",
    "Condition": {
      "StringEquals": {
        "s3:x-amz-acl": [
          "public-read",
          "public-read-write",
          "authenticated-read"
        ]
      }
    }
  }]
}

SCP 3: EnforceMFA (Applied to Management + Security OUs)
Requires MFA for sensitive operations:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyWithoutMFA",
    "Effect": "Deny",
    "NotAction": [
      "iam:CreateVirtualMFADevice",
      "iam:EnableMFADevice",
      "iam:GetUser",
      "iam:ListMFADevices"
    ],
    "Resource": "*",
    "Condition": {
      "BoolIfExists": {
        "aws:MultiFactorAuthPresent": "false"
      }
    }
  }]
}

SCP 4: RestrictRegions (Applied to all OUs)
Limits deployments to approved regions:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyUnapprovedRegions",
    "Effect": "Deny",
    "NotAction": [
      "cloudfront:*",
      "iam:*",
      "route53:*",
      "support:*"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:RequestedRegion": [
          "us-east-1",
          "us-west-2",
          "eu-west-1"
        ]
      }
    }
  }]
}

SCP 5: ProtectSecurityServices (Applied to all OUs)
Prevents disabling of security monitoring:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "ProtectGuardDuty",
    "Effect": "Deny",
    "Action": [
      "guardduty:DeleteDetector",
      "guardduty:DisassociateFromMasterAccount",
      "guardduty:StopMonitoringMembers",
      "securityhub:DisableSecurityHub",
      "config:DeleteConfigurationRecorder",
      "config:StopConfigurationRecorder"
    ],
    "Resource": "*"
  }]
}

ACCOUNT FACTORY USAGE EXAMPLE

module "org" {
  source = "../../modules/org"

  organization_name = "acme-corp"
  
  accounts = {
    "security-log-archive" = {
      email = "aws-logs@acme.com"
      ou_id = module.org.security_ou_id
    }
    "security-audit" = {
      email = "aws-audit@acme.com"
      ou_id = module.org.security_ou_id
    }
    "shared-networking" = {
      email = "aws-network@acme.com"
      ou_id = module.org.shared_ou_id
    }
    "shared-cicd" = {
      email = "aws-cicd@acme.com"
      ou_id = module.org.shared_ou_id
    }
    "prod-web" = {
      email = "aws-prod-web@acme.com"
      ou_id = module.org.workloads_ou_id
    }
    "staging-web" = {
      email = "aws-staging-web@acme.com"
      ou_id = module.org.workloads_ou_id
    }
    "dev-sandbox" = {
      email = "aws-dev@acme.com"
      ou_id = module.org.workloads_ou_id
    }
  }

  scps = {
    deny_root_user = {
      policy = file("policies/deny-root.json")
      targets = [module.org.security_ou_id, module.org.workloads_ou_id]
    }
    deny_public_s3 = {
      policy = file("policies/deny-public-s3.json")
      targets = [module.org.workloads_ou_id]
    }
    enforce_mfa = {
      policy = file("policies/enforce-mfa.json")
      targets = [module.org.security_ou_id]
    }
    restrict_regions = {
      policy = file("policies/restrict-regions.json")
      targets = [module.org.workloads_ou_id]
    }
    protect_security = {
      policy = file("policies/protect-security.json")
      targets = [module.org.security_ou_id, module.org.workloads_ou_id]
    }
  }
}

IMPORTANT LIFECYCLE SETTINGS

prevent_destroy = true
Protects against accidental account deletion.
AWS requires 90-day waiting period for account deletion.
Manual intervention required to remove accounts.

OUTPUTS PROVIDED

outputs {
  organization_id = aws_organizations_organization.this.id
  organization_arn = aws_organizations_organization.this.arn
  security_ou_id = aws_organizations_organizational_unit.security.id
  shared_ou_id = aws_organizations_organizational_unit.shared.id
  workloads_ou_id = aws_organizations_organizational_unit.workloads.id
  account_ids = {
    for name, account in aws_organizations_account.accounts :
    name => account.id
  }
}

COMPLIANCE MAPPING

CIS AWS Foundations Benchmark:
- 1.1 Root account MFA (SCP enforced)
- 1.5 No root access keys (prevented)
- 1.7 Eliminate use of root (SCP enforced)
- 2.1 CloudTrail enabled (org-wide)

NIST 800-53:
- AC-2: Account Management (OU structure)
- AC-6: Least Privilege (SCPs)
- SC-7: Boundary Protection (account isolation)
- AU-2: Audit Events (org trail)

SOC2 Type II:
- CC6.1: Logical access controls
- CC6.2: MFA for privileged access
- CC6.3: Account provisioning/de-provisioning
- CC7.2: System monitoring

WHY THIS SELLS

✓ No Control Tower lock-in (pure Terraform)
✓ Passes fintech + gov audits out of box
✓ Clear blast-radius control
✓ Account factory scales to 100s of accounts
✓ SCPs aligned to CIS benchmarks
✓ Pre-configured for SOC2, ISO27001, PCI-DSS
✓ Infrastructure as Code (no ClickOps)
✓ Cost: FREE (AWS Organizations has no charge)`,

    identity: `Module 2: IAM Identity Center + Role Model

ZERO LONG-LIVED CREDENTIALS ARCHITECTURE
No IAM users. No access keys. SSO only.

DATA SOURCE: aws_ssoadmin_instances
Retrieves IAM Identity Center instance ARN automatically.
No manual configuration required.

locals {
  sso_instance_arn = data.aws_ssoadmin_instances.this.arns[0]
}

PERMISSION SET 1: ADMIN ACCESS (EMERGENCY ONLY)

resource "aws_ssoadmin_permission_set" "admin" {
  name             = "AdminAccess"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT1H"
  description      = "Full admin - break-glass only"
}

resource "aws_ssoadmin_managed_policy_attachment" "admin" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

Session Duration: 1 hour maximum
Use Case: Emergency outages, security incidents
Access: Full AWS admin rights
Restrictions: 
  - Must be logged to CloudTrail
  - Requires justification in ticket system
  - Limited to 2-3 people max

PERMISSION SET 2: PLATFORM ENGINEER (DAY-TO-DAY)

resource "aws_ssoadmin_permission_set" "platform" {
  name             = "PlatformEngineer"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT4H"
  description      = "DevOps/Platform team daily access"
}

resource "aws_ssoadmin_permission_set_inline_policy" "platform" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.platform.arn

  inline_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAppServices"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "ecs:*",
          "eks:*",
          "lambda:*",
          "s3:*",
          "rds:*",
          "dynamodb:*",
          "cloudwatch:*",
          "logs:*",
          "elasticloadbalancing:*",
          "autoscaling:*",
          "elasticache:*",
          "sns:*",
          "sqs:*",
          "route53:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenyIdentityChanges"
        Effect = "Deny"
        Action = [
          "iam:CreateUser",
          "iam:DeleteUser",
          "iam:CreateAccessKey",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:PutRolePolicy",
          "organizations:*",
          "account:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenySecurityDisable"
        Effect = "Deny"
        Action = [
          "guardduty:DeleteDetector",
          "securityhub:DisableSecurityHub",
          "config:StopConfigurationRecorder"
        ]
        Resource = "*"
      }
    ]
  })
}

Session Duration: 4 hours
Use Case: Daily operations, deployments, troubleshooting
Allowed: Application services (EC2, RDS, Lambda, etc.)
Denied: IAM changes, Organizations, security service disabling
Team Size: 5-15 engineers typical

PERMISSION SET 3: READ-ONLY AUDITOR

resource "aws_ssoadmin_permission_set" "auditor" {
  name             = "ReadOnlyAuditor"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
  description      = "Compliance and audit team access"
}

resource "aws_ssoadmin_managed_policy_attachment" "auditor_readonly" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.auditor.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_ssoadmin_managed_policy_attachment" "auditor_security" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.auditor.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}

Session Duration: 8 hours
Use Case: Security audits, compliance reviews, evidence collection
Access: Read-only across all services + security audit permissions
Team: External auditors, compliance officers, security team
Critical for: SOC2, ISO27001, PCI-DSS audits

PERMISSION SET 4: DEVELOPER (APPLICATION TEAMS)

resource "aws_ssoadmin_permission_set" "developer" {
  name             = "Developer"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
  description      = "Application development team"
}

resource "aws_ssoadmin_permission_set_inline_policy" "developer" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.developer.arn

  inline_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowNonProdDevelopment"
        Effect = "Allow"
        Action = [
          "lambda:*",
          "s3:*",
          "dynamodb:*",
          "sqs:*",
          "sns:Publish"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = ["us-east-1", "us-west-2"]
          }
        }
      },
      {
        Sid    = "ReadOnlyInfra"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "rds:Describe*",
          "logs:Describe*",
          "logs:Get*",
          "cloudwatch:Describe*",
          "cloudwatch:Get*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenyProdModification"
        Effect = "Deny"
        Action = "*"
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:PrincipalTag/Environment" = "production"
          }
        }
      }
    ]
  })
}

BREAK-GLASS ROLE (REQUIRED FOR AUDITS)

resource "aws_iam_role" "break_glass" {
  name               = "BreakGlassAdmin"
  max_session_duration = 3600
  description        = "Emergency access with MFA - use only in crisis"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::MANAGEMENT_ACCOUNT_ID:root"
      }
      Action = "sts:AssumeRole"
      Condition = {
        Bool = {
          "aws:MultiFactorAuthPresent" = "true"
        }
        NumericLessThan = {
          "aws:MultiFactorAuthAge" = "3600"
        }
      }
    }]
  })

  tags = {
    Purpose = "EmergencyAccess"
    Owner   = "SecurityTeam"
  }
}

resource "aws_iam_role_policy_attachment" "break_glass_admin" {
  role       = aws_iam_role.break_glass.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

Credentials Storage:
- MFA device stored in physical safe
- 2 people required to access (dual control)
- All usage logged to dedicated SNS topic
- Requires incident ticket number

When to Use:
- IAM Identity Center outage
- Console login failure
- Emergency security response
- Disaster recovery scenarios

Auditor Requirements:
- Must exist (required by most frameworks)
- Must be MFA-protected
- Must log all usage
- Must have restricted access

IAM ACCOUNT PASSWORD POLICY (FALLBACK USERS)

resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 16
  require_uppercase_characters   = true
  require_lowercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  max_password_age               = 90
  password_reuse_prevention      = 24
  allow_users_to_change_password = true
  hard_expiry                    = false
}

Applies to: Emergency IAM users only (if created)
Default: No IAM users should exist (SSO only)
Hard Expiry: False (prevents lockout during incident)

ACCOUNT ASSIGNMENTS

resource "aws_ssoadmin_account_assignment" "platform_prod" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.platform.arn

  principal_id   = aws_identitystore_group.platform_engineers.group_id
  principal_type = "GROUP"

  target_id   = "123456789012"  # Production account ID
  target_type = "AWS_ACCOUNT"
}

Best Practice:
- Assign to groups, not individual users
- Use descriptive group names (PlatformEngineers, Auditors)
- Document group membership in README
- Review assignments quarterly

GROUP STRUCTURE EXAMPLE

Identity Center Groups:
- AdminEmergency (2-3 people max)
- PlatformEngineers (5-15 people)
- Developers (20-50 people)
- ReadOnlyAuditors (2-5 people)
- DataEngineers (custom permissions)
- SecurityTeam (security-specific access)

COMPLIANCE MAPPING

CIS AWS Foundations:
- 1.4 Eliminate root access (SSO enforced)
- 1.5 MFA for privileged users (SSO enforced)
- 1.16 IAM policies assigned to groups (enforced)

NIST 800-53:
- IA-2: Identification and Authentication
- IA-5: Authenticator Management (MFA)
- AC-2: Account Management (SSO groups)
- AC-6: Least Privilege (permission sets)

SOC2 Type II:
- CC6.1: Logical access controls
- CC6.2: MFA for privileged access
- CC6.3: Provisioning/de-provisioning
- CC6.6: Segregation of duties

WHY THIS SELLS

✓ Zero long-lived credentials (no IAM users)
✓ MFA enforced at identity provider level
✓ Session-based access (automatic expiration)
✓ Break-glass role passes all audits
✓ Granular permission sets (4 pre-built)
✓ Group-based access (no individual assignments)
✓ CloudTrail logs every action
✓ Meets CIS, NIST, SOC2, PCI-DSS
✓ Cost: FREE (IAM Identity Center included)`,

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
