# RBAC Module - User Management Infrastructure
# Phase 4 - Team Collaboration & Multi-User Access

# DynamoDB Table for User Sessions
resource "aws_dynamodb_table" "user_sessions" {
  name           = "securebase-${var.environment}-user-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "session_id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "expires_at"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "user_id"
    range_key       = "expires_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-user-sessions"
    Component   = "RBAC"
    Phase       = "4"
  })
}

# DynamoDB Table for User Invites
resource "aws_dynamodb_table" "user_invites" {
  name           = "securebase-${var.environment}-user-invites"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "invite_id"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "invite_id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    range_key       = "status"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-user-invites"
    Component   = "RBAC"
    Phase       = "4"
  })
}

# DynamoDB Table for Activity Feed
resource "aws_dynamodb_table" "activity_feed" {
  name           = "securebase-${var.environment}-activity-feed"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "customer_id"
  range_key      = "timestamp"

  attribute {
    name = "customer_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "action"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "customer_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ActionIndex"
    hash_key        = "customer_id"
    range_key       = "action"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name        = "securebase-${var.environment}-activity-feed"
    Component   = "RBAC"
    Phase       = "4"
  })
}

# Lambda Function for User Management
resource "aws_lambda_function" "user_management" {
  filename         = "${path.root}/../phase2-backend/deploy/user_management.zip"
  function_name    = "securebase-${var.environment}-user-management"
  role            = aws_iam_role.user_management.arn
  handler         = "user_management.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 512

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/user_management.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/user_management.zip") : null

  environment {
    variables = {
      SESSIONS_TABLE       = aws_dynamodb_table.user_sessions.name
      INVITES_TABLE        = aws_dynamodb_table.user_invites.name
      ACTIVITY_FEED_TABLE  = aws_dynamodb_table.activity_feed.name
      DATABASE_ENDPOINT    = var.database_endpoint
      DATABASE_NAME        = var.database_name
      DATABASE_SECRET_ARN  = var.database_secret_arn
      ENVIRONMENT          = var.environment
      LOG_LEVEL            = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-user-management"
    Component = "RBAC"
    Phase     = "4"
  })
}

# Lambda Function for Session Management
resource "aws_lambda_function" "session_management" {
  filename         = "${path.root}/../phase2-backend/deploy/session_management.zip"
  function_name    = "securebase-${var.environment}-session-management"
  role            = aws_iam_role.session_management.arn
  handler         = "session_management.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/session_management.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/session_management.zip") : null

  environment {
    variables = {
      SESSIONS_TABLE      = aws_dynamodb_table.user_sessions.name
      ACTIVITY_FEED_TABLE = aws_dynamodb_table.activity_feed.name
      DATABASE_ENDPOINT   = var.database_endpoint
      DATABASE_NAME       = var.database_name
      DATABASE_SECRET_ARN = var.database_secret_arn
      JWT_SECRET_ARN      = var.jwt_secret_arn
      ENVIRONMENT         = var.environment
      LOG_LEVEL           = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-session-management"
    Component = "RBAC"
    Phase     = "4"
  })
}

# Lambda Function for Permission Management
resource "aws_lambda_function" "permission_management" {
  filename         = "${path.root}/../phase2-backend/deploy/permission_management.zip"
  function_name    = "securebase-${var.environment}-permission-management"
  role            = aws_iam_role.permission_management.arn
  handler         = "permission_management.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  source_code_hash = fileexists("${path.root}/../phase2-backend/deploy/permission_management.zip") ? filebase64sha256("${path.root}/../phase2-backend/deploy/permission_management.zip") : null

  environment {
    variables = {
      ACTIVITY_FEED_TABLE = aws_dynamodb_table.activity_feed.name
      DATABASE_ENDPOINT   = var.database_endpoint
      DATABASE_NAME       = var.database_name
      DATABASE_SECRET_ARN = var.database_secret_arn
      ENVIRONMENT         = var.environment
      LOG_LEVEL           = "INFO"
    }
  }

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-permission-management"
    Component = "RBAC"
    Phase     = "4"
  })
}

# IAM Role for User Management Lambda
resource "aws_iam_role" "user_management" {
  name = "securebase-${var.environment}-user-management-role"

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

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-user-management-role"
    Component = "RBAC"
  })
}

# IAM Role for Session Management Lambda
resource "aws_iam_role" "session_management" {
  name = "securebase-${var.environment}-session-management-role"

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

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-session-management-role"
    Component = "RBAC"
  })
}

# IAM Role for Permission Management Lambda
resource "aws_iam_role" "permission_management" {
  name = "securebase-${var.environment}-permission-management-role"

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

  tags = merge(var.tags, {
    Name      = "securebase-${var.environment}-permission-management-role"
    Component = "RBAC"
  })
}

# Attach basic Lambda execution policy to all roles
resource "aws_iam_role_policy_attachment" "user_management_basic" {
  role       = aws_iam_role.user_management.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "session_management_basic" {
  role       = aws_iam_role.session_management.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "permission_management_basic" {
  role       = aws_iam_role.permission_management.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for User Management Lambda
resource "aws_iam_role_policy" "user_management_permissions" {
  name = "user-management-permissions"
  role = aws_iam_role.user_management.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.user_sessions.arn,
          aws_dynamodb_table.user_invites.arn,
          aws_dynamodb_table.activity_feed.arn,
          "${aws_dynamodb_table.user_sessions.arn}/index/*",
          "${aws_dynamodb_table.user_invites.arn}/index/*",
          "${aws_dynamodb_table.activity_feed.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.database_secret_arn,
          var.jwt_secret_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Custom policy for Session Management Lambda
resource "aws_iam_role_policy" "session_management_permissions" {
  name = "session-management-permissions"
  role = aws_iam_role.session_management.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.user_sessions.arn,
          aws_dynamodb_table.activity_feed.arn,
          "${aws_dynamodb_table.user_sessions.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.database_secret_arn,
          var.jwt_secret_arn
        ]
      }
    ]
  })
}

# Custom policy for Permission Management Lambda
resource "aws_iam_role_policy" "permission_management_permissions" {
  name = "permission-management-permissions"
  role = aws_iam_role.permission_management.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.activity_feed.arn,
          "${aws_dynamodb_table.activity_feed.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.database_secret_arn
      }
    ]
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "user_management" {
  name              = "/aws/lambda/securebase-${var.environment}-user-management"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "user-management-logs"
    Component = "RBAC"
  })
}

resource "aws_cloudwatch_log_group" "session_management" {
  name              = "/aws/lambda/securebase-${var.environment}-session-management"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "session-management-logs"
    Component = "RBAC"
  })
}

resource "aws_cloudwatch_log_group" "permission_management" {
  name              = "/aws/lambda/securebase-${var.environment}-permission-management"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name      = "permission-management-logs"
    Component = "RBAC"
  })
}
