resource "aws_config_configuration_recorder" "org" {
  role_arn = aws_iam_role.config_role.arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "org" {
  #s3_bucket_name = aws_s3_bucket.central_logs.bucket
  s3_bucket_name = var.central_log_bucket_name
}

resource "aws_config_configuration_aggregator" "org" {
  name = "org-aggregator"

  organization_aggregation_source {
    all_regions = true
    role_arn   = aws_iam_role.config_aggregator.arn
  }
}

