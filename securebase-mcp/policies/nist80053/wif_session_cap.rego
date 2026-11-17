package securebase.nist80053

import rego.v1

# NIST SP 800-53 Rev. 5 (AC-2 / IA-5): Zero Static Keys & 3600s WIF/OIDC Session Cap

violations["NIST_800_53"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_iam_role"
  to_number(resource.values.max_session_duration) > 3600
  finding := {
    "finding_id": sprintf("nist-wif-ttl-%s", [resource.name]),
    "framework": "NIST_800_53",
    "rule_head": "violations[\"NIST_800_53\"].wif_session_exceeds_3600s",
    "resource_address": resource.address,
    "control_citation": "NIST SP 800-53 AC-2(12) / IA-5(13) (Ephemeral OIDC Cap)",
    "severity": "HIGH",
    "penalty_exposure": "FedRAMP / FISMA ATO revocation risk from >1h STS token replay window",
    "reason": sprintf("IAM role '%s' sets max_session_duration = %vs; maximum allowed is 3600s.", [resource.address, resource.values.max_session_duration]),
  }
}

violations["NIST_800_53"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_iam_access_key"
  finding := {
    "finding_id": sprintf("nist-static-key-%s", [resource.name]),
    "framework": "NIST_800_53",
    "rule_head": "violations[\"NIST_800_53\"].static_iam_key_prohibited",
    "resource_address": resource.address,
    "control_citation": "NIST SP 800-53 IA-5 / Zero Static Credentials",
    "severity": "CRITICAL",
    "penalty_exposure": "Long-lived IAM key leakage voids Zero-Data-Custody cryptographic boundary",
    "reason": sprintf("Static IAM access key '%s' is prohibited; use OIDC Workload Identity Federation.", [resource.address]),
  }
}
