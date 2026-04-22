# --- Organizations ---
import {
  to = module.securebase.aws_organizations_organization.this
  id = "o-hb7xe727j6"
}

# --- Core IAM Roles ---
# NOTE: The live role name uses underscores — "securebase_lambda_exec_role" — not hyphens.
# The module declaration in landing-zone/modules/lambda-functions/main.tf has been updated
# to match this name. DO NOT change either name without a live rename + terraform state mv.
import {
  to = module.securebase.module.lambda_functions.aws_iam_role.lambda_execution
  id = "securebase_lambda_exec_role"
}

import {
  to = module.securebase.module.identity.aws_iam_role.aws_config_role
  id = "AWSConfigRole"
}

# --- SSO Permission Sets (format: instance_arn,permission_set_arn) ---
#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.admin
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72235b13cf3c097f"
#}

#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.platform
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-7223eb9cc84c17a6"
#}

#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.auditor
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72234a6b73040d95"
#}

# ── Analytics module state reconciliation (2026-04-22 drift fix) ──────────
# Resources below were created under module.analytics (top-level) but the
# canonical path is module.securebase.module.analytics. Import blocks bring
# them under the correct path. Run: terraform plan -generate-config-out=generated.tf
# to preview before apply.

import {
  to = module.analytics.aws_dynamodb_table.reports
  id = "securebase-dev-reports"
}

import {
  to = module.analytics.aws_dynamodb_table.report_schedules
  id = "securebase-dev-report-schedules"
}

import {
  to = module.analytics.aws_dynamodb_table.report_cache
  id = "securebase-dev-report-cache"
}

import {
  to = module.analytics.aws_dynamodb_table.metrics
  id = "securebase-dev-metrics"
}

import {
  to = module.analytics.aws_sns_topic.analytics_alerts
  id = "arn:aws:sns:us-east-1:731184206915:securebase-dev-analytics-alerts"
}

import {
  to = module.analytics.aws_cloudwatch_event_rule.analytics_aggregator_schedule
  id = "securebase-dev-analytics-aggregator-schedule"
}

import {
  to = module.analytics.aws_iam_role.analytics_functions
  id = "securebase-dev-analytics-functions-role"
}

import {
  to = module.analytics.aws_s3_bucket.reports
  id = "securebase-dev-reports-731184206915"
}

# The existing analytics functions role becomes the write role after the split.
# The read role (analytics_read_role) will be created fresh.
import {
  to = module.analytics.aws_iam_role.analytics_write_role
  id = "securebase-dev-analytics-functions-role"
}
