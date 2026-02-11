# SecureBase Email Infrastructure (tximhotep.com)

Production-ready email system using AWS SES, SQS, and Lambda for transactional emails.

## 🎯 Features

- ✅ AWS SES with domain verification (tximhotep.com)
- ✅ DKIM, SPF, DMARC for maximum deliverability
- ✅ Async email sending via SQS + Lambda
- ✅ Dead Letter Queue for failed messages
- ✅ Event tracking (bounces, complaints, delivery)
- ✅ CloudWatch alarms for monitoring
- ✅ Multi-tenant ready (customer tagging)

## 📁 File Structure

```
infrastructure/email/
├── main.tf              # Main infrastructure (SES, SQS, Lambda, DNS)
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── README.md            # This file
├── lambda/
│   └── email-worker.js  # Lambda function for sending emails
├── templates/           # Email templates
│   ├── welcome.html
│   ├── invoice.html
│   └── password-reset.html
└── test-email.sh        # Test script for sending emails
```

## 🚀 Deployment

```bash
cd infrastructure/email
terraform init
terraform plan
terraform apply
```

## 📧 Sending Emails

Use the SQS queue to send emails:

```bash
./test-email.sh your-email@example.com
```

## ⚙️ Configuration

Key variables in `variables.tf`:
- `environment` - Environment name (dev/staging/prod)
- `enable_inbound_email` - Enable MX record (default: false)
- `existing_apex_txt_records` - Merge with existing TXT records

