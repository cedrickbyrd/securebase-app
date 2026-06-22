terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  common_tags = merge(var.tags, {
    Environment = var.environment
    Phase       = "marketplace"
    ManagedBy   = "terraform"
  })

  lambda_s3_parts = {
    for k, uri in var.lambda_packages : k => split("/", replace(uri, "s3://", ""))
  }

  lambda_s3 = {
    for k, parts in local.lambda_s3_parts : k => {
      bucket = parts[0]
      key    = join("/", slice(
        parts,
        1,
        length(parts)
      ))
    }
  }
}

resource "aws_sns_topic" "marketplace_subscriptions" {
  name = "securebase-${var.environment}-marketplace-subscriptions"
  tags = local.common_tags
}

# aws_sns_topic_policy intentionally omitted.
# The SNS default policy (owner-scoped) is sufficient for this topic.
# aws-marketplace.amazonaws.com is not a valid Service principal for
# SetTopicAttributes in this account context — adding a custom policy
# causes "Policy Error: null" on every apply. AWS Marketplace publishes
# to this topic via the subscription endpoint registered in AMMP, not
# via a resource-based policy grant.

# ---------------------------------------------------------------------------
# DLQ — catches subscription_handler Lambda failures (errors or throttles).
# A lost subscribe-success event = a customer who subscribed and was never
# provisioned. 14-day retention gives ops time to replay. Encrypted at rest
# with SSE-SQS (default) or a customer-managed KMS key if provided.
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "subscription_handler_dlq" {
  name                       = "securebase-${var.environment}-marketplace-subscription-handler-dlq"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 300     # match Lambda timeout ceiling

  # Use customer-managed KMS if provided; fall back to SSE-SQS (free, AWS-managed).
  kms_master_key_id       = var.dlq_kms_key_arn != "" ? var.dlq_kms_key_arn : null
  sqs_managed_sse_enabled = var.dlq_kms_key_arn == "" ? true : null

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# DLQ — catches metering_worker Lambda failures (errors or throttles).
# A lost metering invocation = unbilled usage for that hour. 14-day
# retention allows ops to replay and recover revenue.
# visibility_timeout matches the metering_worker Lambda timeout (120s).
# The Lambda execution role (securebase-production-lambda-execution) carries
# a broad SQS policy; no additional inline policy is needed here.
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "metering_worker_dlq" {
  name                       = "securebase-${var.environment}-marketplace-metering-worker-dlq"
  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 120     # match metering_worker Lambda timeout

  # Use customer-managed KMS if provided; fall back to SSE-SQS (free, AWS-managed).
  kms_master_key_id       = var.metering_worker_dlq_kms_key_arn != "" ? var.metering_worker_dlq_kms_key_arn : null
  sqs_managed_sse_enabled = var.metering_worker_dlq_kms_key_arn == "" ? true : null

  tags = local.common_tags
}

resource "aws_lambda_function" "marketplace_resolve_customer" {
  s3_bucket        = local.lambda_s3["marketplace_resolve_customer"].bucket
  s3_key           = local.lambda_s3["marketplace_resolve_customer"].key
  function_name    = "securebase-${var.environment}-marketplace-resolve-customer"
  role             = var.lambda_role_arn
  handler          = "marketplace_resolve_customer.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      MARKETPLACE_PRODUCT_CODE = var.marketplace_product_code
      DB_HOST                  = var.db_host
      DB_NAME                  = "securebase"
      DB_SECRET_ARN            = var.db_secret_arn
      ONBOARDING_FUNCTION_NAME = var.onboarding_function_name
      JWT_SECRET               = var.jwt_secret_name
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "marketplace_subscription_handler" {
  s3_bucket        = local.lambda_s3["marketplace_subscription_handler"].bucket
  s3_key           = local.lambda_s3["marketplace_subscription_handler"].key
  function_name    = "securebase-${var.environment}-marketplace-subscription-handler"
  role             = var.lambda_role_arn
  handler          = "marketplace_subscription_handler.lambda_handler"
  runtime          = "python3.11"
  timeout          = 60
  memory_size      = 512

  # Route Lambda-level failures (unhandled exceptions, OOM, timeout) to DLQ.
  # SNS invocation failures (not Lambda errors) are handled by the SNS retry
  # policy; this DLQ captures what SNS retries cannot recover.
  dead_letter_config {
    target_arn = aws_sqs_queue.subscription_handler_dlq.arn
  }

  environment {
    variables = {
      MARKETPLACE_PRODUCT_CODE    = var.marketplace_product_code
      DB_HOST                     = var.db_host
      DB_NAME                     = "securebase"
      DB_SECRET_ARN               = var.db_secret_arn
      CEO_SNS_TOPIC_ARN           = var.ceo_sns_topic_arn
      BYPASS_SNS_SIGNATURE_VERIFY = "false"
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "marketplace_metering_worker" {
  s3_bucket        = local.lambda_s3["marketplace_metering_worker"].bucket
  s3_key           = local.lambda_s3["marketplace_metering_worker"].key
  function_name    = "securebase-${var.environment}-marketplace-metering-worker"
  role             = var.lambda_role_arn
  handler          = "marketplace_metering_worker.lambda_handler"
  runtime          = "python3.11"
  timeout          = 120
  memory_size      = 512

  dead_letter_config {
    target_arn = aws_sqs_queue.metering_worker_dlq.arn
  }

  environment {
    variables = {
      MARKETPLACE_PRODUCT_CODE = var.marketplace_product_code
      DB_HOST                  = var.db_host
      DB_NAME                  = "securebase"
      DB_SECRET_ARN            = var.db_secret_arn
      ALERTS_SNS_TOPIC_ARN     = var.alerts_sns_topic_arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  # The pg8000 Lambda layer (securebase-pg8000:1) is attached to this function
  # outside of Terraform (deployed via the layer packaging script). Ignore drift
  # so Terraform does not strip it on every plan.
  lifecycle {
    ignore_changes = [layers]
  }

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "subscription_handler" {
  topic_arn = aws_sns_topic.marketplace_subscriptions.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.marketplace_subscription_handler.arn
}

resource "aws_lambda_permission" "allow_sns_invoke_subscription_handler" {
  statement_id  = "AllowSNSInvokeMarketplaceSubscriptionHandler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.marketplace_subscription_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.marketplace_subscriptions.arn
}

# aws_sns_topic_subscription.aws_marketplace_to_handler intentionally omitted.
# Terraform cannot Subscribe to the AWS-owned Marketplace SNS topic
# (account 287250355862) — returns 403 by design. Register the
# subscription_handler Lambda endpoint via AMMP UI after deploy.

# Grants the AWS Marketplace subscription SNS topic permission to invoke the
# handler Lambda. count=0 when var is unset — safe to populate before listing
# publishes; the permission is inert until AMMP registers the endpoint.
resource "aws_lambda_permission" "allow_aws_marketplace_sns" {
  count         = var.aws_marketplace_sns_topic_arn != "" ? 1 : 0
  statement_id  = "AllowAWSMarketplaceSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.marketplace_subscription_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.aws_marketplace_sns_topic_arn
}

# Entitlement notification topic (entitlement-updated — tier upgrades/downgrades).
# Same registration constraint — endpoint registered via AMMP UI, not Terraform.
resource "aws_lambda_permission" "allow_aws_marketplace_entitlement_sns" {
  count         = var.aws_marketplace_entitlement_sns_topic_arn != "" ? 1 : 0
  statement_id  = "AllowAWSMarketplaceEntitlementSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.marketplace_subscription_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.aws_marketplace_entitlement_sns_topic_arn
}

resource "aws_cloudwatch_event_rule" "marketplace_metering_hourly" {
  name                = "securebase-${var.environment}-marketplace-metering-hourly"
  schedule_expression = "rate(1 hour)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "marketplace_metering_hourly" {
  rule      = "${aws_cloudwatch_event_rule.marketplace_metering_hourly.name}"
  target_id = "marketplace-metering-worker"
  arn       = aws_lambda_function.marketplace_metering_worker.arn
}

resource "aws_lambda_permission" "allow_eventbridge_invoke_metering" {
  statement_id  = "AllowEventBridgeInvokeMarketplaceMeteringWorker"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.marketplace_metering_worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.marketplace_metering_hourly.arn
}

# ---------------------------------------------------------------------------
# CloudWatch alarm — DLQ depth > 0 means at least one subscribe/unsubscribe
# event failed and landed in the dead-letter queue. Page ops immediately.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "subscription_handler_dlq_depth" {
  count               = var.alerts_sns_topic_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-marketplace-subscription-handler-dlq-depth"
  alarm_description   = "Marketplace subscription handler DLQ has messages — a subscribe/unsubscribe event failed and requires manual replay"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.subscription_handler_dlq.name
  }

  alarm_actions = [var.alerts_sns_topic_arn]
  ok_actions    = [var.alerts_sns_topic_arn]

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# CloudWatch alarm — metering worker DLQ depth.
# Any message here = a metering invocation that crashed before BatchMeterUsage
# completed. Unbilled usage. Requires immediate manual replay.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "metering_worker_dlq_depth" {
  count               = var.alerts_sns_topic_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-marketplace-metering-worker-dlq-depth"
  alarm_description   = "Marketplace metering worker DLQ has messages — an hourly metering run crashed before BatchMeterUsage completed. Unbilled usage. Replay immediately."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.metering_worker_dlq.name
  }

  alarm_actions = [var.alerts_sns_topic_arn]
  ok_actions    = [var.alerts_sns_topic_arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "metering_worker_errors" {
  count               = var.alerts_sns_topic_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-marketplace-metering-worker-errors"
  alarm_description   = "Marketplace metering worker reported errors in the last hour"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.marketplace_metering_worker.function_name
  }

  alarm_actions = [var.alerts_sns_topic_arn]
  ok_actions    = [var.alerts_sns_topic_arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "resolve_customer_errors" {
  count               = var.alerts_sns_topic_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-marketplace-resolve-customer-errors"
  alarm_description   = "Marketplace resolve customer lambda reported errors in the last 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.marketplace_resolve_customer.function_name
  }

  alarm_actions = [var.alerts_sns_topic_arn]
  ok_actions    = [var.alerts_sns_topic_arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "subscription_handler_errors" {
  count               = var.alerts_sns_topic_arn != "" ? 1 : 0
  alarm_name          = "securebase-${var.environment}-marketplace-subscription-handler-errors"
  alarm_description   = "Marketplace subscription handler lambda reported errors in the last 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.marketplace_subscription_handler.function_name
  }

  alarm_actions = [var.alerts_sns_topic_arn]
  ok_actions    = [var.alerts_sns_topic_arn]

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# VPC endpoint — AWS Marketplace Metering Service API.
#
# All three marketplace Lambdas run inside vpc_config (private subnets, no
# NAT/IGW route to the public internet). Without this interface endpoint,
# the BatchMeterUsage call (metering_worker) has no route out and hangs
# until the client-side timeout fires (see the 5s timeout added to the
# entitlement/metering clients as a stopgap — that timeout stays in place
# as defense-in-depth even with this endpoint present). There is no
# equivalent PrivateLink endpoint for the Entitlement Service — see note
# below.
#
# Security group: a dedicated SG scoped to 443 ingress from the Lambda SG
# only, rather than reusing lambda_security_group_id directly as the
# endpoint's own SG. Interface endpoints evaluate ingress rules against
# the ENI's SG, and self-referencing the Lambda SG for both call and
# receive sides is harder to audit than a narrow purpose-built SG.
# ---------------------------------------------------------------------------
resource "aws_security_group" "marketplace_vpc_endpoints" {
  count       = var.create_marketplace_vpc_endpoints ? 1 : 0
  name        = "securebase-${var.environment}-marketplace-vpc-endpoints"
  description = "Allows marketplace Lambdas to reach the AWS Marketplace Metering Service interface endpoint over HTTPS"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTPS from marketplace Lambda SG"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
  }

  egress {
    description = "Required for AWS PrivateLink endpoint ENI responses"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# aws_vpc_endpoint.marketplace_entitlement intentionally omitted.
# AWS does not publish a PrivateLink Interface endpoint for the Marketplace
# Entitlement Service in us-east-1 (verified via `aws ec2
# describe-vpc-endpoint-services` — only agreement-marketplace,
# discovery-marketplace, and metering-marketplace exist). GetEntitlements
# calls from these Lambdas have no PrivateLink path and continue to rely on
# the 5s client-side timeout described above as defense-in-depth. Resolving
# entitlement connectivity (e.g. via NAT/IGW egress) is a separate
# architectural and cost decision, out of scope here.

resource "aws_vpc_endpoint" "marketplace_metering" {
  count               = var.create_marketplace_vpc_endpoints ? 1 : 0
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.metering-marketplace"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.marketplace_vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "securebase-${var.environment}-marketplace-metering"
  })
}
