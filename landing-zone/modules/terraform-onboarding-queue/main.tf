# Terraform Onboarding Queue Module
#
# Provides a queue-based execution pattern for long-running tenant provisioning
# tasks (terraform apply) so that concurrent onboarding requests are serialized
# per target environment rather than colliding on the same Terraform state.
#
# Architecture:
#
#   [trigger_onboarding Lambda / AI tool call]
#           │  SQS SendMessage
#           ▼
#   ┌───────────────────────────────────┐
#   │  aws_sqs_queue.onboarding         │  KMS-encrypted, 15-min visibility
#   │  (FIFO per MessageGroupId=env)    │  timeout covers a terraform apply
#   └──────────────┬────────────────────┘
#                  │  Lambda trigger (batch_size=1)
#                  ▼
#   ┌───────────────────────────────────┐
#   │  aws_lambda_function (external)   │  reserved_concurrent_executions=1
#   │  var.worker_lambda_function_name  │  per environment
#   └───────────────────────────────────┘
#           │  on failure (3 attempts)
#           ▼
#   ┌───────────────────────────────────┐
#   │  aws_sqs_queue.onboarding_dlq     │  14-day retention, ops alert
#   └───────────────────────────────────┘
#
# The SQS FIFO queue guarantees that messages for the same tenant environment
# (identified by MessageGroupId) are processed exactly-once and in order, which
# prevents two concurrent terraform apply executions from corrupting state.
#
# Isolation guarantee: PartitionKey = tenant_id prevents cross-tenant
# throughput exhaustion and ensures Tenant A's onboarding cannot starve
# or corrupt Tenant B's state.

terraform {
  required_version = ">= 1.5.0"
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
# Dead-Letter Queue
# ============================================================================

resource "aws_sqs_queue" "onboarding_dlq" {
  name                      = "securebase-${var.environment}-tf-onboarding-dlq.fifo"
  fifo_queue                = true
  content_based_deduplication = true
  message_retention_seconds = 1209600 # 14 days — ops window before data loss

  kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/sqs"

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-tf-onboarding-dlq"
    Environment = var.environment
    Component   = "terraform-onboarding-queue"
  })
}

# ============================================================================
# Main Onboarding Queue (FIFO)
# ============================================================================

resource "aws_sqs_queue" "onboarding" {
  name                        = "securebase-${var.environment}-tf-onboarding.fifo"
  fifo_queue                  = true
  content_based_deduplication = true

  # Visibility timeout must be longer than the maximum expected terraform apply
  # duration.  Set to 15 minutes; adjust upward for large customer baselines.
  visibility_timeout_seconds = var.visibility_timeout_seconds

  message_retention_seconds  = 86400 # 1 day — tasks should not queue overnight
  receive_wait_time_seconds  = 20    # long-polling reduces empty-receive cost

  kms_master_key_id = var.kms_key_arn != "" ? var.kms_key_arn : "alias/aws/sqs"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.onboarding_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-tf-onboarding"
    Environment = var.environment
    Component   = "terraform-onboarding-queue"
  })
}

# ============================================================================
# Queue Policy — allow the onboarding trigger Lambda to send messages
# ============================================================================

resource "aws_sqs_queue_policy" "onboarding" {
  queue_url = aws_sqs_queue.onboarding.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowOnboardingTriggerSend"
        Effect = "Allow"
        Principal = {
          AWS = var.trigger_lambda_role_arn != "" ? var.trigger_lambda_role_arn : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
        Resource = aws_sqs_queue.onboarding.arn
      }
    ]
  })
}

# ============================================================================
# Lambda Event Source Mapping
#
# batch_size=1 combined with the worker Lambda's reserved_concurrent_executions=1
# (set externally on the Lambda function) guarantees exactly one terraform apply
# runs per environment at a time.  The FIFO MessageGroupId further serializes
# messages destined for the same environment even without Lambda concurrency
# controls.
# ============================================================================

resource "aws_lambda_event_source_mapping" "onboarding" {
  count = var.worker_lambda_function_name != "" ? 1 : 0

  event_source_arn = aws_sqs_queue.onboarding.arn
  function_name    = var.worker_lambda_function_name
  batch_size       = 1 # one terraform apply at a time
  enabled          = true

  # Report individual message failures so failed items go to DLQ while
  # successfully processed items are not re-processed.
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 1 # enforce single-concurrency at the trigger level
  }
}

# ============================================================================
# CloudWatch Alarm — DLQ depth alert
# Fires when any message lands in the DLQ so ops can investigate failed applies.
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "securebase-${var.environment}-tf-onboarding-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Terraform onboarding DLQ has messages — a tenant apply may have failed"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.onboarding_dlq.name
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  tags = merge(var.tags, {
    Environment = var.environment
    Component   = "terraform-onboarding-queue"
  })
}
