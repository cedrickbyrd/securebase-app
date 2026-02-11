# Demo Counter Infrastructure

## Overview

This directory contains the infrastructure code for the demo customer rotation backend counter system. This is an **optional enhancement** to the time-based rotation system.

## Architecture

### Components

1. **DynamoDB Table**: `demo-visitor-counter`
   - Single item with atomic counter
   - On-demand billing mode
   - Cost: ~$0.25/month for typical demo traffic

2. **Lambda Function**: `demo-get-customer-index`
   - Runtime: Python 3.11
   - Memory: 128 MB (minimum)
   - Timeout: 3 seconds
   - Cold starts acceptable for demo use
   - Cost: ~$0.10/month for typical demo traffic

3. **API Gateway**: HTTP API
   - Endpoint: `GET /demo/customer-index`
   - Cheaper than REST API
   - No authentication required (public demo endpoint)
   - Cost: ~$0.15/month for typical demo traffic

### Total Cost Estimate
**$0.50-1.00/month** for typical demo traffic (100-500 visitors/day)

## Deployment

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform 1.0+ (if using Terraform)
- OR AWS SAM CLI (if using CloudFormation)

### Option 1: Terraform Deployment

```bash
cd infrastructure/demo-counter
terraform init
terraform plan
terraform apply
```

### Option 2: Quick Deploy Script

```bash
cd infrastructure/demo-counter
./deploy.sh
```

The deploy script will:
1. Create DynamoDB table
2. Package Lambda function
3. Deploy Lambda and API Gateway
4. Output API endpoint URL

### Environment Configuration

After deployment, update `.env.demo`:

```env
VITE_DEMO_COUNTER_ENABLED=true
VITE_DEMO_COUNTER_API=https://xxxxx.execute-api.us-east-1.amazonaws.com/demo/customer-index
```

## API Specification

### Endpoint
`GET /demo/customer-index`

### Response
```json
{
  "customerIndex": 2,
  "visitorNumber": 1247
}
```

- `customerIndex`: Integer 0-4 indicating which customer to display
- `visitorNumber`: Total visitor count (for analytics)

### Error Response
```json
{
  "error": "Internal server error",
  "message": "Failed to increment counter"
}
```

## Testing

### Test Lambda Locally
```bash
cd lambda
python get-customer-index.py
```

### Test API Endpoint
```bash
curl https://xxxxx.execute-api.us-east-1.amazonaws.com/demo/customer-index
```

Expected response with incrementing visitor numbers on each call.

## Monitoring

### CloudWatch Metrics
- Lambda invocations
- Lambda errors
- Lambda duration
- API Gateway requests
- DynamoDB read/write units

### Logs
```bash
aws logs tail /aws/lambda/demo-get-customer-index --follow
```

## Rollback

### Disable Backend Counter
Simply update `.env.demo`:
```env
VITE_DEMO_COUNTER_ENABLED=false
```

Frontend will gracefully fall back to time-based rotation.

### Delete Infrastructure
```bash
terraform destroy
# OR
./destroy.sh
```

## Cost Optimization

### Current Settings (Frugal)
- DynamoDB: On-demand (no provisioned capacity)
- Lambda: 128 MB memory (minimum)
- API Gateway: HTTP API (cheaper than REST)
- No CloudFront (direct API Gateway)
- No WAF (demo endpoint, low risk)

### If Costs Exceed Budget
1. Check CloudWatch for unusual traffic
2. Add rate limiting to API Gateway
3. Consider switching back to time-based rotation

## Security Considerations

### Current Implementation
- **Public endpoint**: No authentication required
- **Rate limiting**: None (relies on low traffic)
- **DDoS protection**: AWS Shield Standard (automatic)

### Why This Is Acceptable
- Demo-only endpoint (not production)
- Read-only operation (counter increment)
- No sensitive data exposed
- Low value target for attacks
- Easy to disable if abused

### Future Enhancements (If Needed)
- Add API key authentication
- Implement rate limiting (1 req/sec per IP)
- Add AWS WAF rules
- Use CloudFront with caching

## Maintenance

### Regular Tasks
- **Weekly**: Check CloudWatch for errors
- **Monthly**: Review costs in AWS Cost Explorer
- **Quarterly**: Update Lambda runtime if needed

### No Action Required For
- Scaling (automatic)
- Backups (single counter value)
- Patching (managed by AWS)

## Troubleshooting

### Issue: High Costs
**Solution**: Check for unusual traffic, add rate limiting

### Issue: Lambda Errors
**Solution**: Check CloudWatch logs, verify DynamoDB table exists

### Issue: CORS Errors
**Solution**: Verify API Gateway CORS settings (should allow all origins)

### Issue: Stale Counter
**Solution**: Counter is atomic, no staleness possible. If frontend shows wrong customer, clear sessionStorage.

## Future Enhancements

### Planned (Phase 3)
- Analytics dashboard (visitor stats)
- Geographic distribution tracking
- Peak traffic hours analysis
- A/B testing different rotation intervals

### Possible (Phase 4)
- Multi-region deployment
- Customer preference tracking
- Smart rotation (avoid showing same customer twice in a row globally)
- Integration with marketing automation

## Files in This Directory

- `main.tf` - Terraform infrastructure definition
- `lambda/get-customer-index.py` - Lambda function code
- `deploy.sh` - Quick deployment script
- `destroy.sh` - Infrastructure teardown script
- `README.md` - This file
- `.env.example` - Environment variable template

## Support

For questions or issues:
1. Check CloudWatch logs
2. Review this README
3. Contact DevOps team
4. Fallback: Disable backend counter and use time-based rotation
