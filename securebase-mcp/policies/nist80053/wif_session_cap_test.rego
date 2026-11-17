package securebase.nist80053_test

import rego.v1
import data.securebase.nist80053

test_denies_session_over_3600_and_static_iam_key if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_iam_role.gha_oidc_deployer",
            "type": "aws_iam_role",
            "name": "gha_oidc_deployer",
            "values": {"max_session_duration": 43200},
          },
          {
            "address": "aws_iam_access_key.legacy_ci",
            "type": "aws_iam_access_key",
            "name": "legacy_ci",
            "values": {"user": "ci-bot"},
          },
        ],
      },
    },
  }
  result := nist80053.violations["NIST_800_53"] with input as plan
  count(result) == 2
}

test_allows_ephemeral_3600s_wif_role if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_iam_role.gha_oidc_deployer",
            "type": "aws_iam_role",
            "name": "gha_oidc_deployer",
            "values": {"max_session_duration": 1800},
          },
        ],
      },
    },
  }
  result := nist80053.violations["NIST_800_53"] with input as plan
  count(result) == 0
}
