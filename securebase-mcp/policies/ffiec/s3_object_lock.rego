package securebase.ffiec

import rego.v1

# FFIEC AIO Booklet Section II.C: Immutable 7-Year S3 Object Lock (COMPLIANCE mode)
# General reference in rule head groups violations cleanly under violations["FFIEC_AIO"].

violations["FFIEC_AIO"] contains finding if {
  some resource in input.planned_values.root_module.resources
  resource.type == "aws_s3_bucket"
  not resource.values.object_lock_enabled == true
  finding := {
    "finding_id": sprintf("ffiec-s3-lock-%s", [resource.name]),
    "framework": "FFIEC_AIO",
    "rule_head": "violations[\"FFIEC_AIO\"].s3_object_lock_disabled",
    "resource_address": resource.address,
    "control_citation": "FFIEC AIO Booklet II.C (Evidentiary Immutability)",
    "severity": "CRITICAL",
    "penalty_exposure": "FDIC / OCC Consent Order & Civil Monetary Penalties up to $1M/day",
    "reason": sprintf("S3 audit bucket '%s' lacks object_lock_enabled = true.", [resource.address]),
  }
}

violations["FFIEC_AIO"] contains finding if {
  some lock_cfg in input.planned_values.root_module.resources
  lock_cfg.type == "aws_s3_bucket_object_lock_configuration"
  some rule in lock_cfg.values.rule
  some retention in rule.default_retention
  retention.mode != "COMPLIANCE"
  finding := {
    "finding_id": sprintf("ffiec-s3-mode-%s", [lock_cfg.name]),
    "framework": "FFIEC_AIO",
    "rule_head": "violations[\"FFIEC_AIO\"].object_lock_mode_not_compliance",
    "resource_address": lock_cfg.address,
    "control_citation": "FFIEC AIO Booklet II.C / SEC 17a-4(f)",
    "severity": "CRITICAL",
    "penalty_exposure": "Unenforceable GOVERNANCE lock allows root admin deletion before 7 years",
    "reason": sprintf("Object Lock mode on '%s' is '%s'; must be 'COMPLIANCE'.", [lock_cfg.address, retention.mode]),
  }
}

violations["FFIEC_AIO"] contains finding if {
  some lock_cfg in input.planned_values.root_module.resources
  lock_cfg.type == "aws_s3_bucket_object_lock_configuration"
  some rule in lock_cfg.values.rule
  some retention in rule.default_retention
  to_number(retention.days) < 2555
  finding := {
    "finding_id": sprintf("ffiec-s3-days-%s", [lock_cfg.name]),
    "framework": "FFIEC_AIO",
    "rule_head": "violations[\"FFIEC_AIO\"].retention_below_2555_days",
    "resource_address": lock_cfg.address,
    "control_citation": "FFIEC 7-Year Evidentiary Retention Mandate",
    "severity": "HIGH",
    "penalty_exposure": "Examiner audit binder rejection for < 2,555-day WORM chain retention",
    "reason": sprintf("Retention period on '%s' is %v days; minimum 2555 days required.", [lock_cfg.address, retention.days]),
  }
}
