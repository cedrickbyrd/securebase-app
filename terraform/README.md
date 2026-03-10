# Phase3B Terraform Infrastructure

This directory is a standalone Terraform workspace for managing the SecureBase API Gateway resource tree (`/auth/login`) and related infrastructure that exists outside of the main `landing-zone/` module hierarchy.

## Files

| File | Purpose |
|------|---------|
| `provider.tf` | AWS provider configuration (region, credentials) |
| `backend.tf` | Remote state backend (S3 + DynamoDB lock) |
| `apigateway_auth_login.tf` | API Gateway `/auth` parent, `/login` child, POST method, and Lambda integration |

## Managed Resources

| Terraform Resource | AWS Type | Description |
|-------------------|----------|-------------|
| `aws_api_gateway_resource.auth` | API Gateway Resource | `/auth` parent path |
| `aws_api_gateway_resource.login` | API Gateway Resource | `/login` child path (under `/auth`) |
| `aws_api_gateway_method.login_post` | API Gateway Method | `POST /auth/login` |
| `aws_api_gateway_integration.login_integration` | API Gateway Integration | Lambda proxy for `POST /auth/login` |
| `aws_api_gateway_deployment.v1` | API Gateway Deployment | Deployment that publishes the resource tree |

---

## Importing Existing API Gateway Resources (Terraform 1.5+)

If the API Gateway resources already exist in AWS (created manually via the console or CLI), you need to import them into Terraform state so Terraform can manage them going forward.

### Modern Method: `import` Blocks (Terraform 1.5+)

**Recommended for all team members on Terraform 1.5+.** Add `import` blocks directly to your `.tf` files and run `terraform plan`. Terraform generates the import as part of the plan/apply cycle — no manual CLI commands required.

#### Step 1 — Add `import` blocks to a `.tf` file

Create a file (e.g., `imports.tf`) in this directory, or add the blocks to any existing `.tf` file:

```hcl
# Import the /auth parent resource
# ID format: <rest_api_id>/<resource_id>
import {
  to = aws_api_gateway_resource.auth
  id = "9xyetu7zq3/sfrsaw"
}

# Import the /login child resource
import {
  to = aws_api_gateway_resource.login
  id = "9xyetu7zq3/ogsr28"
}

# Import the POST method on /login
# ID format: <rest_api_id>/<resource_id>/<http_method>
import {
  to = aws_api_gateway_method.login_post
  id = "9xyetu7zq3/ogsr28/POST"
}

# Import the Lambda integration for POST /login
# ID format: <rest_api_id>/<resource_id>/<http_method>
import {
  to = aws_api_gateway_integration.login_integration
  id = "9xyetu7zq3/ogsr28/POST"
}
```

> **Note:** `sfrsaw` and `ogsr28` are the resource IDs referenced in this project's import context. If your deployment uses different resource IDs, look them up in the AWS Console under **API Gateway → APIs → 9xyetu7zq3 → Resources**, or with:
> ```bash
> aws apigateway get-resources --rest-api-id 9xyetu7zq3 --query 'items[*].[id,path]' --output table
> ```

#### Step 2 — Preview the import

```bash
cd terraform/
terraform init
terraform plan
```

Terraform will display each import as:
```
  # aws_api_gateway_resource.auth will be imported
    resource "aws_api_gateway_resource" "auth" { ... }
```

If the configuration in `apigateway_auth_login.tf` matches the live AWS resource, you will see **"No changes"** after the import lines — which means your HCL is already accurate.

#### Step 3 — Apply

```bash
terraform apply
```

Terraform imports the resources into state. After this, remove or comment out the `import` blocks (they are one-time operations).

---

### Legacy Method: `terraform import` CLI (Terraform < 1.5)

> ⚠️ **Deprecated workflow.** Prefer `import` blocks (above) for Terraform 1.5+.

```bash
# 1. Import the /auth parent resource
terraform import aws_api_gateway_resource.auth 9xyetu7zq3/sfrsaw

# 2. Import the /login child resource
terraform import aws_api_gateway_resource.login 9xyetu7zq3/ogsr28

# 3. Import the POST method attached to /login
terraform import aws_api_gateway_method.login_post 9xyetu7zq3/ogsr28/POST

# 4. Import the Lambda integration for that POST method
terraform import aws_api_gateway_integration.login_integration 9xyetu7zq3/ogsr28/POST
```

Each command operates on a single resource and must be run one at a time. Unlike `import` blocks, CLI imports are not tracked in source control.

---

## Automatic Redeployment

The `aws_api_gateway_deployment` resource uses a `triggers` block so that any change to the resource tree (adding/removing resources, methods, or integrations) automatically creates a new deployment:

```hcl
resource "aws_api_gateway_deployment" "v1" {
  rest_api_id = "9xyetu7zq3"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_resource.login.id,
      aws_api_gateway_method.login_post.http_method,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

This prevents issues where configuration changes are applied to Terraform state but the API Gateway deployment is not updated, causing API calls to continue using the stale resource configuration.

---

## Deployment Workflow

```bash
# Always run from the terraform/ directory (not landing-zone/)
cd terraform/

terraform init      # Download providers, configure backend
terraform validate  # Syntax check
terraform plan      # Preview changes
terraform apply     # Apply changes
```

> **Do not run Terraform from the repository root or `landing-zone/`.** This workspace has its own `backend.tf` and `provider.tf`.

