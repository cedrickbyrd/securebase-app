#!/bin/bash
# Make deployment scripts executable

chmod +x bootstrap-backend.sh
chmod +x configure-aws.sh
chmod +x QUICK_START.sh

echo "✅ Scripts are now executable"
echo ""
echo "Available commands:"
echo "  ./configure-aws.sh      - Set up AWS credentials"
echo "  ./bootstrap-backend.sh  - Create S3 + DynamoDB backend"
echo "  ./QUICK_START.sh        - One-command full deployment"
