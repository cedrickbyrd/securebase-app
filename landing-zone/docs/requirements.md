# SecureBase Infrastructure Requirements

## Prerequisites

### Required Tools

- **Terraform**: `>= 1.9.0`
- **AWS CLI**: `>= 2.x`
- **Python**: `>= 3.8` (for automation scripts)
- **Git**: `>= 2.x`

### AWS Account Requirements

- AWS account with administrative access
- AWS credentials configured via:
  - AWS CLI (`aws configure`)
  - Environment variables
  - IAM role assumption

### Terraform Provider Versions

```hcl
terraform {
  required_version = ">= 1.9.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.82.2"
    }
    netlify = {
      source  = "netlify/netlify"
      version = "~> 0.4.0"
    }
  }
}
