# DynamoDB Auto-Scaling and Performance Configuration
# Phase 3B Optimization

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================
# DynamoDB Tables with Auto-Scaling
# ============================================

# Support Tickets Table
resource "aws_dynamodb_table" "support_tickets" {
  name           = "${var.project_name}-${var.environment}-support-tickets"
  billing_mode   = "PROVISIONED"
  read_capacity  = 25
  write_capacity = 25
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
    name = "status"
    type = "S"
  }

  attribute {
    name = "priority"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI for filtering by status
  global_secondary_index {
    name               = "status-created-index"
    hash_key           = "status"
    range_key          = "created_at"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "ALL"
  }

  # GSI for filtering by priority
  global_secondary_index {
    name               = "priority-created-index"
    hash_key           = "priority"
    range_key          = "created_at"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "ALL"
  }

  # TTL for auto-cleanup
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Enable Point-in-Time Recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Phase       = "3b"
    Component   = "support-tickets"
  }
}

# Auto-scaling for Support Tickets table
resource "aws_appautoscaling_target" "support_tickets_read" {
  max_capacity       = 100
  min_capacity       = 25
  resource_id        = "table/${aws_dynamodb_table.support_tickets.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "support_tickets_read_policy" {
  name               = "${var.project_name}-${var.environment}-support-tickets-read-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.support_tickets_read.resource_id
  scalable_dimension = aws_appautoscaling_target.support_tickets_read.scalable_dimension
  service_namespace  = aws_appautoscaling_target.support_tickets_read.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value       = 70.0  # Scale when utilization hits 70%
    scale_in_cooldown  = 60    # Wait 60s before scaling down
    scale_out_cooldown = 30    # Wait 30s before scaling up again
  }
}

resource "aws_appautoscaling_target" "support_tickets_write" {
  max_capacity       = 100
  min_capacity       = 25
  resource_id        = "table/${aws_dynamodb_table.support_tickets.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "support_tickets_write_policy" {
  name               = "${var.project_name}-${var.environment}-support-tickets-write-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.support_tickets_write.resource_id
  scalable_dimension = aws_appautoscaling_target.support_tickets_write.scalable_dimension
  service_namespace  = aws_appautoscaling_target.support_tickets_write.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 60
    scale_out_cooldown = 30
  }
}

# Auto-scaling for GSI indexes
resource "aws_appautoscaling_target" "support_tickets_status_index_read" {
  max_capacity       = 50
  min_capacity       = 10
  resource_id        = "table/${aws_dynamodb_table.support_tickets.name}/index/status-created-index"
  scalable_dimension = "dynamodb:index:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "support_tickets_status_index_read_policy" {
  name               = "${var.project_name}-${var.environment}-support-tickets-status-index-read-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.support_tickets_status_index_read.resource_id
  scalable_dimension = aws_appautoscaling_target.support_tickets_status_index_read.scalable_dimension
  service_namespace  = aws_appautoscaling_target.support_tickets_status_index_read.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = 70.0
  }
}

# ============================================
# CloudWatch Alarms for DynamoDB
# ============================================

resource "aws_cloudwatch_metric_alarm" "support_tickets_throttles" {
  alarm_name          = "${var.project_name}-${var.environment}-support-tickets-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Alert when support tickets table experiences throttling"

  dimensions = {
    TableName = aws_dynamodb_table.support_tickets.name
  }

  tags = {
    Environment = var.environment
    Component   = "support-tickets"
  }
}

# ============================================
# Outputs
# ============================================

output "support_tickets_table_name" {
  description = "Name of the support tickets DynamoDB table"
  value       = aws_dynamodb_table.support_tickets.name
}
