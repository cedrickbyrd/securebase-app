# SOC 2 Controls Matrix

| Control ID | Trust Criteria | Implementation | Evidence Source | Owner |
| --- | --- | --- | --- | --- |
| CC6.1 | Logical Access | MFA/access validations in evidence collection | IAM + collector output | Security Engineering |
| CC6.2 | User Access Lifecycle | Access policy monitoring in controls monitor | AWS Config snapshots | Security Engineering |
| CC7.1 | Change/Monitoring | Continuous drift checks and alerts | controls monitor history | Platform Ops |
| CC7.2 | Anomaly Response | Alert routing to notification channels | SNS compliance topic | SRE |
| CC8.1 | Change Management | Baseline vs live state comparison | controls drift snapshots | Platform Ops |
| CC9.1 | Risk Mitigation | Periodic evidence package generation | compliance evidence bucket | Compliance Team |

## Audit Readiness Notes
- Control evidence is collected automatically and stored immutably.
- Reports are generated on demand for customer review windows.
- Integrity checks are performed using SHA-256 verification.
