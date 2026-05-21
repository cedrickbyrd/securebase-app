resource "aws_api_gateway_rest_api_policy" "staging_allow_invoke" {
  rest_api_id = var.rest_api_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/${var.api_stage_name}/*/*"
      }
    ]
  })
}
