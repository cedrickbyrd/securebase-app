# AWS Config IAM Role
resource "aws_iam_role" "aws_config_role" {
  name = "aws-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = {
        Service = "config.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "aws_config_role" {
  role       = aws_iam_role.aws_config_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

# SSO Permission Sets
resource "aws_ssoadmin_permission_set" "admin" {
  name             = "AdministratorAccess"
  instance_arn     = var.sso_instance_arn
  session_duration = "PT8H"
  tags             = var.tags
}

resource "aws_ssoadmin_permission_set" "platform" {
  name             = "PlatformEngineer"
  instance_arn     = var.sso_instance_arn
  session_duration = "PT8H"
  tags             = var.tags
}

resource "aws_ssoadmin_permission_set" "auditor" {
  name             = "Auditor"
  instance_arn     = var.sso_instance_arn
  session_duration = "PT4H"
  tags             = var.tags
}
