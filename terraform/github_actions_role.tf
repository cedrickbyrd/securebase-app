variable "github_actions_role_name" {
  description = "Name of the IAM role assumed by GitHub Actions for Terraform deployments."
  type        = string
  default     = "GitHubActionsRole"
}

variable "terraform_lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking."
  type        = string
  default     = "securebase-terraform-locks"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_iam_role" "github_actions" {
  name = var.github_actions_role_name
}

resource "aws_iam_role_policy" "github_actions_terraform_locking" {
  name = "GitHubActionsTerraformStateLocking"
  role = data.aws_iam_role.github_actions.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
        ]
        Resource = "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.terraform_lock_table_name}"
      },
    ]
  })
}
