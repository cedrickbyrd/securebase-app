# Regulatory Compliance Control Matrix

| Regulatory Mandate | Scope / Enclave | Enforced Control | Verification Artifact |
| :--- | :--- | :--- | :--- |
| FFIEC AIO II.B / II.C | `securebase-us` | Sub-15 ms TAC geofence & N6 zero public IP | `policies/rego/mvno_geofence_tac.rego` |
| HIPAA 164.312(e)(1) | `securebase-us` | PrivateLink / PSC non-routable cellular breakout | `policies/rego/mvno_zero_public_ip.rego` |
| NIST SP 800-53 SC-7 | All Perimeters | Non-routable RFC 6598/1918 APN pools only | `infra/modules/transit-vpc-breakout/main.tf` |
| EU DORA / GDPR Art. 32 | `securebase-euro` | Regional lock & IMEI-SV drift throttling | `infra/modules/worm-telemetry-vault/main.tf` |
| Singapore MAS TRM 9.1 | `securebase-asia` | 7-year (2,555-day) WORM CDR lock + CMEK | `policies/rego/mvno_worm_cdr_retention.rego` |
