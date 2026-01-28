# Phase 4 Analytics API Validation Guide

**Last Updated:** 2026-01-28  
**Component:** Phase 4 - Advanced Analytics & Reporting  
**Author:** AI Coding Agent

---

## Overview

This guide provides comprehensive documentation for validating the Phase 4 Analytics API endpoints. It covers validation methodology, test cases, expected results, and troubleshooting procedures.

---

## Table of Contents

1. [Validation Script](#validation-script)
2. [Test Categories](#test-categories)
3. [Running Validation](#running-validation)
4. [Interpreting Results](#interpreting-results)
5. [Production Deployment Checklist](#production-deployment-checklist)
6. [Troubleshooting](#troubleshooting)
7. [API Endpoint Reference](#api-endpoint-reference)

---

## Validation Script

### Location
`scripts/validate_analytics_api.sh`

### Features
- **Comprehensive Testing**: 22+ test cases across 7 categories
- **Automated Execution**: Single command validation of all endpoints
- **Detailed Reporting**: Generates markdown report with results
- **Color-Coded Output**: Easy-to-read console output
- **Environment Support**: Works with dev, staging, and production

### Requirements
- `curl` - HTTP client
- `jq` - JSON processor
- Bash 4.0 or higher

---

## Test Categories

### 1. Pre-Validation Checks
- **Tool Availability**: Verifies curl and jq are installed
- **API Accessibility**: Checks if base URL is reachable
- **Credentials**: Validates API key and customer ID configuration

### 2. Authentication Validation
- **Valid Authentication**: Tests successful authentication with valid credentials
- **Invalid Token Rejection**: Ensures invalid tokens are rejected (401/403)
- **Missing Auth Rejection**: Verifies endpoints require authentication
- **JWT Token Generation**: Validates session token creation

### 3. Analytics Endpoints
All endpoints tested with proper authentication:

#### GET /analytics/usage
- Returns usage metrics (API calls, storage, compute, data transfer)
- Supports period parameter (7d, 30d, 90d, 12m)
- Response includes customer_id, period, metrics object

#### GET /analytics/compliance
- Returns compliance metrics and scores
- Includes compliance status by framework (HIPAA, SOC2, etc.)
- Historical trend data

#### GET /analytics/costs
- Returns cost breakdown by service, region, account
- Includes total costs and cost trends
- Supports filtering and aggregation

#### POST /analytics/reports
- Creates custom analytics reports
- Accepts report configuration (type, period, format)
- Returns report_id for retrieval

### 4. Data Response Quality
- **Required Fields**: Validates presence of essential data fields
- **Data Types**: Ensures correct data types (numbers, strings, arrays)
- **Time Period Accuracy**: Validates different period parameters (7d, 30d, 90d)
- **Data Completeness**: Checks for null or missing critical data

### 5. Performance Validation
- **Response Time**: < 5s for p95 queries (< 10s acceptable)
- **Latency Measurement**: Tracks response time for all endpoints
- **Throughput**: Validates API can handle expected load

### 6. Error Handling
- **Invalid Parameters**: Tests with invalid period, malformed JSON
- **Missing Required Fields**: Validates required parameter enforcement
- **Non-existent Endpoints**: Returns proper 404 responses
- **Error Messages**: Clear, actionable error responses

### 7. Security & CORS
- **CORS Preflight**: OPTIONS requests properly handled
- **Security Headers**: X-Content-Type-Options, HSTS, X-Frame-Options
- **Authentication Headers**: Bearer token validation
- **Rate Limiting**: (Future) Rate limit headers present

---

## Running Validation

### Basic Usage

```bash
# Run with default dev environment
./scripts/validate_analytics_api.sh

# Specify environment
./scripts/validate_analytics_api.sh staging

# With custom API URL
API_BASE_URL=https://api.securebase.io ./scripts/validate_analytics_api.sh prod
```

### With Authentication

```bash
# Set environment variables for real API testing
export TEST_API_KEY="sb_ABC123DEF456_..."
export TEST_CUSTOMER_ID="cust-550e8400-e29b-41d4-a716-446655440000"
export API_BASE_URL="https://api.securebase.io"

# Run validation
./scripts/validate_analytics_api.sh prod
```

### Verbose Mode

```bash
# Enable verbose output with detailed responses
VERBOSE=true ./scripts/validate_analytics_api.sh dev
```

### Output

The script generates:
1. **Console Output**: Color-coded real-time test results
2. **Results File**: `PHASE4_API_VALIDATION_RESULTS_YYYYMMDD_HHMMSS.md`
   - Executive summary
   - Detailed test results
   - Pass/fail statistics
   - Recommendations

---

## Interpreting Results

### Test Statuses

#### ✅ PASS
- Test completed successfully
- Endpoint behaving as expected
- No action required

#### ❌ FAIL
- Critical test failure
- Endpoint not functioning correctly
- **Action Required**: Fix before production deployment

#### ⚠️ WARN
- Non-critical issue detected
- May be expected in test/dev environments
- Review context before ignoring

### Pass Rate Calculation

```
Pass Rate = (Passed Tests / Total Tests) × 100
```

**Acceptance Criteria:**
- **Production**: ≥95% pass rate (max 1 failure)
- **Staging**: ≥90% pass rate
- **Development**: ≥80% pass rate (warnings acceptable)

### Common Warning Scenarios

#### "API endpoint not reachable"
- **Cause**: Testing against mock/local infrastructure
- **Action**: Expected in dev; fix for staging/prod

#### "Using API key for subsequent tests"
- **Cause**: Auth endpoint returned non-standard response
- **Action**: Verify JWT generation in production

#### "Response missing 'metrics' field"
- **Cause**: Endpoint not fully implemented or empty data
- **Action**: Verify database populated with test data

#### "CORS may not be configured"
- **Cause**: OPTIONS requests not returning expected headers
- **Action**: Configure CORS in API Gateway

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All critical tests passing (✅ PASS)
- [ ] Pass rate ≥95%
- [ ] API Gateway deployed and configured
- [ ] Lambda functions deployed
- [ ] DynamoDB tables created and populated
- [ ] Authentication configured (JWT authorizer)
- [ ] CORS enabled for production domain
- [ ] Security headers configured
- [ ] CloudWatch alarms configured
- [ ] Rate limiting enabled

### Deployment Validation

1. **Deploy to Staging**
   ```bash
   # Deploy infrastructure
   cd landing-zone/environments/staging
   terraform apply
   
   # Run validation
   export API_BASE_URL="https://api-staging.securebase.io"
   export TEST_API_KEY="<staging-api-key>"
   ./scripts/validate_analytics_api.sh staging
   ```

2. **Review Results**
   - Verify pass rate ≥95%
   - Address any failures
   - Document warnings

3. **Deploy to Production**
   ```bash
   # Deploy infrastructure
   cd landing-zone/environments/prod
   terraform apply
   
   # Run validation
   export API_BASE_URL="https://api.securebase.io"
   export TEST_API_KEY="<production-api-key>"
   ./scripts/validate_analytics_api.sh prod
   ```

4. **Monitor**
   - Check CloudWatch metrics
   - Review error logs
   - Verify alarm status

### Post-Deployment

- [ ] All endpoints returning 200 responses
- [ ] Authentication working with production credentials
- [ ] Data responses accurate and complete
- [ ] Performance within SLA (<5s p95)
- [ ] No errors in CloudWatch logs
- [ ] Alarms configured and silent (no alerts)

---

## Troubleshooting

### Issue: "Command not found: jq"

**Solution:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Amazon Linux
sudo yum install jq
```

### Issue: "API endpoint not accessible"

**Diagnosis:**
```bash
# Check DNS resolution
nslookup api.securebase.io

# Test direct connectivity
curl -v https://api.securebase.io

# Check API Gateway deployment
aws apigatewayv2 get-apis --query 'Items[?Name==`securebase-prod-api`]'
```

**Common Causes:**
1. API Gateway not deployed
2. DNS not configured
3. Security group blocking traffic
4. VPC endpoint misconfigured

### Issue: "401 Unauthorized" for all endpoints

**Diagnosis:**
```bash
# Verify API key format
echo $TEST_API_KEY

# Test authentication endpoint directly
curl -X POST https://api.securebase.io/auth/authenticate \
  -H "Authorization: Bearer $TEST_API_KEY"
```

**Common Causes:**
1. Invalid API key
2. API key expired or rotated
3. JWT authorizer misconfigured
4. Customer account suspended

### Issue: "Empty or null responses"

**Diagnosis:**
```bash
# Check Lambda function logs
aws logs tail /aws/lambda/securebase-prod-analytics-query --follow

# Verify DynamoDB data
aws dynamodb scan --table-name securebase-prod-metrics --limit 10
```

**Common Causes:**
1. Lambda function errors
2. Database empty (no metrics data)
3. RLS policy blocking access
4. Invalid customer_id

### Issue: "Slow response times (>5s)"

**Diagnosis:**
```bash
# Check Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=securebase-prod-analytics-query \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Common Causes:**
1. Lambda cold starts
2. DynamoDB read capacity throttling
3. Inefficient queries (missing indexes)
4. Large dataset without pagination

---

## API Endpoint Reference

### Base URL

**Production:** `https://api.securebase.io`  
**Staging:** `https://api-staging.securebase.io`  
**Development:** `https://api-dev.securebase.io`

### Authentication

All endpoints require Bearer token authentication:

```bash
Authorization: Bearer <api-key or jwt-token>
```

### Endpoints

#### GET /analytics/usage

**Description:** Retrieve usage analytics metrics

**Query Parameters:**
- `customer_id` (optional if in JWT): Customer UUID
- `period` (optional, default: 30d): Time period (7d, 30d, 90d, 12m)

**Example Request:**
```bash
curl -X GET "https://api.securebase.io/analytics/usage?period=30d" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response:**
```json
{
  "customer_id": "cust-550e8400-e29b-41d4-a716-446655440000",
  "period": "30d",
  "metrics": {
    "api_calls": 125000,
    "storage_gb": 450.5,
    "compute_hours": 720,
    "data_transfer_gb": 125.2
  },
  "trends": {
    "api_calls_change": 12.5,
    "storage_change": -3.2
  }
}
```

#### GET /analytics/compliance

**Description:** Retrieve compliance metrics and scores

**Query Parameters:**
- `customer_id` (optional if in JWT): Customer UUID
- `period` (optional, default: 30d): Time period
- `framework` (optional): Filter by framework (HIPAA, SOC2, etc.)

**Example Response:**
```json
{
  "customer_id": "cust-550e8400-e29b-41d4-a716-446655440000",
  "period": "30d",
  "compliance_score": 95.5,
  "frameworks": {
    "HIPAA": 96.0,
    "SOC2": 95.0
  },
  "violations": 3,
  "findings": [...]
}
```

#### GET /analytics/costs

**Description:** Retrieve cost breakdown and analysis

**Query Parameters:**
- `customer_id` (optional if in JWT): Customer UUID
- `period` (optional, default: 30d): Time period
- `dimension` (optional): Group by (service, region, account)

**Example Response:**
```json
{
  "customer_id": "cust-550e8400-e29b-41d4-a716-446655440000",
  "period": "30d",
  "total_cost": 8234.56,
  "breakdown": {
    "lambda": 500.00,
    "s3": 250.50,
    "dynamodb": 150.25
  },
  "trend": 5.2
}
```

#### POST /analytics/reports

**Description:** Create custom analytics report

**Request Body:**
```json
{
  "customer_id": "cust-550e8400-e29b-41d4-a716-446655440000",
  "report_type": "usage",
  "period": "30d",
  "format": "json",
  "filters": {...}
}
```

**Example Response:**
```json
{
  "report_id": "rpt-20260128-143000",
  "customer_id": "cust-550e8400-e29b-41d4-a716-446655440000",
  "status": "generating",
  "estimated_completion": "2026-01-28T14:31:00Z"
}
```

---

## Best Practices

### 1. Regular Validation
- Run validation script after any infrastructure changes
- Schedule weekly validation in CI/CD pipeline
- Validate before and after production deployments

### 2. Environment Parity
- Keep dev, staging, prod configurations similar
- Use same validation script across all environments
- Document environment-specific differences

### 3. Test Data
- Populate test databases with realistic data
- Use different customer IDs for multi-tenancy testing
- Include edge cases (empty data, large datasets)

### 4. Monitoring
- Set up CloudWatch alarms for endpoint failures
- Monitor response times continuously
- Track API usage patterns

### 5. Documentation
- Keep this guide updated with new endpoints
- Document any environment-specific configurations
- Record validation results for compliance

---

## Related Documentation

- [PHASE4_STATUS.md](../PHASE4_STATUS.md) - Overall Phase 4 status
- [PHASE4_ANALYTICS_GUIDE.md](../PHASE4_ANALYTICS_GUIDE.md) - Analytics component guide
- [API_REFERENCE.md](../API_REFERENCE.md) - Complete API reference
- [PHASE4_TESTING_GUIDE.md](../PHASE4_TESTING_GUIDE.md) - Testing strategy

---

## Changelog

### 2026-01-28
- Initial version created
- Added comprehensive validation script
- Documented all test categories
- Added troubleshooting guide

---

**Document Version:** 1.0.0  
**Last Reviewed:** 2026-01-28  
**Next Review:** 2026-02-28
