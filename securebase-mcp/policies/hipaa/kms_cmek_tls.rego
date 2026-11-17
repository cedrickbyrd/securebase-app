package securebase.hipaa

import rego.v1

# HIPAA 45 CFR 164.312(a)(2)(iv) & 164.312(e)(1): KMS CMEK Encryption + TLS 1.3 In-Transit

violations["HIPAA_164_312"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_kms_key"
  not resource.values.enable_key_rotation == true
  finding := {
    "finding_id": sprintf("hipaa-kms-rot-%s", [resource.name]),
    "framework": "HIPAA_164_312",
    "rule_head": "violations[\"HIPAA_164_312\"].kms_cmek_rotation_disabled",
    "resource_address": resource.address,
    "control_citation": "HIPAA 45 CFR 164.312(a)(2)(iv) (ePHI Encryption)",
    "severity": "HIGH",
    "penalty_exposure": "HHS OCR Tier 4 Violation ($68,928 per violation / $2.06M annual cap)",
    "reason": sprintf("Customer-managed KMS key '%s' has enable_key_rotation != true.", [resource.address]),
  }
}

violations["HIPAA_164_312"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_s3_bucket_server_side_encryption_configuration"
  some rule in resource.values.rule
  some apply in rule.apply_server_side_encryption_by_default
  apply.sse_algorithm != "aws:kms"
  finding := {
    "finding_id": sprintf("hipaa-cmek-sse-%s", [resource.name]),
    "framework": "HIPAA_164_312",
    "rule_head": "violations[\"HIPAA_164_312\"].storage_requires_kms_cmek",
    "resource_address": resource.address,
    "control_citation": "HIPAA 45 CFR 164.312(a)(2)(iv) (Dedicated CMEK)",
    "severity": "CRITICAL",
    "penalty_exposure": "Unencrypted or AWS-managed ePHI bucket triggers mandatory breach reporting",
    "reason": sprintf("SSE algorithm on '%s' is '%s'; must use aws:kms CMEK.", [resource.address, apply.sse_algorithm]),
  }
}

violations["HIPAA_164_312"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_lb_listener"
  not startswith(resource.values.ssl_policy, "ELBSecurityPolicy-TLS13")
  finding := {
    "finding_id": sprintf("hipaa-tls13-%s", [resource.name]),
    "framework": "HIPAA_164_312",
    "rule_head": "violations[\"HIPAA_164_312\"].tls_1_3_required",
    "resource_address": resource.address,
    "control_citation": "HIPAA 45 CFR 164.312(e)(1) (Transmission Security)",
    "severity": "CRITICAL",
    "penalty_exposure": "Legacy TLS 1.1/1.2 downgrade risk on ePHI clinical ingress",
    "reason": sprintf("Listener '%s' uses ssl_policy '%s'; TLS 1.3 policy required.", [resource.address, resource.values.ssl_policy]),
  }
}
