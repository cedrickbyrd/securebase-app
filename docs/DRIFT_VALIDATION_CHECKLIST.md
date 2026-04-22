# State Drift Validation Checklist — 2026-04-22

Reference document: `docs/STATE_DRIFT_2026-04-22.md`

Complete every item before archiving the state drift document.

---

## Pre-Apply

- [ ] `terraform plan` shows 0 resources to destroy for existing DynamoDB tables
- [ ] `terraform plan` shows 0 resources to destroy for existing S3 bucket
- [ ] `terraform plan` shows 0 resources to destroy for existing IAM role `securebase-dev-analytics-functions-role`
- [ ] `terraform plan` shows role name for lambda_execution = `securebase_lambda_exec_role` (no new role creation)
- [ ] `terraform plan` shows `analytics_read_role` to be CREATED (new)
- [ ] `terraform plan` shows `analytics_write_role` to be UPDATED (existing role renamed in state)

---

## Post-Apply

- [ ] `aws iam get-role-policy --role-name securebase-dev-analytics-write-role --policy-name analytics-write-permissions` returns valid JSON
- [ ] `aws iam get-role-policy --role-name securebase-dev-analytics-read-role --policy-name analytics-query-permissions` returns valid JSON
- [ ] `aws iam simulate-principal-policy` on write role allows `s3:PutObject` on reports bucket
- [ ] `aws iam simulate-principal-policy` on write role DENIES `s3:PutObject` on any other bucket
- [ ] `aws iam simulate-principal-policy` on read role DENIES `dynamodb:DeleteItem`
- [ ] `aws iam simulate-principal-policy` on read role DENIES `s3:PutObject`
- [ ] `aws lambda list-functions` shows all 4 analytics functions present
- [ ] All 4 Lambda functions reference correct role ARN (query→read, others→write)
- [ ] `terraform state list | grep analytics` shows no duplicate paths
- [ ] `scripts/validate_phase4_deployment.sh dev us-east-1` exits 0

### Spot-check commands

```bash
# Verify write role policy
aws iam get-role-policy \
  --role-name securebase-dev-analytics-write-role \
  --policy-name analytics-write-permissions \
  --query 'PolicyDocument'

# Verify read role policy
aws iam get-role-policy \
  --role-name securebase-dev-analytics-read-role \
  --policy-name analytics-query-permissions \
  --query 'PolicyDocument'

# Confirm read role cannot delete DynamoDB items
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::731184206915:role/securebase-dev-analytics-read-role \
  --action-names dynamodb:DeleteItem \
  --resource-arns arn:aws:dynamodb:us-east-1:731184206915:table/securebase-dev-reports \
  --query 'EvaluationResults[0].EvalDecision'

# Confirm write role can PutObject on reports bucket only
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::731184206915:role/securebase-dev-analytics-write-role \
  --action-names s3:PutObject \
  --resource-arns arn:aws:s3:::securebase-dev-reports-731184206915/test.pdf \
  --query 'EvaluationResults[0].EvalDecision'

# Confirm Lambda functions are present and have correct roles
aws lambda get-function-configuration \
  --function-name securebase-dev-analytics-query \
  --query 'Role'

aws lambda get-function-configuration \
  --function-name securebase-dev-analytics-aggregator \
  --query 'Role'

# Confirm no duplicate state paths
terraform state list | grep analytics
```

---

## Archive Gate

- [ ] All checklist items above checked
- [ ] `docs/DRIFT_VALIDATION_CHECKLIST.md` fully checked
- [ ] Move `docs/STATE_DRIFT_2026-04-22.md` to `docs/archive/STATE_DRIFT_2026-04-22-RESOLVED.md`
- [ ] Add resolution date and summary to the archived doc

### Archive template (add to bottom of archived doc)

```markdown
---

## Resolution

**Resolved:** YYYY-MM-DD  
**Applied by:** <engineer name>  
**Terraform apply output:** (paste summary line, e.g. "Apply complete! Resources: 3 added, 2 changed, 0 destroyed.")

### Summary

- Role name drift resolved: `securebase_lambda_exec_role` now matches Terraform declaration
- Analytics inline policies applied: `analytics-write-permissions`, `analytics-query-permissions`
- Roles split: `analytics_read_role` created fresh; `analytics_write_role` updated from existing role
- Analytics module state consolidated under `module.analytics.*`
- SES resource scoped to verified domain identity
```
