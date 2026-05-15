# Phase 6 Lambda Functions Module
# Deploys audit_evidence_api and compliance_history_api Lambdas
# wired to the evidence S3 bucket, KMS key, and DynamoDB scores table.

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

# ============================================================================
# IAM Role for phase6 Lambdas
# ============================================================================

resource "aws_iam_role" "phase6_lambda" {
  name = "securebase-${var.environment}-phase6-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(var.tags, { Phase = "6" })
}

resource "aws_iam_role_policy_attachment" "phase6_basic" {
  role       = aws_iam_role.phase6_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "phase6_permissions" {
  name = "securebase-${var.environment}-phase6-permissions"
  role = aws_iam_role.phase6_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3EvidenceBucket"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.evidence_bucket_name}",
          "arn:aws:s3:::${var.evidence_bucket_name}/*"
        ]
      },
      {
        Sid    = "KMSEvidence"
        Effect = "Allow"
        Action = ["kms:GenerateDataKey*", "kms:Decrypt", "kms:DescribeKey"]
        Resource = var.evidence_kms_key_arn
      },
      {
        Sid    = "DynamoDBScores"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:Query", "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/securebase-compliance-scores"
      },
      {
        Sid    = "RDSProxy"
        Effect = "Allow"
        Action = ["rds-db:connect"]
        Resource = "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:*/securebase"
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:securebase/${var.environment}/*"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:*:log-group:/aws/lambda/securebase-${var.environment}-phase6-*"
      }
    ]
  })
}

# ============================================================================
# audit_evidence_api Lambda
# Handles: GET /admin/evidence, GET /admin/evidence/{id},
#          POST /admin/evidence/generate
# ============================================================================

resource "aws_lambda_function" "audit_evidence_api" {
  filename         = var.audit_evidence_api_zip
  function_name    = "securebase-${var.environment}-phase6-audit-evidence-api"
  role             = aws_iam_role.phase6_lambda.arn
  handler          = "audit_evidence_api.lambda_handler"
  source_code_hash = filebase64sha256(var.audit_evidence_api_zip)
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512

  tracing_config { mode = "Active" }

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      EVIDENCE_BUCKET      = var.evidence_bucket_name
      EVIDENCE_KMS_KEY_ARN = var.evidence_kms_key_arn
      RDS_HOST             = var.rds_proxy_endpoint
      RDS_DATABASE         = var.database_name
      RDS_USER             = var.database_user
      LOG_LEVEL            = "INFO"
      PRESIGNED_URL_EXPIRY = "3600"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = var.security_group_ids
  }

  tags = merge(var.tags, { Phase = "6.1", Name = "securebase-${var.environment}-phase6-audit-evidence-api" })
}

resource "aws_cloudwatch_log_group" "audit_evidence_api" {
  name              = "/aws/lambda/securebase-${var.environment}-phase6-audit-evidence-api"
  retention_in_days = 90
  tags              = var.tags
}

# ============================================================================
# compliance_history_api Lambda
# Handles: GET /tenant/compliance/history
# ============================================================================

resource "aws_lambda_function" "compliance_history_api" {
  filename         = var.compliance_history_api_zip
  function_name    = "securebase-${var.environment}-phase6-compliance-history-api"
  role             = aws_iam_role.phase6_lambda.arn
  handler          = "compliance_history_api.lambda_handler"
  source_code_hash = filebase64sha256(var.compliance_history_api_zip)
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512

  tracing_config { mode = "Active" }

  environment {
    variables = {
      ENVIRONMENT             = var.environment
      COMPLIANCE_SCORES_TABLE = "securebase-compliance-scores"
      LOG_LEVEL               = "INFO"
    }
  }

  # No VPC needed — only reads from DynamoDB (public endpoint via VPC endpoint or NAT)
  tags = merge(var.tags, { Phase = "6.2", Name = "securebase-${var.environment}-phase6-compliance-history-api" })
}

resource "aws_cloudwatch_log_group" "compliance_history_api" {
  name              = "/aws/lambda/securebase-${var.environment}-phase6-compliance-history-api"
  retention_in_days = 90
  tags              = var.tags
}
