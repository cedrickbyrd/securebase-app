# SecureBase Terraform Deployment Troubleshooting

## Issue: AWS Config Configuration Recorder Drift

When running `terraform plan`, you may see this warning:

```
Note: Objects have changed outside of Terraform
Terraform detected the following changes made outside of Terraform since the last "terraform apply"

# module.security.aws_config_configuration_recorder.this has changed
~ resource "aws_config_configuration_recorder" "this" {
    ~ recording_group {
      + resource_types = []
```

### Root Cause
AWS Config Recorder was manually modified or was created outside of Terraform.

### Solution
Add `ignore_changes` to the security module's aws_config_configuration_recorder resource.

**File**: `landing-zone/modules/security/main.tf`

Add this lifecycle block to the recorder resource:

```hcl
resource "aws_config_configuration_recorder" "this" {
  name           = "default"
  role_arn       = aws_iam_role.config_role.arn
  recording_mode {
    recording_frequency = "CONTINUOUS"
    recording_mfa_enabled = true
  }

  # Ignore external changes to recording_group
  lifecycle {
    ignore_changes = [
      recording_group[0].resource_types,
      recording_group[0].include_global
    ]
  }

  depends_on = [aws_iam_role_policy.config_s3_kms_access]
}
```

Alternatively, use state refresh to sync:

```bash
terraform refresh
```

---

## Issue: Config Delivery Channel Not Created

Error:
```
module.security.aws_config_delivery_channel.this will be created
```

### Solution
This is expected on first deployment. The delivery channel is created after the recorder is properly configured. Simply apply:

```bash
terraform apply
```

---

## Issue: IAM Role Created in Wrong Module

Error:
```
module.identity.aws_iam_role.aws_config_role will be created
```

### Root Cause
The Config IAM role is being created in the identity module instead of the security module.

### Solution
The role should be in `landing-zone/modules/security/iam.tf`. Verify it's there and not duplicated in the identity module.

---

## Issue: Stale Terraform State

If you see references to resources that don't exist:

```
Error: reading Organizations Organizational Unit (r-1i95/bluecross): empty result
```

### Solution

1. **Refresh state** to remove stale references:
```bash
cd landing-zone/environments/dev
terraform refresh
```

2. **Remove stale resource** from state if necessary:
```bash
terraform state rm 'data.aws_organizations_organizational_unit.target[0]'
```

3. **Full state cleanup** (use with caution):
```bash
terraform destroy
rm -rf .terraform terraform.tfstate*
terraform init
```

---

## Deployment Checklist

Before running `terraform apply`:

- [ ] AWS credentials configured: `aws sts get-caller-identity`
- [ ] Region set: `export AWS_REGION=us-east-1`
- [ ] Terraform initialized: `terraform init`
- [ ] Configuration validated: `terraform validate`
- [ ] Plan reviewed: `terraform plan -out=tfplan`
- [ ] All variables provided in `terraform.tfvars`
- [ ] Client configurations in `client.auto.tfvars` include required fields:
  - `tier` (healthcare, fintech, gov-federal, standard)
  - `framework` (hipaa, soc2, fedramp, cis)
  - `prefix` (resource naming prefix)
  - `account_id` (AWS account ID)

---

## Successful Deployment Indicators

After `terraform apply` succeeds, you should see:

```
Apply complete! Resources added: X, changed: Y, destroyed: Z.

Outputs:
organization_id = "o-xxxxx"
client_account_ids = {
  "blue-cross" = "123456789012"
  "goldman-fin" = "987654321098"
  ...
}
customer_ou_ids = {
  healthcare = "ou-xxxxx"
  fintech = "ou-xxxxx"
  gov_federal = "ou-xxxxx"
  standard = "ou-xxxxx"
}
```

---

## Next Steps: Backend API

Once Terraform deployment succeeds, proceed to:

1. **Backend Service**: Implement REST API for tenant management
2. **Database**: Set up PostgreSQL with multi-tenant schema
3. **Billing Engine**: Usage metering and invoice generation
4. **Dashboard**: Self-service tenant portal

See `docs/PAAS_ARCHITECTURE.md` for the complete implementation roadmap.
