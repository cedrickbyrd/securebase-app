🛡️ Infrastructure Safety & Operations
Terraform Destroy Safety

    AWS Accounts: The aws_organizations_account resources have prevent_destroy = true enabled. To remove an account, you must manually toggle this to false in the code. Note: AWS Organizations does not "delete" accounts easily; they are usually just removed from the Org.

    S3 Logging Buckets: Buckets in modules/logging have force_destroy = false to prevent data loss.

Bootstrapping a Fresh Org

    Log into the AWS Management Account (Root).

    Ensure no Organization currently exists.

    Create the S3 State Bucket and DynamoDB table manually (or via the scripts/bootstrap.sh).

    Run terraform init and terraform apply.

Secrets Policy

    Zero Secrets Policy: No passwords or IAM keys are to be stored in .tfvars. Use AWS IAM Identity Center (SSO) for access
