package mvno.worm

import rego.v1

deny contains msg if {
  some bucket in input.planned_values.root_module.resources
  bucket.type == "google_storage_bucket"
  startswith(bucket.values.name, "securebase-worm-cdr-")

  some ret in bucket.values.retention_policy
  ret.is_locked != true
  msg := sprintf("CRITICAL: CDR vault '%s' must have retention_policy.is_locked = true (WORM).", [bucket.values.name])
}

deny contains msg if {
  some bucket in input.planned_values.root_module.resources
  bucket.type == "google_storage_bucket"
  startswith(bucket.values.name, "securebase-worm-cdr-")

  some ret in bucket.values.retention_policy
  ret.retention_period < 220752000 # 2555 days * 86400s
  msg := sprintf("CRITICAL [FFIEC/MAS TRM]: CDR vault '%s' requires minimum 7-year (2555-day) retention.", [bucket.values.name])
}
