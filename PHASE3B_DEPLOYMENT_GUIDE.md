# Phase 3b Deployment Guide

## 🚀 Overview

Phase 3b extends the customer portal with advanced features: real-time support ticketing, notifications, and infrastructure for cost forecasting and webhooks. This guide covers the ~2 week deployment timeline.

---

## 📋 Pre-Deployment Checklist

### AWS Infrastructure
- [ ] DynamoDB tables created: `support_tickets`, `ticket_comments`, `notifications`, `webhooks`
- [ ] SNS topics created: `support-events`, `notification-events`
- [ ] SQS queues created: `support-notifications`, `webhook-delivery`
- [ ] Lambda execution role has DynamoDB, SNS, SQS permissions
- [ ] CloudWatch Logs group created: `/aws/lambda/support`

### Frontend Environment
- [ ] Node.js 18+ installed
- [ ] npm dependencies updated
- [ ] REACT_APP_API_URL set to Phase 2 API endpoint
- [ ] REACT_APP_WEBSOCKET_URL set to WebSocket endpoint (wss://)

### Backend Prepared
- [ ] Phase 2 database configured and healthy
- [ ] Phase 2 API running and authenticated
- [ ] Lambda layers updated with db_utils
- [ ] Email service configured (SES or SendGrid)

---

## 📅 Deployment Timeline

### Week 1: Support Ticket System

**Days 1-2: Deploy Support Ticket Lambda**
```bash
# 1. Package Lambda function
cd /workspaces/securebase-app/phase2-backend/functions
zip -r support-tickets.zip support_tickets.py ../layers/*

# 2. Create Lambda functions (via AWS CLI or Console)
aws lambda create-function \
  --function-name securebase-support-create-ticket \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution \
  --handler support_tickets.lambda_handler_create_ticket \
  --zip-file fileb://support-tickets.zip \
  --environment "Variables={DB_HOST=db.example.com,DB_NAME=securebase}"

# Repeat for: create, list, get, update, add_comment, get_comments

# 3. Create API Gateway endpoints
aws apigateway create-resource \
  --rest-api-id RESTAPI \
  --parent-id PARENT \
  --path-part support

# Add methods: POST /support/tickets/create, GET /support/tickets, etc.

# 4. Test endpoints
curl -X POST https://api.securebase.dev/support/tickets/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test ticket",
    "description": "This is a test support ticket",
    "priority": "medium",
    "category": "technical"
  }'
```

**Expected output:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "open",
  "created_at": "2025-01-20T10:00:00Z",
  "sla_due_date": "2025-01-21T10:00:00Z"
}
```

**Days 3-4: Deploy Support Ticket Frontend**
```bash
# 1. Install dependencies
cd /workspaces/securebase-app/phase3a-portal
npm install

# 2. Build portal
npm run build
# Output: dist/ folder (~250 KB)

# 3. Deploy to CloudFront/S3
aws s3 sync dist/ s3://securebase-portal/ --delete
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION \
  --paths "/*"

# 4. Test in browser
# Navigate to https://portal.securebase.dev
# Login with test API key
# Go to Support tab
# Create test ticket
```

**Days 5-7: Testing & Iteration**
```bash
# 1. Functional tests
- Create ticket
- List tickets with filters (status, priority)
- View ticket details
- Add comments
- Update ticket status
- Verify SLA calculations

# 2. Performance tests
- Ticket creation: <500ms
- List load: <1s (50 tickets)
- Comment addition: <300ms

# 3. Security tests
- Verify RLS: Customer A cannot see Customer B tickets
- Verify token validation on all endpoints
- Test auth expiration & re-auth flow

# 4. Edge cases
- Create ticket with very long subject (>255 chars)
- Add comment with markdown/HTML
- Update status while comment pending
- Delete ticket (should fail - immutable)
```

### Week 2: Notifications & WebSocket

**Days 8-9: Deploy WebSocket Server**
```bash
# Option A: Use managed service (AWS AppSync, Socket.io on Lambda)
# Option B: Deploy on EC2 or ECS cluster

# For Socket.io on Lambda (recommended):
cd /workspaces/securebase-app/phase3b-backend
npm install socket.io socket.io-client
npm run package
aws lambda create-function \
  --function-name securebase-websocket \
  --runtime nodejs18.x \
  --handler websocket.handler \
  --zip-file fileb://websocket-package.zip

# For managed AppSync:
aws appsync create-graphql-api \
  --name SecureBase \
  --authentication-type API_KEY
```

**Days 10-11: Deploy Notification Lambda**
```bash
# 1. Create notification handler Lambda
cd /workspaces/securebase-app/phase2-backend/functions
cat > notifications.py << 'EOF'
import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

notifications_table = dynamodb.Table('notifications')

def lambda_handler_create_notification(event, context):
    """Create notification and publish to SNS"""
    customer_id = event['customer_id']
    notification_type = event['type']  # ticket, billing, etc.
    
    notification = {
        'id': str(uuid.uuid4()),
        'customer_id': customer_id,
        'type': notification_type,
        'title': event['title'],
        'message': event['message'],
        'read': False,
        'created_at': datetime.utcnow().isoformat(),
        'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
    }
    
    # Save to DynamoDB
    notifications_table.put_item(Item=notification)
    
    # Publish to SNS for WebSocket delivery
    sns.publish(
        TopicArn='arn:aws:sns:us-east-1:ACCOUNT:notification-events',
        Message=json.dumps(notification)
    )
    
    return {'statusCode': 201, 'body': json.dumps(notification)}
EOF

zip notifications.zip notifications.py
aws lambda create-function \
  --function-name securebase-notifications \
  --runtime python3.11 \
  --handler notifications.lambda_handler_create_notification \
  --zip-file fileb://notifications.zip
```

**Days 12-14: Frontend Integration & Testing**
```bash
# 1. Update App.jsx with WebSocket connection
# Already added in Notifications.jsx - includes:
# - NotificationCenter component (bell icon)
# - NotificationsPage component (full page)
# - WebSocket auto-reconnect logic

# 2. Test WebSocket connection
cd /workspaces/securebase-app/phase3a-portal

# Add test in terminal:
npm run dev
# Open browser console
# Verify WebSocket connects when login token available

# 3. Trigger test notifications
aws lambda invoke \
  --function-name securebase-notifications \
  --payload '{"customer_id":"test-customer","type":"ticket","title":"Ticket Updated","message":"Your ticket #123 was updated"}' \
  response.json

# 4. Verify in UI
# Notification bell should show badge with count
# Click bell to see dropdown with notification
# Can mark as read or delete

# 5. Performance test
- WebSocket connection: <1s
- Notification delivery: <500ms
- Load 100 notifications: <2s
```

---

## 🔧 API Endpoints

### Support Tickets
```
POST   /support/tickets/create         → Create ticket
GET    /support/tickets                → List tickets (with filters)
GET    /support/tickets/{id}           → Get ticket details
PUT    /support/tickets/{id}           → Update ticket status
POST   /support/tickets/{id}/comments  → Add comment
GET    /support/tickets/{id}/comments  → Get comments
```

### Notifications
```
GET    /notifications                  → List notifications
PUT    /notifications/{id}/read        → Mark as read
PUT    /notifications/read-all         → Mark all as read
DELETE /notifications/{id}             → Delete notification
```

### WebSocket Events
```
Message Types:
- notification        → New notification
- ticket_update       → Ticket status changed
- metrics_update      → Usage metrics updated
- compliance_update   → Compliance status changed
- invoice_created     → New invoice ready
```

---

## 🔒 Security Considerations

### Support Tickets
- [ ] All queries filtered by customer_id (RLS at Lambda level)
- [ ] Token validation on every endpoint
- [ ] Rate limiting: 100 requests/hour per customer
- [ ] File uploads must be scanned for malware
- [ ] Comments sanitized (no code injection)

### Notifications
- [ ] Only authenticated users can access
- [ ] Notifications scoped to customer
- [ ] No sensitive data in notification text
- [ ] Delete after 30 days (TTL)

### WebSocket
- [ ] Token must be valid to connect
- [ ] Message routing verified per subscription
- [ ] Max 100 concurrent connections per customer
- [ ] Disconnect on token expiration

---

## 📊 Monitoring

### CloudWatch Alarms
```bash
# 1. Lambda error rate
aws cloudwatch put-metric-alarm \
  --alarm-name support-tickets-errors \
  --alarm-description "High error rate in support ticket Lambda" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# 2. DynamoDB throttling
aws cloudwatch put-metric-alarm \
  --alarm-name dynamodb-throttle \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --threshold 80

# 3. WebSocket disconnects
aws cloudwatch put-metric-alarm \
  --alarm-name websocket-disconnects \
  --metric-name DisconnectCount \
  --namespace Custom/WebSocket \
  --threshold 100
```

### Logs to Monitor
```
/aws/lambda/support-tickets
/aws/lambda/notifications
/aws/lambda/websocket
/aws/apigateway/support
```

---

## 🧪 Testing Checklist

### Unit Tests
```bash
cd /workspaces/securebase-app/phase3a-portal
npm run test

# Should cover:
- SupportTickets component rendering
- NotificationCenter component
- WebSocket service connection/disconnect
- API service ticket CRUD operations
```

### Integration Tests
```bash
# 1. Create ticket → Verify in list
# 2. Add comment → Verify comment count incremented
# 3. Update status → Verify WebSocket notification sent
# 4. Login with expired token → Verify reconnect
```

### User Acceptance Test
```
Scenario 1: Create and resolve ticket
- Create ticket with attachment
- Add 3 comments
- Assign to support team
- Update to resolved
- Verify SLA met
- Receive notification on each update

Scenario 2: Real-time notifications
- Create 2 tickets in quick succession
- Verify both notifications received
- Mark one as read
- Verify unread count updated
- Refresh page - verify count persisted

Scenario 3: Error handling
- Disconnect network
- Try to add comment
- Verify error message
- Reconnect network
- Retry - verify success
```

---

## 🚨 Rollback Procedures

### If Deployment Fails

**Step 1: Check logs**
```bash
aws logs tail /aws/lambda/support-tickets --follow
aws logs tail /aws/lambda/notifications --follow
```

**Step 2: Rollback Lambda**
```bash
# Rollback to previous version
aws lambda update-function-code \
  --function-name securebase-support-create-ticket \
  --s3-bucket lambda-code \
  --s3-key support-tickets-v1.zip
```

**Step 3: Rollback Frontend**
```bash
# Rollback CloudFront distribution
aws cloudfront create-invalidation \
  --distribution-id DISTRO \
  --paths "/*"

# Or revert S3 to previous version
aws s3 cp s3://securebase-portal-backup/dist-v1/* s3://securebase-portal/ --recursive
```

**Step 4: Notify Customers**
```
Email customers if outage >15 minutes:
"We temporarily disabled support tickets while addressing an issue. 
Service restored at [time]. Tickets created during outage are safe."
```

---

## 📈 Success Metrics

After Week 2:

| Metric | Target | Actual |
|--------|--------|--------|
| Support ticket creation latency | <500ms | __ |
| Notification delivery latency | <500ms | __ |
| WebSocket connection success rate | >99% | __ |
| Support ticket API uptime | >99.9% | __ |
| Customer satisfaction (tickets resolved) | >90% | __ |
| Page load time (support page) | <2s | __ |
| Mobile responsiveness | 100% tests pass | __ |

---

## 🔄 Maintenance Schedule

### Daily
- Monitor CloudWatch alarms
- Check error logs for spikes
- Verify WebSocket connectivity

### Weekly
- Review support ticket metrics
- Check DynamoDB capacity
- Test failover procedures

### Monthly
- Update dependencies
- Security audit
- Performance optimization review

---

## 📞 Escalation Contacts

| Issue | Contact | Phone |
|-------|---------|-------|
| Support ticket Lambda errors | Backend Team | ext. 5555 |
| WebSocket connectivity | DevOps Team | ext. 5556 |
| Customer portal bugs | Frontend Team | ext. 5557 |
| Database issues | Database Team | ext. 5558 |
| Security incidents | Security Team | ext. 5559 |

---

## ✅ Sign-Off

- [ ] All tests passing
- [ ] Performance targets met
- [ ] Security review completed
- [ ] Monitoring alerts configured
- [ ] Customer communication ready
- [ ] Runbook documented
- [ ] Team trained

**Deployment approved by:** ________________
**Date:** ________________

---

## 📚 Reference Documentation

- [Support Ticket Component Docs](./PHASE3B_COMPONENTS.md)
- [WebSocket Service Guide](./PHASE3B_WEBSOCKET.md)
- [Notification System Design](./PHASE3B_NOTIFICATIONS.md)
- [API Reference](./API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
