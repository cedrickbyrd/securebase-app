resource "aws_ssm_parameter" "maintenance_mode" {
  name        = "/securebase/${var.environment}/maintenance_mode"
  type        = "String"
  value       = "false"
  overwrite   = true
  description = "Alert suppression flag for planned maintenance windows"

  lifecycle {
    ignore_changes = [value]
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "maintenance_window_start" {
  count = var.maintenance_window_enabled ? 1 : 0

  name                = "securebase-${var.environment}-maintenance-window-start"
  description         = "Enable maintenance mode for alert suppression"
  schedule_expression = var.maintenance_window_schedule
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "maintenance_window_start" {
  count = var.maintenance_window_enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.maintenance_window_start[0].name
  target_id = "maintenance-window-start"
  arn       = aws_lambda_function.alert_router.arn
  input = jsonencode({
    maintenance_mode = "true"
  })
}

resource "aws_cloudwatch_event_rule" "maintenance_window_end" {
  count = var.maintenance_window_enabled ? 1 : 0

  name                = "securebase-${var.environment}-maintenance-window-end"
  description         = "Disable maintenance mode and resume alert forwarding"
  schedule_expression = var.maintenance_window_end_schedule
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "maintenance_window_end" {
  count = var.maintenance_window_enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.maintenance_window_end[0].name
  target_id = "maintenance-window-end"
  arn       = aws_lambda_function.alert_router.arn
  input = jsonencode({
    maintenance_mode = "false"
  })
}

resource "aws_lambda_permission" "maintenance_window_start_eventbridge" {
  count = var.maintenance_window_enabled ? 1 : 0

  statement_id  = "AllowMaintenanceWindowStartInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_router.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.maintenance_window_start[0].arn
}

resource "aws_lambda_permission" "maintenance_window_end_eventbridge" {
  count = var.maintenance_window_enabled ? 1 : 0

  statement_id  = "AllowMaintenanceWindowEndInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_router.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.maintenance_window_end[0].arn
}
