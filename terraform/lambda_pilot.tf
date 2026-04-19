# Compliance Jumpstart Pilot Lambdas + API Gateway routes
#
# Provisions pilot_availability and validate_session Lambda functions,
# their least-privilege IAM roles, and GET/OPTIONS API Gateway wiring.
#
# Seed the table before first deploy:
#   aws dynamodb put-item \
#     --table-name securebase-pilot-slots \
#     --item '{"sku":{"S":"pilot_compliance"},"slots_total":{"N":"5"},"slots_claimed":{"N":"0"}}'

locals {
  pilot_availability_function_name = "securebase-pilot-availability"
  pilot_availability_zip           = "${path.module}/../lambda/pilot_availability.zip"

  validate_session_function_name = "securebase-validate-session"
  validate_session_zip           = "${path.module}/../lambda/validate_session.zip"
}

# ── pilot_availability Lambda ─────────────────────────────────────────────────

resource "aws_lambda_function" "pilot_availability" {
  function_name    = local.pilot_availability_function_name
  filename         = local.pilot_availability_zip
  source_code_hash = filebase64sha256(local.pilot_availability_zip)
  handler          = "pilot_availability.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.pilot_availability_lambda.arn
  timeout          = 10

  environment {
    variables = {
      PILOT_SLOTS_TABLE = "securebase-pilot-slots"
      CORS_ORIGIN       = "https://securebase.tximhotep.com"
    }
  }

  tags = {
    Project             = "SecureBase"
    Purpose             = "PilotAvailability"
    Phase               = "5.3"
    ComplianceFramework = "SOC2"
  }
}

resource "aws_iam_role" "pilot_availability_lambda" {
  name = "${local.pilot_availability_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "pilot_availability_basic" {
  role       = aws_iam_role.pilot_availability_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "pilot_availability_dynamodb" {
  name = "${local.pilot_availability_function_name}-dynamodb"
  role = aws_iam_role.pilot_availability_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"]
      Resource = aws_dynamodb_table.pilot_slots.arn
    }]
  })
}

# ── validate_session Lambda ───────────────────────────────────────────────────

resource "aws_lambda_function" "validate_session" {
  function_name    = local.validate_session_function_name
  filename         = local.validate_session_zip
  source_code_hash = filebase64sha256(local.validate_session_zip)
  handler          = "validate_session.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.validate_session_lambda.arn
  timeout          = 15

  environment {
    variables = {
      CORS_ORIGIN = "https://securebase.tximhotep.com"
    }
  }

  tags = {
    Project             = "SecureBase"
    Purpose             = "ValidateSession"
    Phase               = "5.3"
    ComplianceFramework = "SOC2"
  }
}

resource "aws_iam_role" "validate_session_lambda" {
  name = "${local.validate_session_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "validate_session_basic" {
  role       = aws_iam_role.validate_session_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "validate_session_ssm" {
  name = "${local.validate_session_function_name}-ssm"
  role = aws_iam_role.validate_session_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter"]
      Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/securebase/stripe/secret_key"
    }]
  })
}

# ── API Gateway: GET /pilot/availability ─────────────────────────────────────

resource "aws_api_gateway_resource" "pilot" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "pilot"
}

resource "aws_api_gateway_resource" "pilot_availability" {
  rest_api_id = var.rest_api_id
  parent_id   = aws_api_gateway_resource.pilot.id
  path_part   = "availability"
}

resource "aws_api_gateway_method" "pilot_availability_get" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.pilot_availability.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "pilot_availability_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.pilot_availability.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "pilot_availability_get" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.pilot_availability.id
  http_method             = aws_api_gateway_method.pilot_availability_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.pilot_availability.arn}/invocations"
}

resource "aws_api_gateway_integration" "pilot_availability_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.pilot_availability.id
  http_method       = aws_api_gateway_method.pilot_availability_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "pilot_availability_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.pilot_availability.id
  http_method = aws_api_gateway_method.pilot_availability_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "pilot_availability_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.pilot_availability.id
  http_method = aws_api_gateway_method.pilot_availability_options.http_method
  status_code = aws_api_gateway_method_response.pilot_availability_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.pilot_availability_options]
}

resource "aws_lambda_permission" "apigw_pilot_availability" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pilot_availability.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/GET/pilot/availability"
}

# ── API Gateway: GET /validate-session ───────────────────────────────────────

resource "aws_api_gateway_resource" "validate_session" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "validate-session"
}

resource "aws_api_gateway_method" "validate_session_get" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.validate_session.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "validate_session_options" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.validate_session.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "validate_session_get" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.validate_session.id
  http_method             = aws_api_gateway_method.validate_session_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.validate_session.arn}/invocations"
}

resource "aws_api_gateway_integration" "validate_session_options" {
  rest_api_id       = var.rest_api_id
  resource_id       = aws_api_gateway_resource.validate_session.id
  http_method       = aws_api_gateway_method.validate_session_options.http_method
  type              = "MOCK"
  request_templates = { "application/json" = "{\"statusCode\": 200}" }
}

resource "aws_api_gateway_method_response" "validate_session_options_200" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.validate_session.id
  http_method = aws_api_gateway_method.validate_session_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "validate_session_options" {
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.validate_session.id
  http_method = aws_api_gateway_method.validate_session_options.http_method
  status_code = aws_api_gateway_method_response.validate_session_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://securebase.tximhotep.com'"
  }
  depends_on = [aws_api_gateway_integration.validate_session_options]
}

resource "aws_lambda_permission" "apigw_validate_session" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.validate_session.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*/GET/validate-session"
}
