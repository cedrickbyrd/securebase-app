# Management account alias for console branding and login URL
resource "aws_iam_account_alias" "management" {
  account_alias = var.org_name
}

# Existing organization resource below...
resource "aws_organizations_organization" "main" {
  aws_service_access_principals = [
    "cloudtrail.amazonaws.com",
    "config.amazonaws.com",
    "guardduty.amazonaws.com",
    "securityhub.amazonaws.com",
    "sso.amazonaws.com",
  ]

  enabled_policy_types = [
    "SERVICE_CONTROL_POLICY",
  ]

  feature_set = "ALL"
}
####
resource "aws_organizations_organizational_unit" "security" {
  name      = "Security"
  parent_id = var.org_root_id # You'll need to pass this in
}

resource "aws_organizations_organizational_unit" "shared" {
  name      = "SharedServices"
  parent_id = var.org_root_id
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = "Workloads"
  parent_id = var.org_root_id
}
# SCP: Deny actions that bypass security or use the Root User
resource "aws_organizations_policy" "security_guardrails" {
  name        = "SecurityGuardrails"
  description = "Block Root usage and protect security services"
  type        = "SERVICE_CONTROL_POLICY"

  content = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RestrictRootUser"
        Effect    = "Deny"
        Action    = "*"
        Resource  = "*"
        Condition = { "StringLike" = { "aws:PrincipalArn" = "arn:aws:iam::*:root" } }
      },
      {
        Sid      = "ProtectSecurityServices"
        Effect   = "Deny"
        Action   = [
          "cloudtrail:StopLogging",
          "cloudtrail:DeleteTrail",
          "guardduty:DeleteDetector",
          "securityhub:BatchDisableStandards"
        ]
        Resource = "*"
      }
    ]
  })
}

# SCP: Block IAM User Creation (Forces use of Identity Center)
resource "aws_organizations_policy" "block_iam_users" {
  name        = "BlockIAMUsers"
  description = "Prevent creation of IAM users and access keys"
  type        = "SERVICE_CONTROL_POLICY"

  content = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "DenyIAMUserCreation"
      Effect   = "Deny"
      Action   = [
        "iam:CreateUser",
        "iam:CreateAccessKey"
      ]
      Resource = "*"
    }]
  })
}
###
resource "aws_guardduty_detector" "org" {
  enable = true
}

# Note: GuardDuty organization configuration requires delegated administrator
# Commented out for initial deployment - enable after org is fully set up
#resource "aws_guardduty_organization_configuration" "org" {
#  detector_id                      = aws_guardduty_detector.org.id
#  auto_enable_organization_members = "ALL"
#
#  datasources {
#    s3_logs {
#      auto_enable = true
#    }
#    kubernetes {
#      audit_logs {
#        enable = true
#      }
#    }
#  }
#}

#resource "aws_guardduty_organization_configuration" "org" {
#  detector_id = aws_guardduty_detector.org.id
#  auto_enable_organization_members = "ALL"
#
#}
#resource "aws_guardduty_organization_admin_account" "admin" {
#  admin_account_id = var.security_account_id
#}

resource "aws_securityhub_account" "org" {}

# Note: Security Hub organization configuration requires delegated administrator
# This must be configured after organization is set up with dedicated security account
# Commented out for initial deployment
#resource "aws_securityhub_organization_configuration" "org" {
#  auto_enable = true
#}

