# Production API Validation Tests

This directory contains production validation tests for SecureBase API endpoints.

## Analytics API Validator

The `validate_analytics_api.py` script validates that the Analytics component API endpoints are operational after deployment to production or staging environments.

### Features

- **Endpoint Health Checks**: Validates API connectivity and availability
- **Analytics Endpoints**: Tests all analytics GET endpoints
- **Report Endpoints**: Validates report management endpoints
- **Performance Testing**: Measures response times against SLA (500ms p95)
- **CORS Validation**: Checks CORS headers configuration
- **Error Handling**: Validates proper error responses
- **JSON Output**: Optional JSON output for CI/CD integration

### Usage

#### Basic Usage

```bash
# Validate production (uses default URL)
python validate_analytics_api.py --env production

# Validate staging
python validate_analytics_api.py --env staging

# Verbose output
python validate_analytics_api.py --env production --verbose
```

#### With Environment Variables

```bash
# Set environment variables
export API_BASE_URL=https://api.securebase.com/v1
export TEST_API_KEY=your-api-key-here
export TEST_CUSTOMER_ID=customer-123

# Run validation
python validate_analytics_api.py --env production
```

#### With Command-Line Arguments

```bash
# Override URL and API key via arguments
python validate_analytics_api.py \
  --env staging \
  --api-url https://staging-api.securebase.com/v1 \
  --api-key test-key-123 \
  --verbose

# Generate JSON output for CI/CD
python validate_analytics_api.py \
  --env production \
  --json-output results.json
```

#### Quick Local Testing

```bash
# Test local development server (no auth)
python validate_analytics_api.py --api-url http://localhost:3000/api
```

### Environment-Specific Defaults

The script uses these default API URLs when not specified:

- **Production**: `https://api.securebase.com/v1`
- **Staging**: `https://staging-api.securebase.com/v1`
- **Dev**: `https://api-dev.securebase.example.com`

### Validated Endpoints

The following Analytics API endpoints are validated:

#### Analytics Endpoints
- `GET /analytics` - Main analytics endpoint
- `GET /analytics/summary` - Summary statistics
- `GET /analytics/cost-breakdown` - Cost breakdown by dimension
- `GET /analytics/security` - Security analytics
- `GET /analytics/compliance` - Compliance analytics
- `GET /analytics/usage` - Usage analytics

#### Report Endpoints
- `GET /reports` - List saved reports

#### Error Handling
- `GET /analytics/invalid-endpoint` - 404 error handling

#### Security & Performance
- `OPTIONS /analytics` - CORS configuration (warning only)
- Performance: P95 latency measurement (warning if > 500ms)

**Note**: CORS validation and performance checks generate warnings, not failures, to allow flexibility in different deployment environments.

### Test Results

The script provides three result statuses:

- **PASS (✓)**: Test passed successfully
- **WARN (⚠)**: Test passed with warnings (e.g., endpoint not yet deployed)
- **FAIL (✗)**: Test failed (requires attention)
- **SKIP (○)**: Test skipped

### Performance Requirements

- **Response Time SLA**: P95 latency < 500ms
- **Availability**: Endpoints must be reachable
- **CORS**: Proper CORS headers configured

### CI/CD Integration

#### GitHub Actions Example

```yaml
- name: Validate Analytics API
  run: |
    python tests/production/validate_analytics_api.py \
      --env production \
      --api-url ${{ secrets.API_BASE_URL }} \
      --api-key ${{ secrets.TEST_API_KEY }} \
      --json-output validation-results.json

- name: Upload Results
  uses: actions/upload-artifact@v4
  with:
    name: validation-results
    path: validation-results.json
```

#### Exit Codes

- `0`: All tests passed (warnings are acceptable)
- `1`: One or more tests failed
- `130`: User interrupted (Ctrl+C)

**Note**: Warnings (e.g., performance below SLA, endpoints not deployed yet) do not cause a failure exit code. Only critical failures (unreachable endpoints, unexpected errors) result in exit code 1.

### JSON Output Format

When using `--json-output`, the script generates a structured JSON report:

```json
{
  "timestamp": "2026-01-28T13:54:00.000Z",
  "environment": "production",
  "api_url": "https://api.securebase.com/v1",
  "summary": {
    "total": 12,
    "passed": 10,
    "failed": 0,
    "warnings": 2,
    "skipped": 0
  },
  "results": [
    {
      "endpoint": "/analytics",
      "method": "GET",
      "status": "PASS",
      "message": "API endpoint reachable (HTTP 401)",
      "duration_ms": 123.45,
      "response_code": 401
    }
  ]
}
```

### Dependencies

```bash
pip install requests
```

Or install from project requirements:

```bash
pip install -r tests/requirements.txt
```

### Troubleshooting

#### API Unreachable
```
✗ GET /analytics: API endpoint unreachable
```
**Solution**: Check that the API URL is correct and the service is running.

#### All Tests Show 404
```
⚠ GET /analytics: Endpoint not found - may not be deployed yet
```
**Solution**: Ensure the Analytics component has been deployed to the environment.

#### Performance Below SLA
```
⚠ GET /analytics/summary: Performance below SLA: p95=750.00ms exceeds 500ms
```
**Solution**: Investigate API performance issues, check database query optimization, or review infrastructure capacity.

#### Authentication Failures
```
✗ GET /analytics: Unauthorized
```
**Solution**: Provide a valid API key via `--api-key` or `TEST_API_KEY` environment variable.

### Post-Deployment Checklist

Use this validator as part of your post-deployment verification:

- [ ] Run validation against staging before production
- [ ] Ensure all endpoints return 200 or 401 (not 404)
- [ ] Verify performance meets SLA (p95 < 500ms)
- [ ] Check CORS headers are configured
- [ ] Confirm error handling returns proper HTTP codes
- [ ] Save JSON output for audit trail

### Support

For issues or questions:
- Check the main project documentation
- Review API deployment logs
- Contact the DevOps team
