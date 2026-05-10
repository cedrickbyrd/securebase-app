# =============================================================================
# Phase 5.4 – Multi-Region DR
# Secondary Region Lambda + API Gateway Deployment
# =============================================================================
# Deploys health-check Lambda and REST API Gateway in us-west-2.
# The subnet group and security group are declared in aurora-global.tf
# (guarded by local.create_secondary_aurora) and referenced here.
# =============================================================================

# =============================================================================
# IAM Role for Secondary Region Lambdas
# =============================================================================

resource "aws_iam_role" "secondary_lambda" {
  provider = aws.secondary
  name     = "securebase-${var.environment}-secondary-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = local.dr_tags
}

resource "aws_iam_role_policy_attachment" "secondary_lambda_basic" {
  provider   = aws.secondary
  role       = aws_iam_role.secondary_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "secondary_lambda_vpc" {
  provider   = aws.secondary
  role       = aws_iam_role.secondary_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# =============================================================================
# Secondary Region REST API Gateway + Health Lambda
# =============================================================================

resource "aws_api_gateway_rest_api" "secondary" {
  provider = aws.secondary

  name        = "securebase-${var.environment}-secondary"
  description = "SecureBase ${var.environment} API — secondary region (us-west-2) standby"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.dr_tags
}

resource "aws_api_gateway_resource" "secondary_health" {
  provider    = aws.secondary
  rest_api_id = aws_api_gateway_rest_api.secondary.id
  parent_id   = aws_api_gateway_rest_api.secondary.root_resource_id
  path_part   = "health"
}

resource "aws_api_gateway_method" "secondary_health_get" {
  provider      = aws.secondary
  rest_api_id   = aws_api_gateway_rest_api.secondary.id
  resource_id   = aws_api_gateway_resource.secondary_health.id
  http_method   = "GET"
  authorization = "NONE"
}

data "archive_file" "health_check_secondary" {
  type        = "zip"
  output_path = "${path.module}/lambda/health_check_secondary.zip"

  source {
    content  = <<-PYTHON
import json
from datetime import datetime, timezone
import os

def lambda_handler(event, context):
    region = os.environ.get('AWS_REGION', 'us-west-2')
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Cache-Control': 'no-cache'},
        'body': json.dumps({
            'status': 'healthy',
            'region': region,
            'role': 'secondary',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }),
    }
PYTHON
    filename = "health_check_secondary.py"
  }
}

resource "aws_lambda_function" "health_check_secondary" {
  provider         = aws.secondary
  filename         = data.archive_file.health_check_secondary.output_path
  source_code_hash = data.archive_file.health_check_secondary.output_base64sha256
  function_name    = "securebase-${var.environment}-health-check-secondary"
  handler          = "health_check_secondary.lambda_handler"
  runtime          = "python3.11"
  timeout          = 10
  memory_size      = 128
  role             = aws_iam_role.secondary_lambda.arn
  tags             = local.dr_tags
}

resource "aws_api_gateway_integration" "secondary_health" {
  provider                = aws.secondary
  rest_api_id             = aws_api_gateway_rest_api.secondary.id
  resource_id             = aws_api_gateway_resource.secondary_health.id
  http_method             = aws_api_gateway_method.secondary_health_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.health_check_secondary.invoke_arn
}

resource "aws_lambda_permission" "secondary_api_health" {
  provider      = aws.secondary
  statement_id  = "AllowAPIGatewayInvokeHealth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health_check_secondary.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.secondary.execution_arn}/*"
}

resource "aws_api_gateway_deployment" "secondary" {
  provider    = aws.secondary
  rest_api_id = aws_api_gateway_rest_api.secondary.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.secondary_health.id,
      aws_api_gateway_method.secondary_health_get.id,
      aws_api_gateway_integration.secondary_health.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_api_gateway_integration.secondary_health]
}

resource "aws_api_gateway_stage" "secondary" {
  provider      = aws.secondary
  deployment_id = aws_api_gateway_deployment.secondary.id
  rest_api_id   = aws_api_gateway_rest_api.secondary.id
  stage_name    = "prod"

  xray_tracing_enabled = true
  tags                 = local.dr_tags
}
