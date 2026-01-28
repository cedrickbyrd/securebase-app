# Analytics Lambda Layer Verification Guide

## Overview

This guide explains how to verify that the Analytics Lambda layer (containing ReportLab and openpyxl dependencies) is properly attached to Lambda functions and functioning correctly in AWS.

## What is the Analytics Lambda Layer?

The Analytics Lambda layer is a packaged set of Python libraries required for advanced report generation in Phase 4 Analytics:

- **ReportLab 4.0.7**: PDF generation library for creating formatted analytics reports
- **openpyxl 3.1.2**: Excel file generation library for creating XLSX reports
- **Pillow 10.1.0**: Image processing library for PDF image support

### Layer Contents

```
reporting-layer.zip
└── python/
    └── lib/
        └── python3.11/
            └── site-packages/
                ├── reportlab/       # PDF generation
                ├── openpyxl/        # Excel generation
                └── PIL/             # Image support
```

## Lambda Functions Using the Layer

Two Lambda functions require the reporting layer:

1. **analytics-reporter** (`analytics_reporter.py`)
   - Generates on-demand and scheduled analytics reports
   - Supports CSV, JSON, PDF, and Excel formats
   - Requires ReportLab for PDF, openpyxl for Excel

2. **report-engine** (`report_engine.py`)
   - Legacy report generation function
   - Maintained for backwards compatibility
   - Also requires ReportLab and openpyxl

## Verification Methods

### Method 1: Automated Script (Recommended)

Use the automated verification script to check all aspects of the layer:

```bash
# Basic verification (dev environment)
./scripts/verify-analytics-layer.sh

# Verify specific environment
./scripts/verify-analytics-layer.sh staging us-east-1

# Verify production
./scripts/verify-analytics-layer.sh prod us-west-2
```

The script performs the following checks:
1. ✅ AWS credentials validation
2. ✅ Lambda layer exists in AWS
3. ✅ Layer is attached to required functions
4. ✅ Layer dependencies are available (ReportLab, openpyxl)
5. ✅ PDF generation functional test
6. ✅ Excel generation functional test
7. ✅ Terraform configuration alignment
8. ✅ Local layer package validation

### Method 2: Manual AWS Console Verification

#### Step 1: Check Layer Exists

1. Open AWS Lambda console
2. Navigate to **Layers** in the left sidebar
3. Search for `securebase-{env}-reporting`
4. Verify the layer exists with recent version

#### Step 2: Check Layer Attachment

1. Navigate to **Functions**
2. Open `securebase-{env}-analytics-reporter`
3. Scroll to **Layers** section
4. Verify `securebase-{env}-reporting` is listed
5. Repeat for `securebase-{env}-report-engine`

#### Step 3: Test Layer Functionality

1. Open the Lambda function
2. Go to the **Test** tab
3. Create a test event for PDF generation:

```json
{
  "httpMethod": "POST",
  "body": "{\"type\": \"monthly\", \"format\": \"pdf\", \"period\": \"30d\"}",
  "requestContext": {
    "authorizer": {
      "customerId": "test-customer-123"
    }
  }
}
```

4. Click **Test**
5. Check execution results:
   - ✅ Success (200): Layer is working
   - ❌ ImportError: Layer not attached or missing dependencies

### Method 3: Integration Tests

Run the automated test suite:

```bash
# Run layer-specific tests
pytest tests/integration/test_analytics_layer.py -v

# Run all analytics tests
pytest tests/integration/test_analytics_integration.py -v
```

#### Key Tests

1. **test_reportlab_import**: Verifies ReportLab can be imported
2. **test_openpyxl_import**: Verifies openpyxl can be imported
3. **test_pdf_generation_with_reportlab**: Tests PDF generation
4. **test_excel_generation_with_openpyxl**: Tests Excel generation
5. **test_layer_dependencies_versions**: Validates library versions

### Method 4: AWS CLI Verification

```bash
# Check layer exists
aws lambda list-layer-versions \
  --layer-name securebase-dev-reporting \
  --region us-east-1

# Get layer details
aws lambda get-layer-version \
  --layer-name securebase-dev-reporting \
  --version-number 1 \
  --region us-east-1

# Check function configuration
aws lambda get-function-configuration \
  --function-name securebase-dev-analytics-reporter \
  --region us-east-1 \
  --query 'Layers'

# Test function invocation
aws lambda invoke \
  --function-name securebase-dev-analytics-reporter \
  --payload file://test-event.json \
  --region us-east-1 \
  response.json

# Check logs for import errors
aws logs tail /aws/lambda/securebase-dev-analytics-reporter \
  --since 5m \
  --follow
```

## Building the Layer

If the layer needs to be rebuilt:

```bash
cd phase2-backend/layers/reporting

# Build the layer
./build-layer.sh

# Publish to AWS
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

This will output a Layer Version ARN that needs to be added to `terraform.tfvars`:

```hcl
reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1"
```

## Deployment Process

### 1. Pre-Deployment Validation

```bash
# Run validation script
./VALIDATE_PHASE4_DEPLOYMENT.sh

# Expected output:
# ✅ Lambda layer package
# ✅ reporting-layer.zip contains ReportLab
# ✅ reporting-layer.zip contains openpyxl
```

### 2. Deploy Infrastructure

```bash
cd landing-zone/environments/dev

# Ensure layer ARN is configured
grep reporting_layer_arn terraform.tfvars

# Deploy
terraform plan
terraform apply
```

### 3. Post-Deployment Verification

```bash
# Automated verification
./scripts/verify-analytics-layer.sh dev us-east-1

# Expected output:
# ✅ Lambda layer found
# ✅ Layer attached to analytics-reporter
# ✅ Layer attached to report-engine
# ✅ PDF generation test successful
# ✅ Excel generation test successful
```

## Troubleshooting

### Layer Not Found

**Symptom**: Script reports "Lambda layer not found in AWS"

**Solution**:
```bash
cd phase2-backend/layers/reporting
./build-layer.sh
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11
```

### Layer Not Attached

**Symptom**: "Layer NOT attached to function"

**Solution**:
1. Update `terraform.tfvars` with correct layer ARN
2. Run `terraform apply` to attach layer
3. Verify with `aws lambda get-function-configuration`

### ImportError in Lambda Logs

**Symptom**: `ModuleNotFoundError: No module named 'reportlab'`

**Causes**:
1. Layer not attached to function
2. Layer built for wrong Python version
3. Layer uploaded to wrong region

**Solution**:
```bash
# Rebuild layer with correct Python version
cd phase2-backend/layers/reporting
python3.11 -m pip install -r requirements.txt -t python/lib/python3.11/site-packages
zip -r reporting-layer.zip python/

# Re-publish
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11
```

### PDF/Excel Generation Returns Fallback

**Symptom**: PDF returns text instead of formatted PDF, Excel returns CSV

**Cause**: Lambda function gracefully falls back when layer libraries are unavailable

**Solution**:
1. Verify layer is attached: `./scripts/verify-analytics-layer.sh`
2. Check CloudWatch logs for import errors
3. Ensure layer ARN is correct in Terraform configuration

### Layer Size Too Large

**Symptom**: Layer exceeds AWS limits (250MB uncompressed)

**Solution**:
```bash
# Check layer size
du -sh phase2-backend/layers/reporting/reporting-layer.zip

# Reduce size by removing unnecessary files
cd phase2-backend/layers/reporting/python/lib/python3.11/site-packages
find . -type d -name "__pycache__" -exec rm -r {} +
find . -type d -name "tests" -exec rm -r {} +
find . -type d -name "*.dist-info" -exec rm -r {} +

# Rebuild layer
cd ../../..
zip -r reporting-layer.zip python/
```

## Expected Results

### Successful Verification Output

```
╔════════════════════════════════════════════════════════╗
║   Analytics Lambda Layer Verification                 ║
╚════════════════════════════════════════════════════════╝

Environment: dev
Region: us-east-1

━━━ Step 1: Verify AWS Credentials ━━━
✓ AWS credentials valid (Account: 123456789012)

━━━ Step 2: Check Lambda Layer Exists ━━━
✓ Lambda layer found: arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1
  Version: 1
  Size: 8.2M

━━━ Step 3: Verify Layer Attachment to Lambda Functions ━━━
✓ Layer attached to 'securebase-dev-analytics-reporter'
✓ Layer attached to 'securebase-dev-report-engine'

━━━ Step 4: Test Layer Dependencies ━━━
✓ Function invocation successful (dependencies available)
✓ Function invocation successful (dependencies available)

━━━ Step 5: Verify Layer Contents ━━━
✓ Local layer package exists: phase2-backend/layers/reporting/reporting-layer.zip
✓ ReportLab library found in layer
✓ openpyxl library found in layer
✓ Pillow (PIL) library found in layer

━━━ Step 6: Check Terraform Configuration ━━━
✓ reporting_layer_arn configured in terraform.tfvars
✓ Terraform ARN matches deployed layer

━━━ Step 7: Functional Test - PDF Generation ━━━
✓ PDF generation test successful

━━━ Step 8: Functional Test - Excel Generation ━━━
✓ Excel generation test successful

╔════════════════════════════════════════════════════════╗
║   Verification Summary                                 ║
╚════════════════════════════════════════════════════════╝

Total Checks:   15
Passed:         15
Failed:         0
Warnings:       0

✅ VERIFICATION PASSED

The Analytics Lambda layer is properly attached and functional!
```

## Monitoring

### CloudWatch Metrics to Monitor

1. **Lambda Errors**: Filter for ImportError in logs
2. **Function Duration**: PDF/Excel generation should complete in < 5s
3. **Memory Usage**: Layer adds ~100MB memory overhead
4. **Cold Start Time**: First invocation may take 2-3s longer

### CloudWatch Insights Queries

Check for layer-related errors:
```
fields @timestamp, @message
| filter @message like /ImportError|ModuleNotFoundError/
| filter @message like /reportlab|openpyxl/
| sort @timestamp desc
| limit 20
```

Check PDF generation performance:
```
fields @timestamp, @duration
| filter @message like /PDF generation/
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
```

## References

- [AWS Lambda Layers Documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [ReportLab Documentation](https://www.reportlab.com/documentation/)
- [openpyxl Documentation](https://openpyxl.readthedocs.io/)
- Phase 4 Analytics Architecture: `docs/PAAS_ARCHITECTURE.md`
- Deployment Guide: `PHASE4_DEPLOYMENT_INSTRUCTIONS.md`

## Version History

- **1.0.0** (2026-01-28): Initial verification guide created
  - Added automated verification script
  - Added integration tests
  - Added troubleshooting section
