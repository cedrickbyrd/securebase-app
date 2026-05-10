# ── Phase 5.4 Health Endpoint (us-west-2) ────────────────────────────────────
# Deploys a lightweight /health Lambda + HTTP API Gateway (APIGWv2) in the
# secondary region for Route53 health checks to probe.

# ── IAM role for secondary health Lambda ─────────────────────────────────────

resource "aws_iam_role" "health_lambda_secondary" {
  provider = aws.secondary

  name               = "securebase-${var.environment}-health-lambda-secondary"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = local.dr_tags
}

resource "aws_iam_role_policy_attachment" "health_lambda_secondary" {
  provider = aws.secondary

  role       = aws_iam_role.health_lambda_secondary.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ── Inline Lambda package (Node.js 20) ───────────────────────────────────────

data "archive_file" "health_endpoint_secondary" {
  type        = "zip"
  output_path = "${path.module}/lambda/health_endpoint_secondary.zip"

  source {
    filename = "index.js"
    content  = <<-JS
      exports.handler = async () => ({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'healthy',
          region: process.env.AWS_REGION,
          environment: process.env.ENVIRONMENT,
          timestamp: new Date().toISOString(),
          role: 'secondary'
        })
      });
    JS
  }
}

# ── Lambda function ───────────────────────────────────────────────────────────
# Resource address uses "health_secondary" to avoid conflict with the
# "health_check_secondary" resource already declared in lambda-replication.tf.

resource "aws_lambda_function" "health_secondary" {
  provider = aws.secondary

  function_name    = "securebase-${var.environment}-health-secondary"
  role             = aws_iam_role.health_lambda_secondary.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.health_endpoint_secondary.output_path
  source_code_hash = data.archive_file.health_endpoint_secondary.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = local.dr_tags

  depends_on = [aws_iam_role_policy_attachment.health_lambda_secondary]
}

# ── HTTP API Gateway (v2) ─────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "health_secondary" {
  provider = aws.secondary

  name          = "securebase-${var.environment}-health-secondary"
  protocol_type = "HTTP"

  tags = local.dr_tags
}

resource "aws_apigatewayv2_integration" "health_secondary" {
  provider = aws.secondary

  api_id             = aws_apigatewayv2_api.health_secondary.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.health_secondary.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "health_secondary" {
  provider = aws.secondary

  api_id    = aws_apigatewayv2_api.health_secondary.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.health_secondary.id}"
}

resource "aws_apigatewayv2_stage" "health_secondary" {
  provider = aws.secondary

  api_id      = aws_apigatewayv2_api.health_secondary.id
  name        = "$default"
  auto_deploy = true

  tags = local.dr_tags
}

# ── Lambda invocation permission for API Gateway ──────────────────────────────

resource "aws_lambda_permission" "health_secondary_apigw" {
  provider = aws.secondary

  statement_id  = "AllowHealthEndpointAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health_secondary.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.health_secondary.execution_arn}/*/*"
}
