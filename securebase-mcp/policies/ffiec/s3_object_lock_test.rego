package securebase.ffiec_test

import rego.v1
import data.securebase.ffiec

test_denies_governance_mode_and_short_retention if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_s3_bucket.worm_audit",
            "type": "aws_s3_bucket",
            "name": "worm_audit",
            "values": {"object_lock_enabled": false},
          },
          {
            "address": "aws_s3_bucket_object_lock_configuration.worm_audit_lock",
            "type": "aws_s3_bucket_object_lock_configuration",
            "name": "worm_audit_lock",
            "values": {
              "rule": [{"default_retention": [{"mode": "GOVERNANCE", "days": 365}]}],
            },
          },
        ],
      },
    },
  }
  result := ffiec.violations["FFIEC_AIO"] with input as plan
  count(result) == 3
}

test_allows_compliance_mode_2555_days if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_s3_bucket.worm_audit",
            "type": "aws_s3_bucket",
            "name": "worm_audit",
            "values": {"object_lock_enabled": true},
          },
          {
            "address": "aws_s3_bucket_object_lock_configuration.worm_audit_lock",
            "type": "aws_s3_bucket_object_lock_configuration",
            "name": "worm_audit_lock",
            "values": {
              "rule": [{"default_retention": [{"mode": "COMPLIANCE", "days": 2555}]}],
            },
          },
        ],
      },
    },
  }
  result := ffiec.violations["FFIEC_AIO"] with input as plan
  count(result) == 0
}
