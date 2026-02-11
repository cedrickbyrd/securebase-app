# ============================================================================
# Email Infrastructure - TxImhotep LLC
# Production-ready SES + SQS + Lambda for transactional emails
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

# Data sources
data "aws_route53_zone" "tximhotep" {
  name = "tximhotep.com"
}

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

# ============================================================================
# 1. SES Domain Identity & DNS Verification
# ============================================================================

resource "aws_ses_domain_identity" "tximhotep" {
  domain = "tximhotep.com"
}

resource "aws_route53_record" "ses_verification" {
  zone_id = data.aws_route53_zone.tximhotep.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.tximhotep.id}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.tximhotep.verification_token]
}

resource "aws_ses_domain_identity_verification" "tximhotep" {
  domain     = aws_ses_domain_identity.tximhotep.id
  depends_on = [aws_route53_record.ses_verification]
}

# ============================================================================
# 2. DKIM (Email Authentication)
# ============================================================================

resource "aws_ses_domain_dkim" "tximhotep" {
  domain = aws_ses_domain_identity.tximhotep.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.tximhotep.zone_id
  name    = "${element(aws_ses_domain_dkim.tximhotep.dkim_tokens, count.index)}._domainkey"
  type    = "CNAME"
  ttl     = 600
  records = ["${element(aws_ses_domain_dkim.tximhotep.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

# ============================================================================
# 3. SPF Record (Sender Policy Framework)
# Note: Merges with existing TXT records to avoid clobbering
# ============================================================================

resource "aws_route53_record" "spf" {
  count   = var.create_spf_record ? 1 : 0
  zone_id = data.aws_route53_zone.tximhotep.zone_id
  name    = "tximhotep.com"
  type    = "TXT"
  ttl     = 300
  records = concat(
    ["v=spf1 include:amazonses.com ~all"],
    var.existing_apex_txt_records
  )
}

# ============================================================================
# 4. DMARC Record (Email Security & Reporting)
# ============================================================================

resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.tximhotep.zone_id
  name    = "_dmarc.tximhotep.com"
  type    = "TXT"
  ttl     = 300
  records = [
    "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@tximhotep.com; pct=100; adkim=s; aspf=s"
  ]
}

# ============================================================================
# 5. MX Records (Optional - to receive email)
# WARNING: This will override existing MX records for the domain
# ============================================================================

resource "aws_route53_record" "mx" {
  count   = var.enable_inbound_email ? 1 : 0
  zone_id = data.aws_route53_zone.tximhotep.zone_id
  name    = "tximhotep.com"
  type    = "MX"
  ttl     = 300
  records = [
    "10 inbound-smtp.${data.aws_region.current.name}.amazonaws.com",
  ]
}

# ============================================================================
# 6. SQS Queues (Main + Dead Letter Queue)
# ============================================================================

resource "aws_sqs_queue" "email_dlq" {
  name                      = "securebase-email-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
  
  tags = {
    Name        = "SecureBase Email DLQ"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_sqs_queue" "email_queue" {
  name                       = "securebase-email-queue-${var.environment}"
  message_retention_seconds  = 86400  # 24 hours
  receive_wait_time_seconds  = 20     # Long polling
  visibility_timeout_seconds = 180    # 3 minutes (6x Lambda timeout)
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_dlq.arn
    maxReceiveCount     = 4
  })
  
  tags = {
    Name        = "SecureBase Email Queue"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ============================================================================
# 7. Lambda Function (Email Worker)
# ============================================================================

data "archive_file" "lambda_email_worker" {
  type        = "zip"
  output_path = "${path.module}/lambda_email_worker.zip"
  
  source {
    content  = file("${path.module}/lambda/email-worker.js")
    filename = "index.js"
  }
}

resource "aws_lambda_function" "email_processor" {
  function_name    = "securebase-email-worker-${var.environment}"
  description      = "Processes email queue and sends via SES"
  role             = aws_iam_role.lambda_email_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  filename         = data.archive_file.lambda_email_worker.output_path
  source_code_hash = data.archive_file.lambda_email_worker.output_base64sha256
  timeout          = 30
  memory_size      = 256
  
  environment {
    variables = {
      SENDER_EMAIL        = var.sender_email
      SES_REGION          = data.aws_region.current.name
      CONFIGURATION_SET   = aws_ses_configuration_set.main.name
    }
  }
  
  tags = {
    Name        = "SecureBase Email Worker"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.email_queue.arn
  function_name    = aws_lambda_function.email_processor.arn
  batch_size       = 10
  enabled          = true
  
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_cloudwatch_log_group" "lambda_email_logs" {
  name              = "/aws/lambda/${aws_lambda_function.email_processor.function_name}"
  retention_in_days = 14
}

# ============================================================================
# 8. IAM Roles & Policies
# ============================================================================

resource "aws_iam_role" "lambda_email_role" {
  name = "securebase-lambda-email-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name        = "SecureBase Lambda Email Role"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy" "lambda_email_policy" {
  name = "securebase-lambda-email-policy-${var.environment}"
  role = aws_iam_role.lambda_email_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail"
        ]
        Resource = aws_ses_domain_identity.tximhotep.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.email_queue.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ============================================================================
# 9. SES Configuration Set (for tracking events)
# ============================================================================

resource "aws_ses_configuration_set" "main" {
  name = "securebase-email-tracking-${var.environment}"
}

resource "aws_sns_topic" "email_events" {
  name = "securebase-email-events-${var.environment}"
  
  tags = {
    Name        = "SecureBase Email Events"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_ses_event_destination" "sns" {
  name                   = "email-events-sns"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["bounce", "complaint", "delivery", "send", "reject", "open", "click"]
  
  sns_destination {
    topic_arn = aws_sns_topic.email_events.arn
  }
}

resource "aws_sns_topic_policy" "email_events" {
  arn = aws_sns_topic.email_events.arn
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ses.amazonaws.com"
      }
      Action   = "SNS:Publish"
      Resource = aws_sns_topic.email_events.arn
    }]
  })
}

# ============================================================================
# 10. CloudWatch Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "email_dlq_messages" {
  alarm_name          = "securebase-email-dlq-messages-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "Alert when DLQ has more than 5 messages"
  alarm_actions       = [aws_sns_topic.email_events.arn]
  
  dimensions = {
    QueueName = aws_sqs_queue.email_dlq.name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "securebase-email-worker-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when Lambda has more than 10 errors"
  alarm_actions       = [aws_sns_topic.email_events.arn]
  
  dimensions = {
    FunctionName = aws_lambda_function.email_processor.function_name
  }
}
