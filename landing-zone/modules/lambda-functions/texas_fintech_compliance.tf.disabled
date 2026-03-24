# Texas Fintech Compliance Collector Lambda
# Add this to landing-zone/modules/lambda-functions/main.tf

resource "aws_lambda_function" "texas_fintech_compliance" {
  function_name = "${var.environment}-texas-fintech-compliance-collector"
  description   = "Collects Texas Department of Banking and FinCEN compliance evidence"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "texas_fintech_compliance_collector.lambda_handler"
  runtime       = "python3.11"
  timeout       = 300  # 5 minutes
  memory_size   = 1024  # 1GB for large data processing
  
  filename         = "${path.module}/../../../phase2-backend/deploy/texas_fintech_compliance_collector.zip"
  source_code_hash = filebase64sha256("${path.module}/../../../phase2-backend/deploy/texas_fintech_compliance_collector.zip")
  
  environment {
    variables = {
      RDS_ENDPOINT    = var.rds_endpoint
      RDS_PORT        = var.rds_port
      DB_NAME         = var.db_name
      RDS_SECRET_ARN  = var.rds_secret_arn
      EVIDENCE_BUCKET = aws_s3_bucket.texas_compliance_evidence.id
    }
  }
  
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }
  
  layers = [
    var.db_layer_arn
  ]
  
  tags = {
    Name        = "${var.environment}-texas-fintech-compliance"
    Environment = var.environment
    Framework   = "fintech"
    Compliance  = "Texas-DOB,FinCEN,BSA-AML"
    ManagedBy   = "terraform"
  }
}

# S3 Bucket for Texas Fintech Compliance Evidence
resource "aws_s3_bucket" "texas_compliance_evidence" {
  bucket = "${var.environment}-securebase-texas-compliance-evidence"
  
  tags = {
    Name        = "${var.environment}-texas-compliance-evidence"
    Purpose     = "Texas fintech compliance evidence storage"
    Environment = var.environment
    Compliance  = "Texas-DOB,FinCEN"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "texas_compliance_evidence" {
  bucket = aws_s3_bucket.texas_compliance_evidence.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "texas_compliance_evidence" {
  bucket = aws_s3_bucket.texas_compliance_evidence.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket lifecycle policy (archive to Glacier after 90 days)
resource "aws_s3_bucket_lifecycle_configuration" "texas_compliance_evidence" {
  bucket = aws_s3_bucket.texas_compliance_evidence.id
  
  rule {
    id     = "archive-to-glacier"
    status = "Enabled"
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    # Retain for 7 years (FinCEN requirement)
    expiration {
      days = 2555  # 7 years
    }
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "texas_compliance_evidence" {
  bucket = aws_s3_bucket.texas_compliance_evidence.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM policy for Lambda to access S3
resource "aws_iam_role_policy" "texas_compliance_s3_access" {
  name = "${var.environment}-texas-compliance-s3-policy"
  role = var.lambda_exec_role_name
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.texas_compliance_evidence.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.texas_compliance_evidence.arn
      }
    ]
  })
}

# EventBridge rule for monthly compliance collection
resource "aws_cloudwatch_event_rule" "monthly_texas_compliance" {
  name                = "${var.environment}-monthly-texas-compliance"
  description         = "Trigger Texas fintech compliance collection monthly"
  schedule_expression = "cron(0 0 1 * ? *)"  # 1st of month at midnight UTC
  
  tags = {
    Name        = "${var.environment}-monthly-texas-compliance"
    Environment = var.environment
  }
}

# EventBridge target for Lambda
resource "aws_cloudwatch_event_target" "texas_compliance_lambda" {
  rule      = aws_cloudwatch_event_rule.monthly_texas_compliance.name
  target_id = "TexasComplianceLambda"
  arn       = aws_lambda_function.texas_fintech_compliance.arn
  
  input = jsonencode({
    customer_id = "auto-discover"  # Lambda will iterate through all fintech customers
    controls    = ["TX-MT-R1", "TX-MT-R2", "TX-MT-R3", "TX-MT-R4", "TX-DASP-R1"]
    sample_size = 100
  })
}

# Lambda permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_texas_compliance" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.texas_fintech_compliance.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_texas_compliance.arn
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "texas_compliance_logs" {
  name              = "/aws/lambda/${aws_lambda_function.texas_fintech_compliance.function_name}"
  retention_in_days = 30
  
  tags = {
    Name        = "${var.environment}-texas-compliance-logs"
    Environment = var.environment
  }
}

# Outputs
output "texas_compliance_lambda_arn" {
  description = "ARN of Texas fintech compliance collector Lambda"
  value       = aws_lambda_function.texas_fintech_compliance.arn
}

output "texas_compliance_evidence_bucket" {
  description = "S3 bucket for Texas compliance evidence"
  value       = aws_s3_bucket.texas_compliance_evidence.id
}

output "texas_compliance_schedule_rule" {
  description = "EventBridge rule for monthly compliance collection"
  value       = aws_cloudwatch_event_rule.monthly_texas_compliance.arn
}
