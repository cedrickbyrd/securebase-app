# modules/securebase/lambda.tf

resource "aws_lambda_function" "stripe_handler" {
  function_name = "securebase-stripe-handler-${var.environment}"
  filename      = var.lambda_packages["stripe_handler"] # Uses the map you defined
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec.arn

  environment {
    variables = {
      # Mapping the new variables to actual ENV vars
      STRIPE_SECRET_ARN = aws_secretsmanager_secret.stripe_keys.arn
      STRIPE_PUBLIC_KEY = var.stripe_public_key
      APP_ENVIRONMENT   = var.environment
      AWS_TARGET_REGION = var.target_region
      NETLIFY_TOKEN     = var.netlify_api_token
    }
  }
}
