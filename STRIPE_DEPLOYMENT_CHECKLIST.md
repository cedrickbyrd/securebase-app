# Stripe Revenue Path Deployment Checklist

> **Purpose**: Step-by-step guide to activate Stripe payment integration and enable revenue collection for SecureBase

---

## Overview

This checklist guides you through deploying the complete Stripe payment integration, from initial Stripe account setup to production revenue collection. Total estimated time: **2-3 hours**.

**Prerequisites:**
- AWS account with administrative access
- Stripe account (or ability to create one)
- Database deployed and accessible
- Lambda functions and API Gateway deployed

---

## 🔧 Part 1: Pre-Deployment (30 minutes)

### 1.1 Stripe Account Setup

- [ ] **Create or log into Stripe account**
  - Visit https://dashboard.stripe.com
  - Use company email (not personal)
  - Complete business profile if prompted

- [ ] **Switch to Test mode**
  - Click "Test mode" toggle in top-right corner
  - Verify orange "TEST DATA" banner is visible
  - All following steps use test mode first

### 1.2 Create Products and Prices

Create a product and price for each of the 4 tiers:

#### Healthcare Tier ($15,000/month)

- [ ] **Create Healthcare Product**
  - Navigate to: **Products** → **Add Product**
  - **Name**: `SecureBase Healthcare`
  - **Description**: `HIPAA-compliant AWS Landing Zone with healthcare-specific security controls`
  - **Metadata**: Add key `tier` with value `healthcare`
  - Click **Save product**
  - Copy the Product ID (starts with `prod_`)

- [ ] **Create Healthcare Price**
  - Click **Add pricing**
  - **Pricing model**: Standard pricing
  - **Price**: `$15,000.00 USD`
  - **Billing period**: Monthly
  - Click **Add price**
  - Copy the Price ID (starts with `price_`)
  - **Save this ID**: You'll need it for `STRIPE_PRICE_HEALTHCARE`

#### Fintech Tier ($8,000/month)

- [ ] **Create Fintech Product**
  - **Name**: `SecureBase Fintech`
  - **Description**: `SOC2 Type II compliant AWS Landing Zone for financial services`
  - **Metadata**: Add key `tier` with value `fintech`
  - Copy Product ID

- [ ] **Create Fintech Price**
  - **Price**: `$8,000.00 USD`
  - **Billing period**: Monthly
  - Copy Price ID → **Save as** `STRIPE_PRICE_FINTECH`

#### Government Tier ($25,000/month)

- [ ] **Create Government Product**
  - **Name**: `SecureBase Government`
  - **Description**: `FedRAMP-aligned AWS Landing Zone for government agencies`
  - **Metadata**: Add key `tier` with value `government`
  - Copy Product ID

- [ ] **Create Government Price**
  - **Price**: `$25,000.00 USD`
  - **Billing period**: Monthly
  - Copy Price ID → **Save as** `STRIPE_PRICE_GOVERNMENT`

#### Standard Tier ($2,000/month)

- [ ] **Create Standard Product**
  - **Name**: `SecureBase Standard`
  - **Description**: `CIS Foundations compliant AWS Landing Zone`
  - **Metadata**: Add key `tier` with value `standard`
  - Copy Product ID

- [ ] **Create Standard Price**
  - **Price**: `$2,000.00 USD`
  - **Billing period**: Monthly
  - Copy Price ID → **Save as** `STRIPE_PRICE_STANDARD`

### 1.3 Create Pilot Program Coupon

- [ ] **Create Pilot Coupon**
  - Navigate to: **Products** → **Coupons** → **Create coupon**
  - **Name**: `SecureBase Pilot Program`
  - **ID** (optional): `PILOT50`
  - **Discount type**: Percentage
  - **Percent off**: `50%`
  - **Duration**: Repeating
  - **Duration in months**: `6`
  - **Max redemptions**: `20`
  - Click **Create coupon**
  - Copy Coupon ID → **Save as** `STRIPE_PILOT_COUPON`

### 1.4 Copy API Keys

- [ ] **Copy Publishable Key**
  - Navigate to: **Developers** → **API keys**
  - Find **Publishable key** (starts with `pk_test_`)
  - Click **Reveal test key**
  - Copy the full key
  - **Save as**: `STRIPE_PUBLISHABLE_KEY_TEST`

- [ ] **Copy Secret Key**
  - Find **Secret key** (starts with `sk_test_`)
  - Click **Reveal test key**
  - Copy the full key
  - **⚠️ IMPORTANT**: Keep this secret! Never commit to git
  - **Save as**: `STRIPE_SECRET_KEY_TEST`

### 1.5 Configure Webhook

- [ ] **Create Webhook Endpoint**
  - Navigate to: **Developers** → **Webhooks** → **Add endpoint**
  - **Endpoint URL**: `https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/stripe-webhook`
    - Replace with your actual API Gateway URL
  - **Description**: `SecureBase Payment Events`
  - Click **Select events**

- [ ] **Select Webhook Events**
  - Check the following events:
    - ✅ `checkout.session.completed`
    - ✅ `invoice.payment_succeeded`
    - ✅ `invoice.payment_failed`
    - ✅ `customer.subscription.updated`
    - ✅ `customer.subscription.deleted`
    - ✅ `payment_intent.succeeded`
    - ✅ `payment_intent.payment_failed`
  - Click **Add events**
  - Click **Add endpoint**

- [ ] **Copy Webhook Signing Secret**
  - Click on the newly created webhook endpoint
  - Find **Signing secret** (starts with `whsec_`)
  - Click **Reveal**
  - Copy the secret
  - **Save as**: `STRIPE_WEBHOOK_SECRET_TEST`

---

## ☁️ Part 2: AWS Infrastructure (45 minutes)

### 2.1 Store Stripe Keys in AWS Secrets Manager

- [ ] **Store Stripe Secret Key**
  ```bash
  aws secretsmanager create-secret \
    --name securebase/stripe/secret-key \
    --description "Stripe API secret key for payment processing" \
    --secret-string "sk_test_YOUR_KEY_HERE" \
    --region us-east-1
  ```

- [ ] **Store Webhook Signing Secret**
  ```bash
  aws secretsmanager create-secret \
    --name securebase/stripe/webhook-secret \
    --description "Stripe webhook signing secret" \
    --secret-string "whsec_YOUR_SECRET_HERE" \
    --region us-east-1
  ```

- [ ] **Verify Secrets Created**
  ```bash
  aws secretsmanager list-secrets --region us-east-1 | grep stripe
  ```

### 2.2 Deploy Lambda Functions

#### Deploy Create Checkout Session Lambda

- [ ] **Verify Function Code Exists**
  ```bash
  ls -l phase2-backend/functions/create_checkout_session.py
  ```

- [ ] **Package Lambda with Dependencies**
  ```bash
  cd phase2-backend/functions
  pip install -t package stripe boto3
  cd package
  zip -r ../create_checkout_session.zip .
  cd ..
  zip -g create_checkout_session.zip create_checkout_session.py
  ```

- [ ] **Deploy Lambda Function**
  ```bash
  aws lambda update-function-code \
    --function-name securebase-create-checkout-session \
    --zip-file fileb://create_checkout_session.zip \
    --region us-east-1
  ```

- [ ] **Configure Environment Variables**
  ```bash
  aws lambda update-function-configuration \
    --function-name securebase-create-checkout-session \
    --environment Variables="{
      STRIPE_SECRET_KEY=sk_test_YOUR_KEY,
      STRIPE_PRICE_HEALTHCARE=price_YOUR_HEALTHCARE_ID,
      STRIPE_PRICE_FINTECH=price_YOUR_FINTECH_ID,
      STRIPE_PRICE_GOVERNMENT=price_YOUR_GOVERNMENT_ID,
      STRIPE_PRICE_STANDARD=price_YOUR_STANDARD_ID,
      STRIPE_PILOT_COUPON=PILOT50,
      PORTAL_URL=https://demo.securebase.io,
      RATE_LIMIT_TABLE=securebase-signup-rate-limits
    }" \
    --region us-east-1
  ```

#### Deploy Stripe Webhook Lambda

- [ ] **Package Webhook Lambda**
  ```bash
  cd phase2-backend/functions
  zip -g stripe_webhook.zip stripe_webhook.py
  ```

- [ ] **Deploy Webhook Function**
  ```bash
  aws lambda update-function-code \
    --function-name securebase-stripe-webhook \
    --zip-file fileb://stripe_webhook.zip \
    --region us-east-1
  ```

- [ ] **Configure Webhook Environment Variables**
  ```bash
  aws lambda update-function-configuration \
    --function-name securebase-stripe-webhook \
    --environment Variables="{
      STRIPE_SECRET_KEY=sk_test_YOUR_KEY,
      STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET,
      SNS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:securebase-notifications,
      ONBOARDING_FUNCTION_NAME=securebase-trigger-onboarding
    }" \
    --region us-east-1
  ```

### 2.3 Configure API Gateway

- [ ] **Create /checkout Endpoint**
  - Method: `POST`
  - Integration: Lambda proxy to `securebase-create-checkout-session`
  - Enable CORS

- [ ] **Create /stripe-webhook Endpoint**
  - Method: `POST`
  - Integration: Lambda proxy to `securebase-stripe-webhook`
  - **⚠️ Do NOT enable API key requirement** (Stripe sends signature in headers)

- [ ] **Deploy API**
  ```bash
  aws apigateway create-deployment \
    --rest-api-id YOUR_API_ID \
    --stage-name prod \
    --region us-east-1
  ```

- [ ] **Copy API Gateway URL**
  - Save base URL for use in webhook configuration
  - Format: `https://abc123.execute-api.us-east-1.amazonaws.com/prod`

### 2.4 Set Up CloudWatch Log Groups

- [ ] **Create Log Groups**
  ```bash
  aws logs create-log-group \
    --log-group-name /aws/lambda/securebase-create-checkout-session \
    --region us-east-1

  aws logs create-log-group \
    --log-group-name /aws/lambda/securebase-stripe-webhook \
    --region us-east-1
  ```

- [ ] **Set Retention Policy**
  ```bash
  aws logs put-retention-policy \
    --log-group-name /aws/lambda/securebase-stripe-webhook \
    --retention-in-days 30 \
    --region us-east-1
  ```

### 2.5 Create SNS Topic for Notifications

- [ ] **Create SNS Topic**
  ```bash
  aws sns create-topic \
    --name securebase-payment-notifications \
    --region us-east-1
  ```

- [ ] **Subscribe Email to Topic**
  ```bash
  aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:ACCOUNT:securebase-payment-notifications \
    --protocol email \
    --notification-endpoint your-email@company.com \
    --region us-east-1
  ```

- [ ] **Confirm Email Subscription**
  - Check email inbox
  - Click confirmation link

### 2.6 Test Lambda Functions

- [ ] **Test Checkout Session Creation**
  ```bash
  aws lambda invoke \
    --function-name securebase-create-checkout-session \
    --payload '{"body": "{\"tier\": \"standard\", \"email\": \"test@example.com\", \"name\": \"Test Corp\"}"}' \
    --log-type Tail \
    response.json

  cat response.json
  ```

- [ ] **Verify Response Contains**:
  - `checkout_url` field
  - `session_id` field
  - Status code 200

- [ ] **Check CloudWatch Logs**
  ```bash
  aws logs tail /aws/lambda/securebase-create-checkout-session --follow
  ```

---

## 🗄️ Part 3: Database Setup (15 minutes)

### 3.1 Verify Database Schema

- [ ] **Connect to Database**
  ```bash
  psql "$DATABASE_URL"
  ```

- [ ] **Verify Customers Table**
  ```sql
  \d customers
  ```
  - Verify columns exist:
    - `stripe_customer_id`
    - `stripe_subscription_id`
    - `subscription_status`
    - `trial_end_date`

- [ ] **Verify Invoices Table**
  ```sql
  \d invoices
  ```
  - Verify columns exist:
    - `stripe_invoice_id`
    - `stripe_payment_intent_id`

### 3.2 Create Database Indexes

- [ ] **Create Performance Indexes**
  ```sql
  -- Already created in migration 001_add_stripe_fields.sql
  -- Verify they exist:
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('customers', 'invoices') 
  AND indexname LIKE '%stripe%';
  ```

### 3.3 Test Database Connectivity

- [ ] **Test from Lambda**
  ```bash
  aws lambda invoke \
    --function-name securebase-stripe-webhook \
    --payload '{"test": "db_connection"}' \
    response.json
  ```

- [ ] **Check Logs for Connection Success**
  ```bash
  aws logs tail /aws/lambda/securebase-stripe-webhook --since 1m
  ```

---

## 🎨 Part 4: Frontend Configuration (10 minutes)

### 4.1 Add Environment Variables

- [ ] **Update Frontend .env File**
  ```bash
  # In phase3a-portal/.env or root .env
  VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
  VITE_API_BASE_URL=https://your-api-gateway.execute-api.us-east-1.amazonaws.com/prod
  ```

### 4.2 Verify Signup Form

- [ ] **Start Development Server**
  ```bash
  cd phase3a-portal
  npm run dev
  ```

- [ ] **Open Signup Page**
  - Navigate to `http://localhost:5173/signup`
  - Verify form loads without errors

- [ ] **Check Browser Console**
  - No errors about missing Stripe key
  - API base URL correctly configured

### 4.3 Configure Redirect URLs

- [ ] **Verify Success URL**
  - Check `PORTAL_URL` environment variable in Lambda
  - Should match your deployed portal URL
  - Success page exists at `/success`

- [ ] **Verify Cancel URL**
  - Cancel returns to `/signup?cancelled=true`

---

## 🧪 Part 5: Testing (30 minutes)

### 5.1 Test Complete Signup Flow

- [ ] **Initiate Signup**
  - Go to signup form
  - Select "Standard" tier
  - Enter test email: `test-success@example.com`
  - Enter company name: `Test Company`
  - Check "Apply pilot discount" if testing coupon
  - Click "Start Free Trial"

- [ ] **Complete Stripe Checkout**
  - Verify redirect to Stripe Checkout
  - Use test card: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g., `12/34`)
  - CVC: Any 3 digits (e.g., `123`)
  - ZIP: Any 5 digits (e.g., `12345`)
  - Click "Subscribe"

- [ ] **Verify Success Redirect**
  - Should redirect to portal success page
  - Session ID visible in URL

### 5.2 Verify Webhook Received

- [ ] **Check CloudWatch Logs**
  ```bash
  aws logs tail /aws/lambda/securebase-stripe-webhook --since 5m --follow
  ```

- [ ] **Look for Log Entries**:
  - `Processing webhook: checkout.session.completed`
  - `Customer activated: Test Company`
  - No error messages

- [ ] **Check Stripe Dashboard**
  - Navigate to: **Developers** → **Webhooks**
  - Click on your webhook endpoint
  - Verify recent events show "Succeeded" status

### 5.3 Verify Database Records

- [ ] **Check Customer Created**
  ```sql
  SELECT 
    name, email, tier, subscription_status, 
    stripe_customer_id, stripe_subscription_id,
    trial_end_date
  FROM customers
  WHERE email = 'test-success@example.com';
  ```

- [ ] **Verify Customer Data**:
  - `name` = "Test Company"
  - `tier` = "standard"
  - `subscription_status` = "trialing"
  - `stripe_customer_id` starts with `cus_`
  - `stripe_subscription_id` starts with `sub_`
  - `trial_end_date` is ~30 days in future

### 5.4 Test Failed Payment Scenario

- [ ] **Use Declining Test Card**
  - Start new signup: `test-decline@example.com`
  - Use card: `4000 0000 0000 0002` (card declined)
  - Complete checkout

- [ ] **Verify Error Handling**
  - Payment should fail gracefully
  - User sees error message
  - Check webhook logs for `payment_intent.payment_failed`

### 5.5 Test Subscription Cancellation

- [ ] **Cancel Subscription in Stripe**
  - Dashboard → **Customers**
  - Find test customer
  - Click on subscription
  - Click **Cancel subscription** → **Cancel immediately**

- [ ] **Verify Webhook Processed**
  ```bash
  aws logs tail /aws/lambda/securebase-stripe-webhook --since 5m
  ```
  - Look for: `Processing webhook: customer.subscription.deleted`

- [ ] **Verify Database Updated**
  ```sql
  SELECT subscription_status FROM customers 
  WHERE email = 'test-success@example.com';
  ```
  - Status should be `cancelled`

### 5.6 Verify Notifications

- [ ] **Check Email Inbox**
  - Should receive SNS notifications for:
    - New customer signup
    - Subscription cancellation

---

## 🚀 Part 6: Production Deployment

**⚠️ IMPORTANT**: Only proceed after all test mode validation is complete!

### 6.1 Switch Stripe to Live Mode

- [ ] **Activate Stripe Account**
  - Complete business verification if required
  - Add bank account for payouts
  - Switch to "Live mode" in dashboard

### 6.2 Re-create Products in Live Mode

- [ ] **Create All 4 Products**
  - Repeat Part 1.2 in Live mode
  - Use exact same names and descriptions
  - **Important**: Copy new LIVE price IDs

- [ ] **Create Pilot Coupon in Live Mode**
  - Repeat Part 1.3 in Live mode

### 6.3 Update Live API Keys

- [ ] **Get Live API Keys**
  - Publishable key: `pk_live_...`
  - Secret key: `sk_live_...`

- [ ] **Update Secrets Manager**
  ```bash
  aws secretsmanager update-secret \
    --secret-id securebase/stripe/secret-key \
    --secret-string "sk_live_YOUR_LIVE_KEY" \
    --region us-east-1
  ```

- [ ] **Update Lambda Environment Variables**
  ```bash
  aws lambda update-function-configuration \
    --function-name securebase-create-checkout-session \
    --environment Variables="{
      STRIPE_SECRET_KEY=sk_live_YOUR_KEY,
      STRIPE_PRICE_HEALTHCARE=price_LIVE_HEALTHCARE_ID,
      STRIPE_PRICE_FINTECH=price_LIVE_FINTECH_ID,
      STRIPE_PRICE_GOVERNMENT=price_LIVE_GOVERNMENT_ID,
      STRIPE_PRICE_STANDARD=price_LIVE_STANDARD_ID,
      STRIPE_PILOT_COUPON=PILOT50,
      PORTAL_URL=https://app.securebase.io
    }" \
    --region us-east-1
  ```

### 6.4 Update Webhook Endpoint

- [ ] **Create Live Webhook**
  - In Live mode: **Developers** → **Webhooks** → **Add endpoint**
  - Use production API Gateway URL
  - Select same events as test mode
  - Copy new webhook signing secret

- [ ] **Update Webhook Secret**
  ```bash
  aws secretsmanager update-secret \
    --secret-id securebase/stripe/webhook-secret \
    --secret-string "whsec_YOUR_LIVE_SECRET" \
    --region us-east-1
  ```

- [ ] **Update Lambda Configuration**
  ```bash
  aws lambda update-function-configuration \
    --function-name securebase-stripe-webhook \
    --environment Variables="{
      STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_SECRET,
      ...
    }" \
    --region us-east-1
  ```

### 6.5 Enable Production Monitoring

- [ ] **Set Up CloudWatch Alarms**
  ```bash
  # Failed payment alarm
  aws cloudwatch put-metric-alarm \
    --alarm-name stripe-webhook-errors \
    --alarm-description "Alert on Stripe webhook failures" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value=securebase-stripe-webhook
  ```

- [ ] **Create Dashboard**
  - CloudWatch → Dashboards → Create
  - Add widgets for:
    - Lambda invocations
    - Error rates
    - Duration metrics

### 6.6 Set Up Billing Alerts

- [ ] **Enable Stripe Email Notifications**
  - Dashboard → **Settings** → **Notifications**
  - Enable:
    - Successful payments
    - Failed payments
    - Subscription cancellations

- [ ] **Configure Revenue Alerts**
  - Use Stripe's reporting features
  - Set up daily revenue summary emails

---

## ✅ Part 7: Final Validation Checklist

### End-to-End Flow Validation

- [ ] **Live Payment Test**
  - Create test subscription with real card
  - Verify webhook received
  - Verify database updated
  - **Important**: Cancel immediately to avoid charges

- [ ] **Webhook Processing**
  - Check CloudWatch logs show no errors
  - Verify all event types processed correctly
  - Check webhook success rate in Stripe dashboard

- [ ] **Database Records**
  - Customers table populated correctly
  - Invoices tracked properly
  - Subscription status accurate

- [ ] **Notifications Working**
  - SNS notifications received
  - No failed deliveries

- [ ] **Error Handling**
  - Failed payments handled gracefully
  - Error messages user-friendly
  - Logs capture sufficient detail for debugging

### Security Validation

- [ ] **Secrets Not Exposed**
  - Check Lambda environment variables use references, not plaintext
  - Verify Secrets Manager permissions correct
  - No secrets in git repository

- [ ] **Webhook Signature Verification**
  - Webhook handler validates signatures
  - Invalid signatures rejected

- [ ] **Rate Limiting Active**
  - Test multiple rapid signups from same IP
  - Verify rate limit blocks after threshold

### Performance Validation

- [ ] **Lambda Cold Start Times**
  - First invocation < 3 seconds
  - Warm invocations < 500ms

- [ ] **Database Query Performance**
  - Indexes being used
  - Query times < 100ms

- [ ] **API Response Times**
  - Checkout session creation < 2s
  - Webhook processing < 1s

---

## 📊 Success Criteria

✅ **Deployment is successful when:**

1. Test mode signup completes end-to-end with test card
2. Webhook events processed in CloudWatch logs
3. Customer record created in database with Stripe IDs
4. Invoice tracked properly
5. SNS notifications received
6. Live mode tested with real card (then immediately canceled)
7. No errors in CloudWatch logs
8. Stripe dashboard shows 100% webhook success rate

---

## 🆘 Troubleshooting

### Webhook Not Received

**Symptoms**: Checkout completes but no CloudWatch logs

**Solutions**:
1. Check webhook endpoint URL is correct
2. Verify API Gateway deployed to correct stage
3. Check Lambda has correct permissions
4. Test webhook with "Send test webhook" in Stripe dashboard

### Database Connection Errors

**Symptoms**: Webhook logs show "Connection refused"

**Solutions**:
1. Verify Lambda in same VPC as database
2. Check security group rules allow Lambda → RDS
3. Verify database credentials in Secrets Manager
4. Test connection from Lambda console

### Invalid Signature Errors

**Symptoms**: `stripe.error.SignatureVerificationError`

**Solutions**:
1. Verify webhook secret matches Stripe dashboard
2. Check secret is for correct mode (test vs live)
3. Ensure raw request body passed to signature verification

### Rate Limit Not Working

**Symptoms**: Can create unlimited signups

**Solutions**:
1. Verify DynamoDB table exists
2. Check Lambda has DynamoDB write permissions
3. Check IP hash being generated correctly

---

## 📝 Post-Deployment Tasks

- [ ] Document all Stripe IDs in secure location
- [ ] Update runbook with production URLs
- [ ] Schedule weekly review of payment metrics
- [ ] Set up automated revenue reports
- [ ] Plan first customer onboarding dry run

---

## 📚 Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)

---

**Last Updated**: 2026-02-05  
**Version**: 1.0  
**Maintained By**: SecureBase Engineering Team
