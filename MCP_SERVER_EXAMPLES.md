# MCP Server Usage Examples

This file provides practical examples of using the SecureBase MCP server configuration.

## Example 1: Deploy a New Customer to Dev Environment

### Scenario
You need to onboard a new healthcare customer "blue-cross" with HIPAA compliance.

### Steps

1. **Add customer configuration**:
```json
{
  "tool": "manage_customer",
  "parameters": {
    "action": "add",
    "environment": "dev",
    "customerConfig": {
      "name": "blue-cross",
      "tier": "healthcare",
      "email": "admin@bluecross.example.com",
      "framework": "hipaa"
    }
  }
}
```

2. **Validate configuration**:
```json
{
  "tool": "validate_customer_config",
  "parameters": {
    "environment": "dev",
    "customerName": "blue-cross"
  }
}
```

3. **Deploy infrastructure**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "plan"
  }
}
```

4. **Apply changes**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "apply",
    "autoApprove": false
  }
}
```

5. **Initialize database**:
```json
{
  "tool": "init_phase2_database",
  "parameters": {
    "environment": "dev",
    "force": false
  }
}
```

6. **Check compliance status**:
```json
{
  "tool": "check_compliance_status",
  "parameters": {
    "customerName": "blue-cross",
    "framework": "hipaa"
  }
}
```

## Example 2: Deploy Phase 2 Backend

### Scenario
Deploy the serverless backend (Aurora, Lambda, API Gateway) to dev environment.

### Steps

1. **Plan Terraform deployment**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "plan"
  }
}
```

2. **Apply Terraform**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "apply",
    "autoApprove": false
  }
}
```

3. **Initialize database**:
```json
{
  "tool": "init_phase2_database",
  "parameters": {
    "environment": "dev",
    "force": false
  }
}
```

4. **Deploy Lambda functions**:
```json
{
  "tool": "deploy_lambda_functions",
  "parameters": {
    "environment": "dev",
    "functions": ["all"]
  }
}
```

5. **Verify deployment**:
```json
{
  "tool": "get_deployment_status",
  "parameters": {
    "environment": "dev",
    "phase": "2"
  }
}
```

## Example 3: Run Full Test Suite

### Scenario
Run comprehensive tests before promoting to production.

### Steps

1. **Run integration tests**:
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "integration",
    "environment": "staging"
  }
}
```

2. **Run E2E tests**:
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "e2e",
    "environment": "staging"
  }
}
```

3. **Run security tests**:
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "security",
    "environment": "staging"
  }
}
```

4. **Run performance tests**:
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "performance",
    "environment": "staging"
  }
}
```

## Example 4: Monitor Customer Costs

### Scenario
Review cost metrics for a specific customer over the past month.

### Steps

1. **Get monthly cost metrics for specific customer**:
```json
{
  "tool": "get_cost_metrics",
  "parameters": {
    "customerName": "blue-cross",
    "period": "monthly",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
```

2. **Get weekly cost trends for all customers**:
```json
{
  "tool": "get_cost_metrics",
  "parameters": {
    "period": "weekly",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }
}
```

## Example 5: Troubleshooting Deployment Failure

### Scenario
Phase 2 deployment failed, need to troubleshoot.

### Steps

1. **Use troubleshooting prompt**:
```json
{
  "prompt": "troubleshoot_deployment",
  "arguments": {
    "phase": "2",
    "errorMessage": "Aurora cluster creation timeout"
  }
}
```

2. **Check deployment status**:
```json
{
  "tool": "get_deployment_status",
  "parameters": {
    "environment": "dev",
    "phase": "2"
  }
}
```

3. **Re-run Terraform with fresh plan**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "plan"
  }
}
```

## Example 6: Update Customer Configuration

### Scenario
Update an existing customer's email address.

### Steps

1. **Update customer config**:
```json
{
  "tool": "manage_customer",
  "parameters": {
    "action": "update",
    "environment": "dev",
    "customerConfig": {
      "name": "blue-cross",
      "email": "newemail@bluecross.example.com"
    }
  }
}
```

2. **Validate updated config**:
```json
{
  "tool": "validate_customer_config",
  "parameters": {
    "environment": "dev",
    "customerName": "blue-cross"
  }
}
```

## Example 7: Deploy Phase 3a Portal

### Scenario
Build and deploy the customer portal to staging.

### Steps

1. **Build portal only**:
```json
{
  "tool": "deploy_portal",
  "parameters": {
    "environment": "staging",
    "buildOnly": true
  }
}
```

2. **Deploy to S3 and CloudFront**:
```json
{
  "tool": "deploy_portal",
  "parameters": {
    "environment": "staging",
    "buildOnly": false
  }
}
```

3. **Verify deployment**:
```json
{
  "tool": "get_deployment_status",
  "parameters": {
    "environment": "staging",
    "phase": "3a"
  }
}
```

## Example 8: Using Prompts for Common Workflows

### Deploy New Customer (using prompt)
```json
{
  "prompt": "deploy_new_customer",
  "arguments": {
    "customerName": "acme-corp",
    "tier": "fintech",
    "environment": "dev"
  }
}
```

### Setup Compliance Framework (using prompt)
```json
{
  "prompt": "setup_compliance",
  "arguments": {
    "framework": "soc2",
    "customerName": "acme-corp"
  }
}
```

### Phase 2 Quick Start (using prompt)
```json
{
  "prompt": "phase2_quickstart",
  "arguments": {
    "environment": "dev"
  }
}
```

## Example 9: List All Customers

### Scenario
Get a list of all customers in the dev environment.

### Steps

```json
{
  "tool": "manage_customer",
  "parameters": {
    "action": "list",
    "environment": "dev"
  }
}
```

## Example 10: Production Deployment Workflow

### Scenario
Deploy to production with all safety checks.

### Steps

1. **Validate configuration**:
```json
{
  "tool": "validate_customer_config",
  "parameters": {
    "environment": "prod"
  }
}
```

2. **Plan deployment** (requires approval for prod):
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "prod",
    "action": "plan"
  }
}
```

3. **Apply with manual approval**:
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "prod",
    "action": "apply",
    "autoApprove": false
  }
}
```

4. **Run full test suite**:
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "all",
    "environment": "prod"
  }
}
```

5. **Verify deployment**:
```json
{
  "tool": "get_deployment_status",
  "parameters": {
    "environment": "prod",
    "phase": "all"
  }
}
```

## Notes

- All tool invocations should include proper error handling
- Production deployments (`environment: "prod"`) require manual approval by default
- Cost metrics require appropriate AWS permissions for Cost Explorer API
- Compliance checks query AWS Config, Security Hub, and GuardDuty
- Test suites require appropriate test data and AWS resources to be available

## Integration with AI Assistants

These examples can be used by AI assistants like GitHub Copilot to:
- Understand the available capabilities
- Generate appropriate tool invocations based on user requests
- Chain multiple tools together for complex workflows
- Provide guidance on best practices for SecureBase deployments

## Further Reading

- [MCP Server Configuration](./mcp-server.json)
- [MCP Server Documentation](./MCP_SERVER_README.md)
- [SecureBase Getting Started](./GETTING_STARTED.md)
- [Project Documentation Index](./PROJECT_INDEX.md)
