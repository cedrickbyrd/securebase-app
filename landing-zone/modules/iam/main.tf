# IAM Identity Center Module

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_ssoadmin_instances" "this" {}

locals {
  sso_instance_arn = tolist(data.aws_ssoadmin_instances.this.arns)[0]
  identity_store_id = tolist(data.aws_ssoadmin_instances.this.identity_store_ids)[0]
}

resource "aws_ssoadmin_permission_set" "admin" {
  name             = "AdminAccess"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT1H"
  description      = "Full administrator access - emergency use only"
}

resource "aws_ssoadmin_managed_policy_attachment" "admin" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_ssoadmin_permission_set" "platform" {
  name             = "PlatformEngineer"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT4H"
  description      = "Platform engineering team - daily operations"
}

# AWS Config role for this organization's management account
resource "aws_iam_role" "aws_config_role" {
  name        = "AWSConfigRole"
  description = "Role for AWS Config to record and evaluate configuration"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "config.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Purpose   = "ConfigRecorder"
    ManagedBy = "Terraform"
  }
}

resource "aws_iam_role" "break_glass" {
  name                 = "BreakGlassAdmin"
  max_session_duration = 3600
  description          = "Emergency access role - MFA required"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${var.management_account_id}:root"
      }
      Action = "sts:AssumeRole"
      Condition = {
        Bool = {
          "aws:MultiFactorAuthPresent" = "true"
        }
      }
    }]
  })

  tags = {
    Purpose   = "EmergencyAccess"
    ManagedBy = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "break_glass_admin" {
  role       = aws_iam_role.break_glass.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

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
resource "aws_ssoadmin_permission_set" "auditor" {
  name             = "SecurityAuditor"
  description      = "Read-only access across the organization for auditing"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT2H"
}

resource "aws_ssoadmin_managed_policy_attachment" "auditor_read_only" {
  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.auditor.arn
  managed_policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}
