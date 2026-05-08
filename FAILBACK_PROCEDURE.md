# SecureBase Failback Procedure (us-west-2 → us-east-1)

**Objective:** Return production traffic from us-west-2 standby operations back to us-east-1 primary after a failover event.  
**Target timing:** RTO < 15 minutes, RPO < 1 minute, and complete failback workflow in < 30 minutes.

## 1) Pre-failback health checks

- [ ] Incident commander approves failback window
- [ ] us-east-1 Aurora cluster status is `available`
- [ ] Aurora replication lag is within target (< 1 minute)
- [ ] Route 53 health checks are green for primary endpoint
- [ ] API `/health` in us-east-1 returns 200
- [ ] No critical alarms in CloudWatch for auth, billing, API, or DB
- [ ] IAM execution roles remain least-privilege and unchanged
- [ ] KMS keys for SNS, CloudWatch logs, Aurora, and DynamoDB are enabled

## 2) Aurora Global Database failback

1. Confirm current writer is us-west-2.
2. Re-establish global topology with us-east-1 as writer.
3. Promote us-east-1 back to writer and re-attach us-west-2 as replica.
4. Verify global cluster members and replication status.

Example checks:

```bash
aws rds describe-global-clusters \
  --global-cluster-identifier securebase-prod-global

aws rds describe-db-clusters \
  --region us-east-1 \
  --db-cluster-identifier securebase-prod-cluster
```

## 3) DNS cutover (Route 53 weighted routing)

1. Set `api.securebase.tximhotep.com` weighted routing back to us-east-1 primary.
2. Keep us-west-2 record as standby with lower/zero weight.
3. Confirm Route 53 health checks and resolution behavior.

Validation:

```bash
dig +short api.securebase.tximhotep.com
curl -s https://api.securebase.tximhotep.com/health
```

## 4) Lambda + API Gateway re-routing to primary

1. Invoke `securebase-prod-failback-orchestrator` with explicit confirmation.
2. Confirm SSM active-region pointer is `us-east-1`.
3. Verify API Gateway traffic metrics shift to us-east-1.
4. Confirm failover/failback notifications were delivered via SNS.

```bash
aws lambda invoke \
  --function-name securebase-prod-failback-orchestrator \
  --payload '{"confirm": true}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failback_result.json
cat /tmp/failback_result.json
```

## 5) Post-failback validation checklist

- [ ] `/health` endpoint reports region `us-east-1`
- [ ] Aurora writer is us-east-1 and us-west-2 replica is healthy
- [ ] DynamoDB Global Tables replication healthy in both regions
- [ ] S3 CRR status is active and caught up
- [ ] Error rate, p95 latency, and 5xx alarms are within baseline
- [ ] DR event timeline logged for audit/compliance evidence
- [ ] No secrets were placed in code, logs, or Terraform state outputs

## Security & compliance controls

- Use temporary credentials / OIDC where possible; avoid long-lived access keys.
- Keep all DR artifacts encrypted at rest with KMS and in transit with TLS.
- Maintain full audit trail in CloudTrail + CloudWatch logs for HIPAA/SOC2/FedRAMP evidence.
