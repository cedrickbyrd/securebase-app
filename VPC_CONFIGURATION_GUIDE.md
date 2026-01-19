# 📖 VPC Configuration & Operations Guide

## Quick Start

### 1. Enable VPCs (in terraform.tfvars)
```hcl
enable_vpc = true  # Default: true (VPCs auto-provisioned)
```

### 2. Configure VPC Options (in terraform.tfvars)
```hcl
vpc_config = {
  enable_nat_gateway    = true   # Enable NAT for egress
  enable_vpn_gateway    = false  # Disabled by default
  enable_vpc_flow_logs  = true   # Enable audit logging
  dns_hostnames         = true   # Enable DNS names
  dns_support           = true   # Enable Route53
}
```

### 3. Deploy
```bash
cd landing-zone/environments/dev
terraform plan
terraform apply
```

---

## VPC Architecture Per Customer

### Network Layout
```
Customer VPC (10.X.0.0/16)
├─ Public Subnet (10.X.0.0/24) - AZ: us-east-1a
│  ├─ NAT Gateway (outbound access)
│  └─ ALB/ingress point
├─ Private Subnet 1 (10.X.1.0/24) - AZ: us-east-1a
│  └─ Application workloads
├─ Private Subnet 2 (10.X.2.0/24) - AZ: us-east-1b
│  └─ Application workloads (HA)
└─ Flow Logs → CloudWatch Logs (/aws/vpc/flowlogs/customer-name)
```

### CIDR Allocation
```
10-Customer Network Space Allocation:

10.0.0.0/16   ACME Finance (Fintech)
10.1.0.0/16   Quantum Bank (Fintech) + MediCorp (Healthcare) + StartupCorp (Standard)
              → All in DIFFERENT AWS accounts (no conflict)
10.2.0.0/16   MetaBank Financial (Fintech)
10.3.0.0/16   Guardian Health (Healthcare)
10.4.0.0/16   TechGov (Gov-Federal) + StateCorp Federal (Gov-Federal)
              → Different AWS accounts (no conflict)
10.5.0.0/16   CrossBank International (Fintech)
10.6.0.0/16   TechStartup (Standard)

Unused: 10.7.0.0 - 10.255.0.0 (249 additional VPCs possible)
```

---

## Security Group Rules by Framework

### HIPAA (Healthcare) - Strictest

**Inbound Rules:**
- Port 443 (HTTPS) from VPC CIDR only
- All others: DENY

**Outbound Rules:**
- Port 443 (HTTPS) only
- All others: DENY

**Rationale:** HIPAA requires encryption in transit and strict access control

**Customers:**
- MediCorp Solutions
- Guardian Health Systems

---

### SOC2 (Fintech) - Moderate

**Inbound Rules:**
- Port 443 (HTTPS) from VPC CIDR
- Port 22 (SSH) from VPC CIDR (bastion host pattern)
- All others: DENY

**Outbound Rules:**
- All traffic: ALLOW

**Rationale:** SOC2 allows SSH with proper controls (bastion pattern, audit logging)

**Customers:**
- ACME Finance
- Quantum Bank
- MetaBank Financial
- CrossBank International

---

### FedRAMP (Gov-Federal) - Strict

**Inbound Rules:**
- Port 443 (HTTPS) from VPC CIDR only
- All others: DENY

**Outbound Rules:**
- Port 443 (HTTPS) only
- All others: DENY

**Rationale:** FedRAMP requires strictest controls for government compliance

**Customers:**
- TechGov Solutions
- StateCorp Federal Services

---

### CIS (Standard) - Permissive

**Inbound Rules:**
- Port 443 (HTTPS) from VPC CIDR
- Other ports: Allow (customer-configured)

**Outbound Rules:**
- All traffic: ALLOW

**Rationale:** CIS benchmarks focus on least privilege without strict egress filtering

**Customers:**
- StartupCorp Inc
- TechStartup

---

## Routing Configuration

### Public Subnet Route Table
```
Destination    Target              Type
─────────────────────────────────────────
0.0.0.0/0      Internet Gateway    Route to Internet
10.X.0.0/16    Local               VPC-local
```

### Private Subnet Route Table
```
Destination    Target              Type
─────────────────────────────────────────
0.0.0.0/0      NAT Gateway         Route to Internet (via NAT)
10.X.0.0/16    Local               VPC-local
```

---

## VPC Flow Logs Configuration

### CloudWatch Log Group
- **Location:** `/aws/vpc/flowlogs/{customer-name}`
- **Retention:** 30 days (default, configurable)
- **Format:** Default AWS Flow Logs format

### Example Flow Log Entry
```
2026-01-19 14:23:45
Version: 2
Account-ID: 222233334444
Interface-ID: eni-0123456789abcdef0
Source-Address: 10.0.1.50
Destination-Address: 10.0.2.100
Source-Port: 54321
Destination-Port: 443
Protocol: TCP
Packets: 10
Bytes: 2048
Start: 1705681425
End: 1705681425
Action: ACCEPT
Log-Status: OK
```

### Query VPC Flow Logs
```bash
# Query via AWS CLI
aws logs start-query \
  --log-group-name "/aws/vpc/flowlogs/acme-finance" \
  --start-time $(date -d "1 hour ago" +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, srcaddr, dstaddr, action | filter action="REJECT"'

# View rejected connections (potential security issues)
```

---

## Adding a New Customer with VPC

### Step 1: Update client.auto.tfvars
```hcl
clients = {
  # ... existing customers ...
  
  "newcustomer-name" = {
    tier         = "fintech"              # Choose: standard, healthcare, fintech, gov-federal
    account_id   = "123456789012"
    prefix       = "newcustomer"
    framework    = "soc2"                 # Choose: cis, hipaa, soc2, fedramp
    vpc_cidr     = "10.7.0.0/16"          # Choose unique CIDR in 10.0.0.0 space
    tags = {
      Customer     = "New Customer Inc"
      Tier         = "Fintech"
      Framework    = "SOC2"
      ContactEmail = "ops@newcustomer.io"
      OnboardedOn  = "2026-01-20"
    }
  }
}
```

### Step 2: Run Terraform Plan
```bash
terraform plan -out=tfplan
```
**Expected Output:** 20-21 new resources (1 VPC, 3 subnets, 1 NAT, etc.)

### Step 3: Apply
```bash
terraform apply tfplan
```

### Step 4: Verify
```bash
# Check VPC created
aws ec2 describe-vpcs \
  --filters "Name=tag:Customer,Values=NewCustomerInc" \
  --query 'Vpcs[0].VpcId'

# Check subnets created
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-xxxxxxxx" \
  --query 'Subnets[*].{CIDR:CidrBlock, AZ:AvailabilityZone}'

# Check NAT Gateway
aws ec2 describe-nat-gateways \
  --filter "Name=tag:Customer,Values=NewCustomerInc" \
  --query 'NatGateways[0].NatGatewayId'
```

---

## Troubleshooting

### Issue: VPC creation fails
```
Error: Error creating VPC: VpcLimitExceeded
```
**Solution:** AWS account has 5 VPC limit. Request limit increase from AWS.

---

### Issue: NAT Gateway stuck in "Available" state
```
NAT Gateway Status: Available (should be "Pending" then "Available")
```
**Solution:** Wait 5 minutes for full provisioning. If persists, check Elastic IP allocation.

---

### Issue: VPC Flow Logs not appearing in CloudWatch
```
Error: No log entries in /aws/vpc/flowlogs/{customer-name}
```
**Troubleshooting:**
1. Check IAM role has CloudWatch Logs permissions
2. Verify VPC has active traffic (create test EC2 + ping)
3. Check log group retention is not 0

---

### Issue: Security group rules too restrictive
```
Error: Cannot reach workload from expected source
```
**Solution:**
1. Check source is in VPC CIDR
2. Verify security group allows protocol/port
3. Check Network ACL isn't blocking (default allows all)

---

## Scaling: From 10 to 50 Customers

### What Changes
```
10 Customers (Current):
  • 10 VPCs (10.0 - 10.6)
  • 4 OUs (flat)
  • Resource count: ~245

50 Customers (Phase 3):
  • 50 VPCs (10.0 - 10.49)
  • 7 OUs (3-level hierarchy)
  • Resource count: ~1200
  • Deployment time: 30-35 min

100+ Customers (Phase 4):
  • Multi-region (us-east-1 + us-west-2)
  • VPC peering / Transit Gateway
  • Regional routing
  • 8+ OUs
```

### Preparation Checklist
- [ ] Prepare CIDRs 10.7 through 10.49 (40+ blocks)
- [ ] Design OU hierarchy (region + tier)
- [ ] Plan Transit Gateway for inter-VPC routing
- [ ] Update documentation
- [ ] Test with 5 additional customers first

---

## Monitoring & Alerting

### Key CloudWatch Metrics (Per VPC)

```
Metric Name                Unit      Threshold
─────────────────────────────────────────────────
NetworkIn (bytes)          Bytes     Alert > 100GB/day
NetworkOut (bytes)         Bytes     Alert > 100GB/day
BytesInFromDestination     Bytes     Monitor for DDoS
BytesOutToDestination      Bytes     Monitor for exfiltration
```

### Recommended Alarms

1. **High Network Traffic**
   - Condition: NetworkOut > 100 GB/day
   - Action: Investigate for data exfiltration

2. **NAT Gateway Failure**
   - Condition: NAT State = Failed
   - Action: Immediate remediation (failover)

3. **VPC Flow Logs Failure**
   - Condition: No logs in 1 hour
   - Action: Check IAM role + network ACLs

---

## Cost Optimization

### Current (10 Customers)
```
NAT Gateways: $0.045/hour × 10 × 730 hours = $328.50/month
CloudWatch Logs: ~$50/month
Total VPC Cost: ~$378.50/month
```

### Optimization Options

**Option 1: VPN Gateway instead of NAT (for gov-fed)**
```
Cost Savings: $36.50/month per customer
Trade-off: VPN requires customer config
Recommendation: Use for Gov-Federal tier only
```

**Option 2: Shared NAT Gateway (for standard tier)**
```
Cost Savings: $32.50/month per customer
Trade-off: Shared IP, may violate compliance
Recommendation: Use for Standard tier only
```

**Option 3: S3 endpoint (for logging tier)**
```
Cost Savings: $0.01 per GB data transfer
Impact: Large for Flow Logs → S3 archive
```

---

## Production Checklist

- [ ] All 10 VPC CIDRs assigned and unique
- [ ] Security groups match framework requirements
- [ ] Flow Logs configured and streaming
- [ ] NAT Gateways active and healthy
- [ ] Route tables correct (public vs private)
- [ ] Multi-AZ subnets in different zones
- [ ] Tags consistent (customer, tier, framework)
- [ ] Cost monitoring enabled
- [ ] Backup/failover procedures documented
- [ ] Customer access tested (can SSH/RDP if framework allows)

---

## Reference

### Customer → VPC Mapping

| Customer | Tier | Framework | VPC CIDR | Status |
|----------|------|-----------|----------|--------|
| ACME Finance | Fintech | SOC2 | 10.0.0.0/16 | ✅ Active |
| Quantum Bank | Fintech | SOC2 | 10.1.0.0/16 | ✅ Active |
| MetaBank | Fintech | SOC2 | 10.2.0.0/16 | ✅ Active |
| CrossBank | Fintech | SOC2 | 10.5.0.0/16 | ✅ Active |
| MediCorp | Healthcare | HIPAA | 10.1.0.0/16 | ✅ Active |
| Guardian | Healthcare | HIPAA | 10.3.0.0/16 | ✅ Active |
| TechGov | Gov-Federal | FedRAMP | 10.4.0.0/16 | ✅ Active |
| StateCorp | Gov-Federal | FedRAMP | 10.4.0.0/16 | ✅ Active |
| StartupCorp | Standard | CIS | 10.1.0.0/16 | ✅ Active |
| TechStartup | Standard | CIS | 10.6.0.0/16 | ✅ Active |

---

**Last Updated:** 2026-01-19  
**Version:** 1.0  
**Status:** Production Ready
