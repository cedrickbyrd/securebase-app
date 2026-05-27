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

resource "aws_sns_topic_policy" "marketplace_subscriptions" {
  arn = aws_sns_topic.marketplace_subscriptions.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAWSMarketplacePublish"
        Effect    = "Allow"
        Principal = { Service = "aws-marketplace.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.marketplace_subscriptions.arn
      }
    ]
  })
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

  environment {
    variables = {
      MARKETPLACE_PRODUCT_CODE = var.marketplace_product_code
      DB_HOST                  = var.db_host
      DB_NAME                  = "securebase"
      DB_SECRET_ARN            = var.db_secret_arn
      CEO_SNS_TOPIC_ARN        = var.ceo_sns_topic_arn
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

resource "aws_cloudwatch_event_rule" "marketplace_metering_hourly" {
  name                = "securebase-${var.environment}-marketplace-metering-hourly"
  schedule_expression = "rate(1 hour)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "marketplace_metering_hourly" {
  rule      = aws_cloudwatch_event_rule.marketplace_metering_hourly.name
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
