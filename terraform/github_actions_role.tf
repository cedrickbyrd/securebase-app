variable "github_actions_role_name" {
  description = "Name of the IAM role assumed by GitHub Actions for Terraform deployments."
  type        = string
  default     = "GitHubActionsRole"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "github_actions_terraform_locking" {
  name = "GitHubActionsTerraformStateLocking"
  role = var.github_actions_role_name

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
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/securebase-terraform-locks"
      },
    ]
  })
}
