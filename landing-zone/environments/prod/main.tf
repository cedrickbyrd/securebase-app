provider "aws" {
  region = var.target_region

  default_tags {
    tags = var.tags
  }
}

data "aws_sns_topic" "alerts" {
  name = var.alert_topic_name
}

module "phase6_tracing" {
  source = "../../modules/phase6-tracing"

  environment = var.environment
  aws_region  = var.target_region

  api_gateway_name           = var.api_gateway_name
  api_gateway_stage          = var.api_gateway_stage
  api_gateway_log_group_name = var.api_gateway_log_group_name
  sns_topic_arn              = data.aws_sns_topic.alerts.arn

  lambda_function_names       = var.lambda_function_names
  lambda_execution_role_names = var.lambda_execution_role_names
  xray_tenant_filters         = var.xray_tenant_filters

  tags = var.tags
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {}
}
