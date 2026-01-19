# Default configuration recorder (uses recorder name 'default')
resource "aws_config_configuration_recorder" "this" {
  name             = "default"
  role_arn         = aws_iam_role.config_role.arn
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
    resource_types               = []
  }
}

# Start the recorder
resource "aws_config_configuration_recorder_status" "this" {
  name              = aws_config_configuration_recorder.this.name
  is_enabled        = true
  depends_on        = [aws_config_delivery_channel.this, aws_config_configuration_recorder.this]
}

# Delivery channel for Config to send configuration data
resource "aws_config_delivery_channel" "this" {
  name           = "default"
  s3_bucket_name = var.central_log_bucket_name
  s3_key_prefix  = "AWSLogs"
  depends_on     = [aws_config_configuration_recorder.this]
}

# Wait for bucket policy before starting recorder
resource "time_sleep" "wait_for_bucket_policy" {
  create_duration = "10s"
  depends_on      = [aws_config_delivery_channel.this]
}

resource "aws_config_configuration_aggregator" "org" {
  name = "org-aggregator"

  organization_aggregation_source {
    all_regions = true
    role_arn   = aws_iam_role.config_aggregator.arn
  }
}

