# SecureBase MCP Server Configuration

This document describes the Model Context Protocol (MCP) server configuration for SecureBase infrastructure management.

## Overview

The `mcp-server.json` file defines the capabilities, tools, resources, and prompts available through the SecureBase MCP server. This enables AI assistants and automation tools to interact with SecureBase infrastructure in a structured and secure way.

## What is MCP?

Model Context Protocol (MCP) is a standardized protocol that allows AI assistants to:
- Access and manipulate external tools and services
- Retrieve structured information from resources
- Execute pre-defined workflows through prompts

## Configuration Structure

### 1. Tools

The MCP server provides the following tools for infrastructure management:

#### Deployment Tools
- **deploy_terraform**: Deploy Terraform infrastructure for any environment (dev/staging/prod)
- **deploy_lambda_functions**: Package and deploy Phase 2 Lambda functions
- **deploy_portal**: Build and deploy the Phase 3a customer portal

#### Management Tools
- **validate_customer_config**: Validate customer configurations before deployment
- **manage_customer**: Add, update, or remove customer configurations
- **init_phase2_database**: Initialize Aurora database schema

#### Monitoring Tools
- **get_deployment_status**: Check deployment status across phases and environments
- **check_compliance_status**: Verify compliance framework adherence
- **get_cost_metrics**: Retrieve cost metrics and forecasting

#### Testing Tools
- **run_tests**: Execute test suites (frontend, backend, integration, e2e, security, performance)

### 2. Resources

The server exposes the following resources:

- **Documentation Resources**: Getting started, Terraform deployment, Phase 2 backend, compliance frameworks
- **Configuration Resources**: Environment configs, customer tenant definitions
- **Status Resources**: Real-time deployment status across all phases

### 3. Prompts

Pre-defined workflows for common tasks:

- **deploy_new_customer**: Complete workflow for onboarding a new customer tenant
- **troubleshoot_deployment**: Step-by-step troubleshooting guide for deployment failures
- **setup_compliance**: Configure compliance frameworks (HIPAA, SOC2, FedRAMP, CIS)
- **phase2_quickstart**: Quick start guide for Phase 2 backend deployment

## Usage Examples

### Using with GitHub Copilot

The MCP server configuration can be used by GitHub Copilot to understand available tools and workflows:

```markdown
@workspace Deploy a new healthcare customer named "blue-cross" to dev environment
```

Copilot can use the `deploy_new_customer` prompt and `deploy_terraform` tool to execute the deployment.

### Tool Invocation Examples

#### Deploy Terraform to Dev
```json
{
  "tool": "deploy_terraform",
  "parameters": {
    "environment": "dev",
    "action": "plan"
  }
}
```

#### Add New Customer
```json
{
  "tool": "manage_customer",
  "parameters": {
    "action": "add",
    "environment": "dev",
    "customerConfig": {
      "name": "acme-corp",
      "tier": "fintech",
      "email": "admin@acmecorp.com",
      "framework": "soc2"
    }
  }
}
```

#### Check Deployment Status
```json
{
  "tool": "get_deployment_status",
  "parameters": {
    "environment": "all",
    "phase": "all"
  }
}
```

#### Run Integration Tests
```json
{
  "tool": "run_tests",
  "parameters": {
    "testSuite": "integration",
    "environment": "dev"
  }
}
```

## Settings

The server configuration includes the following settings:

- **defaultEnvironment**: `dev` (default environment for operations)
- **autoValidate**: `true` (automatically validate configurations)
- **requireApproval**: 
  - dev: `false` (no approval needed)
  - staging: `true` (approval required)
  - prod: `true` (approval required)
- **notifications**: Enabled for deployment success/failure and compliance alerts

## Integration with SecureBase

### Phase-Specific Tools

- **Phase 1 (Landing Zone)**: `deploy_terraform` with Landing Zone modules
- **Phase 2 (Backend)**: `init_phase2_database`, `deploy_lambda_functions`
- **Phase 3a (Portal)**: `deploy_portal`
- **Phase 4 (Enterprise)**: `get_cost_metrics`, advanced RBAC tools (coming soon)

### Compliance Integration

The MCP server understands SecureBase's compliance framework tiers:
- **Healthcare**: HIPAA compliance, 7-year retention
- **Fintech**: SOC2 Type II compliance
- **Government**: FedRAMP baseline alignment
- **Standard**: CIS AWS Foundations Benchmark

### Multi-Tenant Support

All tools respect the multi-tenant architecture:
- Customer isolation through dedicated AWS accounts
- Row-Level Security (RLS) in PostgreSQL
- Tier-based guardrails and SCPs

## Security Considerations

1. **Authentication**: MCP server requires proper AWS credentials and permissions
2. **Authorization**: Tools enforce least-privilege access based on environment
3. **Approval Gates**: Production deployments require explicit approval
4. **Audit Logging**: All tool invocations are logged for compliance

## Extending the MCP Server

To add new tools or capabilities:

1. Define the tool in the `tools` array with:
   - Unique name
   - Clear description
   - Structured input schema (JSON Schema format)

2. Add corresponding resources if the tool needs to expose data

3. Create prompts for common workflows involving the new tool

4. Update this documentation with usage examples

## Related Documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Terraform Deployment Guide](./landing-zone/environments/dev/README.md)
- [Phase 2 Backend Documentation](./PHASE2_README.md)
- [Custom Agent Configuration](./.github/agents/my-agent.agent.md)

## Support

For questions or issues with the MCP server configuration:
- Review the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Check the [Project Index](./PROJECT_INDEX.md) for comprehensive documentation
- Refer to the [SRE Runbook](./SRE_RUNBOOK.md) for operational procedures

## Version History

- **1.0.0** (2026-01-31): Initial MCP server configuration
  - Core deployment tools (Terraform, Lambda, Portal)
  - Customer management capabilities
  - Compliance and monitoring tools
  - Standard prompts for common workflows
