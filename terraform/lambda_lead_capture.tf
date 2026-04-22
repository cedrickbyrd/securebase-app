# Lead capture Lambda function
locals {
  lead_function_name = "securebase-lead-capture"
  lead_zip          = "${path.module}/../phase2-backend/functions/submit_lead.zip"
}

resource "aws_lambda_function" "lead_capture" {
  function_name    = local.lead_function_name
  filename         = local.lead_zip
  source_code_hash = filebase64sha256(local.lead_zip)
  handler          = "submit_lead.lambda_handler"
  runtime          = "python3.12"
  role             = aws_iam_role.lead_capture_lambda.arn
  timeout          = 10

  environment {
    variables = {
      ALLOWED_ORIGIN                = "https://demo.securebase.tximhotep.com"
      ENVIRONMENT                   = "production"
      LEAD_NOTIFICATION_WEBHOOK_URL = var.lead_webhook_url
    }
  }

  tags = {
    Project = "SecureBase"
    Purpose = "LeadCapture"
  }
}

resource "aws_iam_role" "lead_capture_lambda" {
  name = "${local.lead_function_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lead_capture_basic" {
  role       = aws_iam_role.lead_capture_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# API Gateway integration
resource "aws_api_gateway_resource" "lead_capture" {
  rest_api_id = var.rest_api_id
  parent_id   = var.root_resource_id
  path_part   = "submit-lead"
}

resource "aws_api_gateway_method" "lead_capture_post" {
  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.lead_capture.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lead_capture_post" {
  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.lead_capture.id
  http_method             = aws_api_gateway_method.lead_capture_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.lead_capture.arn}/invocations"
}

resource "aws_lambda_permission" "apigw_lead_capture" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lead_capture.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.aws_region}:*:${var.rest_api_id}/*/POST/submit-lead"
}
