data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "github_actions_terraform_locking" {
  name = "GitHubActionsTerraformStateLocking"
  role = "GitHubActionsRole"

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
