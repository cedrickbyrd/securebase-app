# Webhook System - Complete Implementation Guide

## Overview

The SecureBase webhook system enables customers to receive real-time HTTP POST notifications when events occur in their account. Built with enterprise-grade reliability, automatic retries, and cryptographic signature verification.

## Architecture

```
┌─────────────────┐
│  Event Source   │ (Invoice created, ticket updated, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Webhook Trigger │ (Lambda function)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Webhook Manager Lambda             │
│  - Query subscribed webhooks        │
│  - Generate HMAC signature          │
│  - HTTP POST to customer endpoint   │
│  - Log delivery status              │
│  - Schedule retries (if needed)     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│  DynamoDB       │       │  Customer Server │
│  - Webhooks     │       │  (Receives POST) │
│  - Deliveries   │       └──────────────────┘
└─────────────────┘
```

## Infrastructure Components

### 1. DynamoDB Tables

**Webhooks Table**
```
PK: customer_id (String)
SK: id (UUID)
Attributes:
  - url (String) - HTTPS endpoint
  - events (List<String>) - Subscribed events
  - description (String)
  - secret (String) - HMAC secret
  - active (Boolean)
  - created_at (Timestamp)
  - last_triggered_at (Timestamp)
  - delivery_success_count (Number)
  - delivery_failure_count (Number)
```

**Webhook Deliveries Table**
```
PK: customer_id (String)
SK: id (UUID)
GSI: webhook_id-timestamp-index
Attributes:
  - webhook_id (UUID)
  - event_type (String)
  - payload (Map)
  - success (Boolean)
  - status_code (Number)
  - response_body (String, max 1000 chars)
  - timestamp (Timestamp)
  - ttl (Number) - Auto-delete after 30 days
```

### 2. Lambda Functions

**webhook_manager.py**
- Handles CRUD operations for webhooks
- Delivers webhook payloads
- Manages retry logic
- Logs delivery attempts

**Terraform Module**
- Location: `landing-zone/modules/webhooks/`
- Resources: 2 DynamoDB tables, 1 Lambda, IAM roles, API Gateway integration

## API Endpoints

### Create Webhook
```http
POST /v1/webhooks
Authorization: Bearer {session_token}

Request:
{
  "url": "https://your-domain.com/webhook",
  "description": "Production webhook for invoices",
  "events": ["invoice.created", "invoice.paid"]
}

Response (201):
{
  "webhook": {
    "id": "webhook_abc123",
    "url": "https://your-domain.com/webhook",
    "events": ["invoice.created", "invoice.paid"],
    "secret": "whsec_xxxxxxxxxxxxx",  // Only shown once!
    "active": true,
    "created_at": "2026-01-19T12:00:00Z"
  },
  "message": "Webhook created successfully. Save the secret - it will not be shown again."
}
```

### List Webhooks
```http
GET /v1/webhooks
Authorization: Bearer {session_token}

Response (200):
{
  "webhooks": [
    {
      "id": "webhook_abc123",
      "url": "https://your-domain.com/webhook",
      "events": ["invoice.created", "invoice.paid"],
      "description": "Production webhook",
      "active": true,
      "delivery_success_count": 142,
      "delivery_failure_count": 3,
      "last_triggered_at": "2026-01-19T11:30:00Z"
    }
  ],
  "count": 1
}
```

### Update Webhook
```http
PUT /v1/webhooks/{webhook_id}
Authorization: Bearer {session_token}

Request:
{
  "url": "https://new-domain.com/webhook",
  "events": ["invoice.created", "invoice.paid", "invoice.overdue"],
  "active": true
}
```

### Delete Webhook
```http
DELETE /v1/webhooks/{webhook_id}
Authorization: Bearer {session_token}

Response (200):
{
  "message": "Webhook deleted successfully"
}
```

### Test Webhook
```http
POST /v1/webhooks/test?webhookId={webhook_id}
Authorization: Bearer {session_token}

Response (200):
{
  "success": true,
  "status_code": 200,
  "response": "OK"
}
```

### Get Delivery History
```http
GET /v1/webhooks/deliveries?webhookId={webhook_id}&limit=50
Authorization: Bearer {session_token}

Response (200):
{
  "deliveries": [
    {
      "id": "delivery_xyz789",
      "webhook_id": "webhook_abc123",
      "event_type": "invoice.created",
      "success": true,
      "status_code": 200,
      "timestamp": "2026-01-19T11:30:00Z"
    }
  ],
  "count": 50
}
```

## Webhook Payload Format

All webhook deliveries use this structure:

```json
{
  "event": "invoice.created",
  "timestamp": "2026-01-19T12:00:00Z",
  "data": {
    "invoice_id": "inv_12345",
    "customer_id": "cust_abc",
    "amount": 250.00,
    "status": "issued",
    "due_date": "2026-02-19"
  }
}
```

## Signature Verification

Every webhook includes an `X-SecureBase-Signature` header for verification:

### Python Example
```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload_body, signature_header, secret):
    """Verify webhook signature"""
    # Compute expected signature
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload_body.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time comparison
    return hmac.compare_digest(expected_signature, signature_header)

# In your webhook handler
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-SecureBase-Signature')
    payload = request.get_data(as_text=True)
    
    if not verify_webhook_signature(payload, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401
    
    event_data = json.loads(payload)
    # Process event...
    return 'OK', 200
```

### Node.js Example
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payloadBody, signatureHeader, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signatureHeader)
  );
}

// Express.js handler
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-securebase-signature'];
  const payload = req.body.toString();
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  // Process event...
  res.send('OK');
});
```

## Supported Event Types

| Event Type | Trigger | Payload Fields |
|------------|---------|----------------|
| `invoice.created` | New invoice generated | invoice_id, amount, due_date, status |
| `invoice.paid` | Invoice marked paid | invoice_id, amount, paid_at |
| `invoice.overdue` | Invoice past due date | invoice_id, amount, days_overdue |
| `ticket.created` | Support ticket opened | ticket_id, subject, priority |
| `ticket.updated` | Ticket status changed | ticket_id, old_status, new_status |
| `ticket.resolved` | Ticket marked resolved | ticket_id, resolution_time |
| `compliance.scan_completed` | Compliance scan finishes | framework, score, passing_controls |
| `compliance.finding_critical` | Critical finding detected | framework, control_id, description |
| `usage.threshold_exceeded` | Usage exceeds limit | metric, threshold, current_value |
| `api_key.created` | New API key generated | key_id, scopes |
| `api_key.revoked` | API key deleted | key_id, revoked_at |

## Retry Logic

Failed deliveries (HTTP 5xx) are automatically retried:

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | 1 minute | 1m |
| 2 | 5 minutes | 6m |
| 3 | 15 minutes | 21m |
| 4 | 1 hour | 1h 21m |
| 5 | 2 hours | 3h 21m |

**Final Attempt:** After 5 failures, webhook delivery is abandoned and marked as permanently failed.

## Best Practices

### 1. Endpoint Requirements
- ✅ **HTTPS only** - HTTP endpoints are rejected
- ✅ **Respond within 10 seconds** - Timeout after 10s
- ✅ **Return 2xx status code** - Any 2xx indicates success
- ✅ **Idempotent processing** - Same event may be delivered multiple times

### 2. Security
- ✅ **Always verify signatures** - Prevents spoofed webhooks
- ✅ **Store secret securely** - Use environment variables, not code
- ✅ **Use HTTPS with valid certificate** - Self-signed certs fail
- ✅ **Whitelist IPs** (optional) - Restrict to SecureBase IP ranges

### 3. Error Handling
```python
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    try:
        # Verify signature first
        verify_signature()
        
        # Parse payload
        event = request.json
        
        # Process event (quick validation)
        if event['event'] == 'invoice.created':
            # Queue for background processing (don't block response)
            queue.enqueue(process_invoice, event['data'])
        
        # Respond immediately
        return jsonify({'status': 'received'}), 200
        
    except Exception as e:
        # Log error but still return 200 to prevent retries
        logger.error(f'Webhook processing error: {e}')
        return jsonify({'status': 'error', 'message': str(e)}), 500
```

### 4. Testing Webhooks

**Use the test endpoint:**
```bash
curl -X POST https://api.securebase.com/v1/webhooks/test?webhookId=webhook_abc123 \
  -H "Authorization: Bearer {token}"
```

**Or use RequestBin/Webhook.site:**
1. Create temporary webhook at https://webhook.site
2. Copy the unique URL
3. Create SecureBase webhook with that URL
4. Trigger test delivery
5. View payload at webhook.site

## Deployment

### 1. Terraform Setup
```bash
# Navigate to environments directory
cd landing-zone/environments/dev

# Add webhook module to main.tf
module "webhooks" {
  source = "../../modules/webhooks"
  
  environment              = var.environment
  vpc_id                   = module.vpc.vpc_id
  lambda_subnet_ids        = module.vpc.private_subnet_ids
  webhook_secret_key       = var.webhook_secret_key
  api_gateway_id           = module.api_gateway.id
  api_gateway_root_resource_id = module.api_gateway.root_resource_id
  api_gateway_execution_arn    = module.api_gateway.execution_arn
  api_gateway_authorizer_id    = module.api_gateway.authorizer_id
  
  tags = var.tags
}

# Deploy
terraform init
terraform plan
terraform apply
```

### 2. Package Lambda Function
```bash
cd phase2-backend/functions
pip install requests -t .
zip -r webhook_manager.zip webhook_manager.py requests/
mv webhook_manager.zip ../../landing-zone/modules/webhooks/
```

### 3. Deploy Frontend
The Webhooks component is already integrated into the customer portal at `/webhooks`.

## Monitoring

### CloudWatch Metrics
- `WebhookDeliverySuccess` - Successful deliveries
- `WebhookDeliveryFailure` - Failed deliveries
- `WebhookRetryCount` - Number of retries

### CloudWatch Logs
- `/aws/lambda/securebase-webhook-manager-{env}`

### Alarms
```bash
# Create alarm for high failure rate
aws cloudwatch put-metric-alarm \
  --alarm-name webhook-high-failure-rate \
  --metric-name WebhookDeliveryFailure \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --period 300
```

## Troubleshooting

### Webhook not receiving events
1. Check webhook is `active: true`
2. Verify event type is subscribed
3. Check delivery logs in portal
4. Test webhook endpoint manually

### Signature verification failing
1. Ensure using raw request body (not parsed JSON)
2. Check secret matches (copied correctly)
3. Verify HMAC algorithm is SHA-256
4. Use constant-time comparison

### Timeouts
1. Endpoint must respond within 10 seconds
2. Queue heavy processing for background
3. Return 200 immediately, process async

## Production Checklist

- [ ] Terraform module deployed
- [ ] Lambda function packaged and uploaded
- [ ] API Gateway endpoints created
- [ ] DynamoDB tables provisioned
- [ ] Frontend component integrated
- [ ] Signature verification implemented
- [ ] Endpoint responds within 10s
- [ ] Error handling configured
- [ ] CloudWatch alarms set up
- [ ] Documentation shared with customers
- [ ] Test webhook endpoint working
- [ ] Delivery logs viewable in portal

## License

Proprietary - SecureBase 2026
