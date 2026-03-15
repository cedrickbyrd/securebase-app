# AWS Config IAM Role
resource "aws_iam_role" "aws_config_role" {
  name = "aws-config-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
    }]
  })
}

# SSO Permission Sets
resource "aws_ssoadmin_permission_set" "admin" {
  name         = "AdministratorAccess"
  instance_arn = var.sso_instance_arn
}

resource "aws_ssoadmin_permission_set" "platform" {
  name         = "PlatformEngineer"
  instance_arn = var.sso_instance_arn
}

resource "aws_ssoadmin_permission_set" "auditor" {
  name         = "Auditor"
  instance_arn = var.sso_instance_arn
}
