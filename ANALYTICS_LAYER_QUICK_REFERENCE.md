# Analytics Lambda Layer - Quick Reference

## Quick Verification

```bash
# Verify Analytics Lambda layer in dev environment
./scripts/verify-analytics-layer.sh

# Verify in specific environment
./scripts/verify-analytics-layer.sh staging us-east-1
./scripts/verify-analytics-layer.sh prod us-west-2
```

## What Gets Verified

✅ AWS credentials are valid  
✅ Lambda layer exists in AWS (`securebase-{env}-reporting`)  
✅ Layer is attached to `analytics-reporter` function  
✅ Layer is attached to `report-engine` function  
✅ ReportLab library is available in layer  
✅ openpyxl library is available in layer  
✅ Pillow (PIL) library is available in layer  
✅ PDF generation works correctly  
✅ Excel generation works correctly  
✅ Terraform configuration is aligned with deployed layer

## Build and Publish Layer

```bash
# Build the layer locally
cd phase2-backend/layers/reporting
./build-layer.sh

# Publish to AWS
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --description "ReportLab + openpyxl for Phase 4 Analytics" \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11 \
  --region us-east-1
```

## Run Tests

```bash
# Test layer dependencies locally
pytest tests/integration/test_analytics_layer.py -v

# Test specific functionality
pytest tests/integration/test_analytics_layer.py::TestAnalyticsLayer::test_pdf_generation_with_reportlab -v
pytest tests/integration/test_analytics_layer.py::TestAnalyticsLayer::test_excel_generation_with_openpyxl -v

# Test performance
pytest tests/integration/test_analytics_layer.py::TestLayerPerformance -v
```

## Pre-Deployment Checklist

```bash
# 1. Validate all Phase 4 deployment artifacts
./VALIDATE_PHASE4_DEPLOYMENT.sh

# 2. Build Lambda functions
cd phase2-backend/functions
./package-lambda.sh

# 3. Build Lambda layer
cd ../layers/reporting
./build-layer.sh

# 4. Deploy infrastructure
cd ../../../landing-zone/environments/dev
terraform apply

# 5. Verify deployment
cd ../../../../
./scripts/verify-analytics-layer.sh dev us-east-1
```

## Troubleshooting

### Layer Not Found
```bash
# Build and publish layer
cd phase2-backend/layers/reporting
./build-layer.sh
aws lambda publish-layer-version \
  --layer-name securebase-dev-reporting \
  --zip-file fileb://reporting-layer.zip \
  --compatible-runtimes python3.11
```

### Layer Not Attached
```bash
# Update Terraform with layer ARN
# Add to landing-zone/environments/dev/terraform.tfvars:
reporting_layer_arn = "arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1"

# Apply Terraform
cd landing-zone/environments/dev
terraform apply
```

### Import Errors in Lambda
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/securebase-dev-analytics-reporter --since 5m

# Verify layer attachment
aws lambda get-function-configuration \
  --function-name securebase-dev-analytics-reporter \
  --query 'Layers'

# Re-verify
./scripts/verify-analytics-layer.sh
```

## Expected Output

Successful verification shows:

```
╔════════════════════════════════════════════════════════╗
║   Verification Summary                                 ║
╚════════════════════════════════════════════════════════╝

Total Checks:   15
Passed:         15
Failed:         0
Warnings:       0

✅ VERIFICATION PASSED

The Analytics Lambda layer is properly attached and functional!

Layer Details:
  Name:    securebase-dev-reporting
  ARN:     arn:aws:lambda:us-east-1:123456789012:layer:securebase-dev-reporting:1
  Version: 1
```

## Related Documentation

- **Full Verification Guide**: [docs/ANALYTICS_LAYER_VERIFICATION.md](docs/ANALYTICS_LAYER_VERIFICATION.md)
- **Analytics Guide**: [PHASE4_ANALYTICS_GUIDE.md](PHASE4_ANALYTICS_GUIDE.md)
- **Deployment Instructions**: [PHASE4_DEPLOYMENT_INSTRUCTIONS.md](PHASE4_DEPLOYMENT_INSTRUCTIONS.md)
- **AWS Lambda Layers**: https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html

## Key Files

| File | Purpose |
|------|---------|
| `scripts/verify-analytics-layer.sh` | Automated verification script |
| `tests/integration/test_analytics_layer.py` | Integration tests for layer |
| `phase2-backend/layers/reporting/build-layer.sh` | Build script for layer |
| `phase2-backend/layers/reporting/requirements.txt` | Layer dependencies |
| `landing-zone/modules/analytics/lambda.tf` | Lambda function definitions |
| `landing-zone/environments/dev/terraform.tfvars` | Layer ARN configuration |

---

**Last Updated**: 2026-01-28  
**Version**: 1.0.0
