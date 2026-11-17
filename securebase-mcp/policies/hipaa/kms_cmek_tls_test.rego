package securebase.hipaa_test

import rego.v1
import data.securebase.hipaa

test_denies_aes256_sse_and_tls12_listener if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_kms_key.ephi_cmek",
            "type": "aws_kms_key",
            "name": "ephi_cmek",
            "values": {"enable_key_rotation": false},
          },
          {
            "address": "aws_s3_bucket_server_side_encryption_configuration.ephi_sse",
            "type": "aws_s3_bucket_server_side_encryption_configuration",
            "name": "ephi_sse",
            "values": {
              "rule": [{"apply_server_side_encryption_by_default": [{"sse_algorithm": "AES256"}]}],
            },
          },
          {
            "address": "aws_lb_listener.fhir_ingress",
            "type": "aws_lb_listener",
            "name": "fhir_ingress",
            "values": {"ssl_policy": "ELBSecurityPolicy-2016-08"},
          },
        ],
      },
    },
  }
  result := hipaa.violations["HIPAA_164_312"] with input as plan
  count(result) == 3
}

test_allows_cmek_rotation_and_tls13 if {
  plan := {
    "planned_values": {
      "root_module": {
        "resources": [
          {
            "address": "aws_kms_key.ephi_cmek",
            "type": "aws_kms_key",
            "name": "ephi_cmek",
            "values": {"enable_key_rotation": true},
          },
          {
            "address": "aws_s3_bucket_server_side_encryption_configuration.ephi_sse",
            "type": "aws_s3_bucket_server_side_encryption_configuration",
            "name": "ephi_sse",
            "values": {
              "rule": [{"apply_server_side_encryption_by_default": [{"sse_algorithm": "aws:kms"}]}],
            },
          },
          {
            "address": "aws_lb_listener.fhir_ingress",
            "type": "aws_lb_listener",
            "name": "fhir_ingress",
            "values": {"ssl_policy": "ELBSecurityPolicy-TLS13-1-2-2021-06"},
          },
        ],
      },
    },
  }
  result := hipaa.violations["HIPAA_164_312"] with input as plan
  count(result) == 0
}
