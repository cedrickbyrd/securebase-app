# Audit Report Function - Migration to AWS Lambda

**Archived:** April 5, 2026  
**Reason:** Enterprise alignment - migrate to AWS Lambda for compliance and cost

## Why AWS Lambda?

This function handles compliance audit data and should be:
- ✅ In CloudTrail audit logs (enterprise requirement)
- ✅ HIPAA-ready (for healthcare customers)
- ✅ Part of single-cloud AWS narrative
- ✅ Cost-efficient at scale

## Original Netlify Function

Location: `netlify/functions/get-audit-report/index.cjs`

**What it did:**
- Connected to Supabase for audit data
- Generated compliance reports
- Required: `@supabase/supabase-js`

## AWS Lambda Migration Plan

### 1. Create AWS Lambda Function

**File:** `aws-lambda/get-audit-report/index.js`
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Parse request
    const { customerId, reportType } = JSON.parse(event.body || '{}');

    // Fetch audit data from Supabase
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Generate report
    const report = {
      customerId,
      reportType,
      generatedAt: new Date().toISOString(),
      data: data,
      // Add report logic here
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(report),
    };
  } catch (error) {
    console.error('Audit report error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### 2. Deploy to AWS

**Option A: AWS Console**
1. Go to AWS Lambda console
2. Create function: `securebase-audit-report`
3. Runtime: Node.js 20.x
4. Upload code or paste inline
5. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

**Option B: AWS SAM/Serverless Framework**
```yaml
# template.yaml
Resources:
  AuditReportFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: index.handler
      Runtime: nodejs20.x
      Environment:
        Variables:
          SUPABASE_URL: !Ref SupabaseUrl
          SUPABASE_SERVICE_ROLE_KEY: !Ref SupabaseKey
```

### 3. Create API Gateway Endpoint

1. Create new API Gateway endpoint
2. Integrate with Lambda function
3. Deploy to `/prod/audit-report`
4. Get URL: `https://[api-id].execute-api.us-east-1.amazonaws.com/prod/audit-report`

### 4. Update netlify.toml

Add redirect:
```toml
[[redirects]]
  from = "/api/audit-report"
  to = "https://[your-api-gateway].execute-api.us-east-1.amazonaws.com/prod/audit-report"
  status = 200
  force = true
```

### 5. Update Frontend

Change API calls from:
```javascript
fetch('/.netlify/functions/get-audit-report', ...)
```

To:
```javascript
fetch('/api/audit-report', ...)
```

## Dependencies

Install in Lambda layer or package:
```bash
npm install @supabase/supabase-js
```

## Testing
```bash
# Test AWS Lambda directly
curl -X POST https://[api-gateway]/prod/audit-report \
  -H "Content-Type: application/json" \
  -d '{"customerId": "test", "reportType": "compliance"}'
```

## Rollback

If needed, restore from archive:
```bash
cp -r archived/netlify-functions/get-audit-report netlify/functions/
npm install @supabase/supabase-js --legacy-peer-deps
```

## Cost Comparison

| Volume | Netlify Functions | AWS Lambda |
|--------|-------------------|------------|
| 1M requests | $250 | $0.20 |
| 10M requests | $2,500 | $2 |

## Next Steps

- [ ] Create AWS Lambda function
- [ ] Set up API Gateway endpoint
- [ ] Add redirect to netlify.toml
- [ ] Update frontend API calls
- [ ] Test end-to-end
- [ ] Deploy to production
