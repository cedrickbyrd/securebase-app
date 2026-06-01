terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "migrator" {
  name = "securebase-${var.environment}-db-migrator"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "vpc_execution" {
  role       = aws_iam_role.migrator.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "secrets" {
  name = "securebase-${var.environment}-db-migrator-secrets"
  role = aws_iam_role.migrator.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "ReadDBSecrets"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.allowed_secret_arns
    }]
  })
}

resource "aws_lambda_permission" "github_actions" {
  for_each      = toset(var.invoker_role_arns)
  statement_id  = "AllowGitHubActions-${replace(each.key, "/[^a-zA-Z0-9]/", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.migrator.function_name
  principal     = "sts.amazonaws.com"
  source_arn    = each.key
}

resource "aws_security_group" "migrator" {
  name        = "securebase-${var.environment}-db-migrator"
  description = "db-migrator Lambda egress to RDS proxy and Secrets Manager only"
  vpc_id      = var.vpc_id

  egress {
    description = "PostgreSQL to RDS proxy"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTPS for Secrets Manager"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "securebase-${var.environment}-db-migrator" })
}

resource "aws_cloudwatch_log_group" "migrator" {
  name              = "/aws/lambda/securebase-${var.environment}-db-migrator"
  retention_in_days = 90
  tags              = var.tags
}

resource "aws_lambda_function" "migrator" {
  function_name    = "securebase-${var.environment}-db-migrator"
  description      = "VPC-resident migration runner for Phase 6 Aurora schema"
  role             = aws_iam_role.migrator.arn
  filename         = var.zip_path
  runtime          = "python3.12"
  handler          = "db_migrator.handler"
  timeout          = 300
  memory_size      = 256
  source_code_hash = filebase64sha256(var.zip_path)

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.migrator.id]
  }

  environment {
    variables = {
      AWS_REGION_OVERRIDE = data.aws_region.current.name
    }
  }

  depends_on = [aws_iam_role_policy_attachment.vpc_execution, aws_cloudwatch_log_group.migrator]
  tags = var.tags
}
