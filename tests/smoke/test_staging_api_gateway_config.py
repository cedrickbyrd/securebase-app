from __future__ import annotations

from pathlib import Path
import re
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
POLICY_TF = REPO_ROOT / "terraform" / "apigateway_policy.tf"
WORKFLOW_YML = REPO_ROOT / ".github" / "workflows" / "terraform-staging-apply.yml"


class StagingApiGatewayConfigTests(unittest.TestCase):
    def test_staging_workspace_manages_api_gateway_policy(self) -> None:
        self.assertTrue(POLICY_TF.exists(), f"Missing Terraform policy file: {POLICY_TF}")

        policy_tf = POLICY_TF.read_text()

        self.assertIn('resource "aws_api_gateway_rest_api_policy" "staging_allow_invoke"', policy_tf)
        self.assertIn('Action    = "execute-api:Invoke"', policy_tf)
        self.assertRegex(
            policy_tf,
            re.compile(
                r'Resource\s*=\s*"arn:aws:execute-api:\$\{var\.aws_region\}:\$\{data\.aws_caller_identity\.current\.account_id\}:\$\{var\.rest_api_id\}/\$\{var\.api_stage_name\}/\*/\*"'
            ),
        )

    def test_staging_smoke_tests_only_run_after_apply(self) -> None:
        self.assertTrue(WORKFLOW_YML.exists(), f"Missing workflow file: {WORKFLOW_YML}")

        workflow = WORKFLOW_YML.read_text()

        self.assertIn("- name: Run Lambda smoke tests", workflow)
        self.assertIn("if: ${{ vars.ENABLE_STAGING_TERRAFORM_APPLY == 'true' }}", workflow)


if __name__ == "__main__":
    unittest.main()
