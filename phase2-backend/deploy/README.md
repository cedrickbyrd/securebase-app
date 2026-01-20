# Lambda Function Deployment Package

This directory contains the deployment package for the `report_engine` Lambda function.

## File Structure

```
deploy/
└── report_engine.zip     # Lambda deployment package (created by package-lambda.sh)
```

## Building the Package

### Option 1: Using the Script
```bash
cd ../functions
chmod +x package-lambda.sh
./package-lambda.sh
```

### Option 2: Manual Build
```bash
cd ../functions
zip -j ../deploy/report_engine.zip report_engine.py
```

## Package Contents

The deployment package contains:
- `report_engine.py` - Main Lambda handler

**Note:** boto3 and other AWS SDK packages are already included in the Lambda Python 3.11 runtime, so they don't need to be packaged.

## Dependencies

External libraries (ReportLab, openpyxl) are provided via a Lambda Layer:
- See `../layers/reporting/` for layer build instructions
- Layer must be published to AWS before deploying the function

## Deployment

After building the package:

1. **Upload to Lambda (AWS CLI):**
```bash
aws lambda update-function-code \
  --function-name securebase-dev-report-engine \
  --zip-file fileb://report_engine.zip \
  --region us-east-1
```

2. **Deploy via Terraform (Recommended):**
```bash
cd ../../../landing-zone
terraform apply
```

## Package Size

- **Expected Size:** ~15KB (just the Python file)
- **Lambda Limit:** 50MB (zipped), 250MB (unzipped)
- **Layer Size:** ~30MB (ReportLab + openpyxl)

## Verification

After deployment, verify the function:
```bash
aws lambda get-function \
  --function-name securebase-dev-report-engine \
  --region us-east-1
```

Test invoke:
```bash
aws lambda invoke \
  --function-name securebase-dev-report-engine \
  --payload '{"httpMethod":"GET","path":"/analytics"}' \
  response.json

cat response.json
```
