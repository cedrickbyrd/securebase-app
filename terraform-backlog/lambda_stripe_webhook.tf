# Stripe webhook handler Lambda + API Gateway route
# Stores secrets in SSM (consistent with all other SecureBase Lambdas)
#
# SSM parameters to create before terraform apply:
#   /securebase/stripe/secret_key      → Stripe secret key (server-side API)
#   /securebase/stripe/webhook_secret   → Stripe Dashboard → Webhooks → Signing secret

locals {
  webhook_function_name = var.stripe_webhook_lambda_name
  webhook_zip           = "${path.module}/../lambda/stripe_webhook.zip"
}

data "aws_ssm_parameter" "stripe_secret_key" {
  name            = var.stripe_secret_key_ssm_parameter_name
  with_decryption = true
}

data "aws_ssm_parameter" "stripe_webhook_secret" {
  name            = var.stripe_webhook_secret_ssm_parameter_name
  with_decryption = true
}

resource "aws_lambda_function" "stripe_webhook" {
  function_name    = local.webhook_function_name
  filename         = local.webhook_zip
  source_code_hash = filebase64sha256(local.webhook_zip)
  handler          = "stripe_webhook_handler.handler"
  runtime          = "python3.12"
  role             = aws_iam_role.stripe_webhook_lambda.arn
  timeout          = 30

  environment {
    variables = {
      # Do not log these env vars in Lambda output.
      STRIPE_SECRET_KEY     = data.aws_ssm_parameter.stripe_secret_key.value
      STRIPE_WEBHOOK_SECRET = data.aws_ssm_parameter.stripe_webhook_secret.value
    }
  }

  tags = {
    Project = "SecureBase"
    Purpose = "StripeWebhook"
  }
}

resource "aws_iam_role" "stripe_webhook_lambda" {
  name = "${local.webhook_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "stripe_webhook_basic" {
  role       = aws_iam_role.stripe_webhook_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "stripe_webhook_ssm" {
  name = "${local.webhook_function_name}-ssm"
  role = aws_iam_role.stripe_webhook_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["ssm:GetParameter"]
      Resource = [
        "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.stripe_secret_key_ssm_parameter_name}",
        "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.stripe_webhook_secret_ssm_parameter_name}",
      ]
    }]
  })
}

resource "aws_api_gateway_resource" "stripe_webhook" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "stripe_webhook_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.stripe_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "stripe_webhook_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.stripe_webhook.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "stripe_webhook_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.stripe_webhook.id
  http_method             = aws_api_gateway_method.stripe_webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.stripe_webhook.arn}/invocations"
}

resource "aws_api_gateway_integration" "stripe_webhook_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.stripe_webhook.id
  http_method       = aws_api_gateway_method.stripe_webhook_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "stripe_webhook_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.stripe_webhook.id
  http_method = aws_api_gateway_method.stripe_webhook_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "stripe_webhook_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.stripe_webhook.id
  http_method = aws_api_gateway_method.stripe_webhook_options.http_method
  status_code = aws_api_gateway_method_response.stripe_webhook_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,stripe-signature'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://demo.securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.stripe_webhook_options]
}

resource "aws_lambda_permission" "apigw_stripe_webhook" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stripe_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  # Keep api_stage_name aligned with the deployed API Gateway stage.
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/${var.api_stage_name}/POST/webhook"
}
