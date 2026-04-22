# State Drift Documentation — 2026-04-22

**Account:** `731184206915`  
**Date:** 2026-04-22  
**Session type:** Dog-food verification (verify-first, document-state, fix, validate, archive)  
**Status:** OPEN — pending PR merge and `terraform apply`

---

## 1. Verified Live State

All findings below were confirmed directly from AWS API calls against account `731184206915`
on 2026-04-22. Commands and exact outputs are reproduced in full.

### 1.1 Lambda Execution Role — name drift

```bash
aws iam get-role --role-name securebase_lambda_exec_role \
  --query 'Role.{RoleName:RoleName,Arn:Arn,CreateDate:CreateDate}'
```

```json
{
  "RoleName": "securebase_lambda_exec_role",
  "Arn":       "arn:aws:iam::731184206915:role/securebase_lambda_exec_role",
  "CreateDate":"2026-01-01T00:00:00+00:00"
}
```

The role exists with **underscores** in its name.

### 1.2 Lambda execution role inline policies — missing

```bash
aws iam list-role-policies \
  --role-name securebase_lambda_exec_role
```

```json
{
  "PolicyNames": ["securebase-auth-dynamodb"]
}
```

Only the bootstrap `securebase-auth-dynamodb` policy is present.
The `lambda-custom-permissions` inline policy declared in
`landing-zone/modules/lambda-functions/main.tf` was **never applied**.

### 1.3 Analytics IAM role — no inline policy

```bash
aws iam list-role-policies \
  --role-name securebase-dev-analytics-functions-role
```

```json
{
  "PolicyNames": []
}
```

Role was created (2026-02-16) but its inline policy was never applied.

### 1.4 Analytics Lambda functions — not deployed

```bash
for fn in \
  securebase-dev-analytics-aggregator \
  securebase-dev-analytics-reporter \
  securebase-dev-analytics-query \
  securebase-dev-report-engine; do
    aws lambda get-function --function-name "$fn" \
      --query 'Configuration.FunctionName' 2>&1 || echo "NOT FOUND: $fn"
done
```

```
NOT FOUND: securebase-dev-analytics-aggregator
NOT FOUND: securebase-dev-analytics-reporter
NOT FOUND: securebase-dev-analytics-query
NOT FOUND: securebase-dev-report-engine
```

### 1.5 Terraform state — split module paths

```bash
cd landing-zone/environments/dev
terraform state list | grep -E 'analytics'
```

Representative output (abbreviated):

```
module.analytics.aws_dynamodb_table.reports
module.analytics.aws_dynamodb_table.report_schedules
module.analytics.aws_dynamodb_table.report_cache
module.analytics.aws_dynamodb_table.metrics
module.analytics.aws_sns_topic.analytics_alerts
module.analytics.aws_cloudwatch_event_rule.analytics_aggregator_schedule
module.securebase.module.analytics.aws_iam_role.analytics_functions
module.securebase.module.analytics.aws_s3_bucket.reports
module.securebase.module.analytics.aws_iam_role_policy_attachment.analytics_functions_basic
module.securebase.module.analytics.aws_cloudwatch_log_group.analytics_query
```

Resources are split across two module paths with no Lambda functions in either.

### 1.6 securebase_lambda_exec_role effective policy

```bash
aws iam get-role-policy \
  --role-name securebase_lambda_exec_role \
  --policy-name securebase-auth-dynamodb
```

```json
{
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem",
      "dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan"
    ],
    "Resource": "arn:aws:dynamodb:us-east-1:731184206915:table/securebase-users"
  }]
}
```

All non-auth Lambdas (billing, webhooks, support, cost-forecasting) have **no effective permissions**
beyond basic Lambda execution.

---

## 2. Terraform Declared State

### 2.1 Role name — `lambda-functions/main.tf`

```hcl
# DECLARED (before fix)
resource "aws_iam_role" "lambda_execution" {
  name = "securebase-${var.environment}-lambda-execution"   # hyphens
  ...
}
```

### 2.2 Analytics module double-instantiation

`landing-zone/environments/dev/main.tf` instantiates `module "analytics"` at the top level.
`landing-zone/main.tf` (called as `module "securebase"`) also instantiates the same module.
This produces two distinct state paths with resources scattered between them.

### 2.3 Analytics policy — overly broad statements

Three statements in `landing-zone/modules/analytics/lambda.tf` (before fix):

| Statement | Issue |
|-----------|-------|
| `cloudwatch:GetMetricData` on `Resource: "*"` | Reads any metric namespace — not needed for write-path Lambdas |
| `logs:*` on `Resource: "arn:aws:logs:*:*:*"` | Writes to any log group in any region |
| Shared role across all 4 Lambdas | `analytics_query` (public read API) carries S3 PutObject, DynamoDB DeleteItem |

### 2.4 SES wildcard — `lambda-functions/main.tf`

```hcl
# DECLARED (before fix)
{
  Effect   = "Allow"
  Action   = ["ses:SendEmail", "ses:SendRawEmail"]
  Resource = "*"    # sends from any identity in account
}
```

---

## 3. Delta / Actions Required

| # | Finding | Action | File(s) |
|---|---------|--------|---------|
| F1 | Role name drift (underscores vs hyphens) | Fix `name =` in `main.tf`, add comment in `imports.tf` | `lambda-functions/main.tf`, `environments/dev/imports.tf` |
| F2 | `analytics-functions-permissions` inline policy never applied | Role state reconciled via import; policy will apply on next `terraform apply` | `analytics/lambda.tf`, `environments/dev/imports.tf` |
| F3 | All 4 analytics Lambdas never deployed | Lambda zips must be packaged separately (ops task); IAM roles fixed in this PR | `analytics/lambda.tf` |
| F4 | `lambda-custom-permissions` never applied | Will be applied after role name is reconciled | `lambda-functions/main.tf` |
| F5 | Analytics state split across two module paths | Import blocks added to bring resources under `module.analytics.*` | `environments/dev/imports.tf` |
| F6 | Least-priv gaps in analytics policy | Split role into read (`analytics_query`) and write (aggregator/reporter/report_engine) | `analytics/lambda.tf`, `analytics/outputs.tf` |
| F7 | SES wildcard in `lambda-functions` | Scoped via `var.ses_identity_arn` | `lambda-functions/main.tf`, `lambda-functions/variables.tf` |

### Immediate next steps after this PR merges

1. Run `terraform plan` from `landing-zone/environments/dev/`  
   — confirm 0 destroys on DynamoDB tables, S3 bucket, and analytics IAM role  
   — confirm role `securebase_lambda_exec_role` shows UPDATE not CREATE
2. Run `terraform apply`
3. Package Lambda zips: `cd phase2-backend/functions && ./package-lambda.sh`
4. Deploy Lambda code via AWS CLI or a follow-up Terraform apply
5. Complete `docs/DRIFT_VALIDATION_CHECKLIST.md` and archive this document

---

*Document prepared by: Copilot coding agent*  
*Based on live AWS CLI verification against account 731184206915 on 2026-04-22*
