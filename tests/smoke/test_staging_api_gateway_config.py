from __future__ import annotations

from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]


class StagingApiGatewayConfigTests(unittest.TestCase):
    def test_staging_workspace_manages_api_gateway_policy(self) -> None:
        policy_tf = (REPO_ROOT / "terraform" / "apigateway_policy.tf").read_text()

        self.assertIn('resource "aws_api_gateway_rest_api_policy" "staging_allow_invoke"', policy_tf)
        self.assertIn('Action    = "execute-api:Invoke"', policy_tf)
        self.assertIn('Principal = "*"', policy_tf)
        self.assertIn('Resource  = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.rest_api_id}/*"', policy_tf)

    def test_staging_smoke_tests_only_run_after_apply(self) -> None:
        workflow = (REPO_ROOT / ".github" / "workflows" / "terraform-staging-apply.yml").read_text()

        self.assertIn("- name: Run Lambda smoke tests", workflow)
        self.assertIn("if: ${{ vars.ENABLE_STAGING_TERRAFORM_APPLY == 'true' }}", workflow)


if __name__ == "__main__":
    unittest.main()
