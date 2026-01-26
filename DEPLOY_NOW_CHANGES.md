# DEPLOY_NOW.sh - Phase 2 Deployment Changes

## Summary
Updated `DEPLOY_NOW.sh` to include **Phase 2 (Serverless Backend)** deployment alongside Phase 1 (Landing Zone).

## What Changed

### 1. Updated Cost Estimates (Lines 81-86)
**Before:**
- Simple message: "AWS Organizations is free. Other services (~$180/month)"

**After:**
- Detailed breakdown:
  - Phase 1 (Management Account): ~$180/month
  - Phase 2 (Database & API): ~$50-120/month
  - Total: ~$230-300/month

### 2. Updated Deployment Confirmation (Lines 74-79)
Added Phase 2 infrastructure details to the pre-deployment summary:
- Aurora Serverless v2 PostgreSQL cluster
- RDS Proxy for connection pooling
- DynamoDB tables (metrics, events, cache)
- Lambda functions and API Gateway
- Secrets Manager for credentials

### 3. New Step 7: Initialize Phase 2 Database (Lines 109-158)
**What it does:**
- Retrieves RDS cluster endpoint from Terraform outputs
- Navigates to `phase2-backend/database`
- Executes `init_database.sh` to:
  - Create database schema with RLS policies
  - Create application roles (securebase_app, securebase_analytics)
  - Store credentials in Secrets Manager
  - Verify schema and extensions

**Error handling:**
- Gracefully handles missing outputs (database not deployed)
- Provides manual commands if automatic initialization fails
- Logs output to `/tmp/db_init.log`

### 4. New Step 8: Package Lambda Functions (Lines 160-193)
**What it does:**
- Navigates to `phase2-backend/functions`
- Executes `package-lambda.sh` to create deployment zips
- Creates packages in `phase2-backend/deploy/` directory

**Error handling:**
- Skips if packaging script not found (functions may already be packaged)
- Provides manual packaging commands if automatic packaging fails
- Logs output to `/tmp/lambda_package.log`

### 5. New Step 9: Deploy Lambda Functions (Lines 195-211)
**What it does:**
- Runs targeted Terraform apply: `terraform apply -auto-approve -target=module.lambda_functions`
- Uploads packaged Lambda code to AWS
- Updates function code with latest packages

**Error handling:**
- Provides guidance if deployment fails (check zip files exist)
- Logs output to `/tmp/lambda_deploy.log`

### 6. Enhanced Final Summary (Lines 213-245)
**Before:**
- Simple "Deployment Complete" with 3 next steps

**After:**
- Detailed deployed resources list:
  - AWS Organization with 4 customer accounts
  - Aurora Serverless v2 PostgreSQL database
  - DynamoDB tables for metrics and events
  - Lambda functions for API operations
  - API Gateway REST API
  - RDS Proxy for connection pooling
- Enhanced next steps (5 items):
  1. Test API endpoints
  2. Review database schema
  3. Deploy Phase 3a Portal UI
  4. Configure Stripe for billing
  5. Set up CloudWatch monitoring
- Documentation links:
  - PHASE2_DEPLOYMENT_DETAILED.md
  - API_REFERENCE.md
  - docs/PAAS_ARCHITECTURE.md

## Deployment Flow

```
┌─────────────────────────────────────────────────┐
│ Step 1-5: Prerequisites & Terraform Planning   │
│ (Unchanged from original)                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Step 6: Terraform Apply                         │
│ Deploys: Phase 1 + Phase 2 Infrastructure      │
│ • AWS Organizations                             │
│ • Aurora PostgreSQL Cluster                     │
│ • DynamoDB Tables                               │
│ • Lambda Functions (placeholder)                │
│ • API Gateway                                   │
│ • RDS Proxy                                     │
│ • Secrets Manager                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Step 7: Initialize Database                     │
│ • Create schema with RLS                        │
│ • Create app roles                              │
│ • Store credentials in Secrets Manager          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Step 8: Package Lambda Functions                │
│ • Create deployment zips                        │
│ • Bundle dependencies                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Step 9: Deploy Lambda Code                      │
│ • Upload function packages                      │
│ • Update Lambda functions                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Complete: Phase 1 + Phase 2 Deployed            │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Graceful Degradation
All Phase 2 steps include error handling and fallback instructions. If automated steps fail, users receive clear manual commands.

### 2. Idempotency
Steps can be re-run safely:
- Database initialization handles existing schemas
- Lambda packaging overwrites old zips
- Terraform apply is idempotent

### 3. Separate Terraform Applies
The script runs two Terraform applies:
1. **Initial apply**: Deploys all infrastructure (Phase 1 + Phase 2)
2. **Targeted apply**: Updates Lambda functions after packaging

This ensures Lambda code is uploaded after packaging is complete.

### 4. Directory Navigation Safety
All `cd` commands include error handling with fallback to the Terraform directory, preventing script failures from directory navigation issues.

### 5. Logging
All Phase 2 steps log to `/tmp/` for troubleshooting:
- `/tmp/db_init.log` - Database initialization
- `/tmp/lambda_package.log` - Lambda packaging
- `/tmp/lambda_deploy.log` - Lambda deployment

## Testing Recommendations

Before running in production:

1. **Dry-run mode**: Test the script logic without actual deployment
2. **Check prerequisites**:
   - Terraform >= 1.5.0 installed
   - AWS CLI configured with valid credentials
   - `psql` client installed (for database initialization)
   - `jq` installed (for JSON parsing in init_database.sh)
3. **Verify file structure**:
   - `phase2-backend/database/init_database.sh` exists
   - `phase2-backend/functions/package-lambda.sh` exists
   - Terraform modules are properly configured

## Rollback Plan

If deployment fails:
1. Review logs in `/tmp/db_init.log`, `/tmp/lambda_package.log`, `/tmp/lambda_deploy.log`
2. Manual initialization is possible at each step:
   - Database: `cd phase2-backend/database && ./init_database.sh dev`
   - Lambda: `cd phase2-backend/functions && ./package-lambda.sh`
   - Deploy: `cd landing-zone/environments/dev && terraform apply`

## Future Enhancements

Potential improvements for future iterations:
1. Add Phase 3a Portal deployment
2. Add health checks after each phase
3. Add automatic API endpoint testing
4. Add Stripe configuration prompts
5. Add CloudWatch dashboard creation
6. Add automated rollback on failure

## Conclusion

The updated `DEPLOY_NOW.sh` script now provides a **complete, automated deployment** of SecureBase Phases 1 and 2, transforming the platform from a basic AWS Landing Zone into a **fully functional multi-tenant PaaS** with database, API, and serverless backend.
