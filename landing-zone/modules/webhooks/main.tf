# Webhook System Infrastructure

# DynamoDB table for webhook registrations
resource "aws_dynamodb_table" "webhooks" {
  name           = "securebase-webhooks-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = false
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "SecureBase Webhooks"
  })
}

# DynamoDB table for webhook delivery logs
resource "aws_dynamodb_table" "webhook_deliveries" {
  name           = "securebase-webhook-deliveries-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "webhook_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  global_secondary_index {
    name            = "webhook_id-timestamp-index"
    hash_key        = "webhook_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "SecureBase Webhook Deliveries"
  })
}

# Lambda function for webhook management
resource "aws_lambda_function" "webhook_manager" {
  filename      = "${path.module}/../../functions/webhook_manager.zip"
  function_name = "securebase-webhook-manager-${var.environment}"
  role          = aws_iam_role.webhook_lambda_role.arn
  handler       = "webhook_manager.lambda_handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      WEBHOOKS_TABLE   = aws_dynamodb_table.webhooks.name
      DELIVERIES_TABLE = aws_dynamodb_table.webhook_deliveries.name
      WEBHOOK_SECRET_KEY = var.webhook_secret_key
    }
  }

  vpc_config {
    subnet_ids         = var.lambda_subnet_ids
    security_group_ids = [aws_security_group.webhook_lambda_sg.id]
  }

  tags = merge(var.tags, {
    Name = "SecureBase Webhook Manager"
  })
}

# IAM role for webhook Lambda
resource "aws_iam_role" "webhook_lambda_role" {
  name = "securebase-webhook-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM policy for webhook Lambda
resource "aws_iam_role_policy" "webhook_lambda_policy" {
  name = "securebase-webhook-lambda-policy-${var.environment}"
  role = aws_iam_role.webhook_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.webhooks.arn,
          aws_dynamodb_table.webhook_deliveries.arn,
          "${aws_dynamodb_table.webhook_deliveries.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security group for webhook Lambda
resource "aws_security_group" "webhook_lambda_sg" {
  name        = "securebase-webhook-lambda-sg-${var.environment}"
  description = "Security group for webhook Lambda function"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for webhook delivery"
  }

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound (redirect to HTTPS)"
  }

  tags = merge(var.tags, {
    Name = "SecureBase Webhook Lambda SG"
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "webhook_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.webhook_manager.function_name}"
  retention_in_days = 30

  tags = var.tags
}

# API Gateway integration
resource "aws_api_gateway_resource" "webhooks" {
  rest_api_id = var.api_gateway_id
  parent_id   = var.api_gateway_root_resource_id
  path_part   = "webhooks"
}

resource "aws_api_gateway_method" "webhooks_get" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.webhooks.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = var.api_gateway_authorizer_id
}

resource "aws_api_gateway_method" "webhooks_post" {
  rest_api_id   = var.api_gateway_id
  resource_id   = aws_api_gateway_resource.webhooks.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = var.api_gateway_authorizer_id
}

resource "aws_api_gateway_integration" "webhooks_get" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.webhooks.id
  http_method = aws_api_gateway_method.webhooks_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.webhook_manager.invoke_arn
}

resource "aws_api_gateway_integration" "webhooks_post" {
  rest_api_id = var.api_gateway_id
  resource_id = aws_api_gateway_resource.webhooks.id
  http_method = aws_api_gateway_method.webhooks_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.webhook_manager.invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_webhook" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_manager.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Outputs
output "webhooks_table_name" {
  value = aws_dynamodb_table.webhooks.name
}

output "webhook_deliveries_table_name" {
  value = aws_dynamodb_table.webhook_deliveries.name
}

output "webhook_manager_function_arn" {
  value = aws_lambda_function.webhook_manager.arn
}
