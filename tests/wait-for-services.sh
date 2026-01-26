#!/bin/bash
# Wait for all test services to be ready
# Phase 4: Integration Testing Infrastructure

set -e

echo "🔄 Waiting for test services to be ready..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Wait for PostgreSQL
echo -n "Waiting for PostgreSQL... "
for i in {1..30}; do
    if docker exec securebase-test-db pg_isready -U test_user -d securebase_test > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}Failed to connect${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for LocalStack
echo -n "Waiting for LocalStack... "
for i in {1..60}; do
    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}Failed to connect${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for Redis
echo -n "Waiting for Redis... "
for i in {1..30}; do
    if docker exec securebase-test-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}Failed to connect${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for MailHog
echo -n "Waiting for MailHog... "
for i in {1..30}; do
    if curl -s http://localhost:8025 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}Failed to connect${NC}"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ All services are ready!${NC}"

# Initialize LocalStack services
echo "🔧 Initializing LocalStack services..."

# Create S3 buckets
docker exec securebase-test-localstack awslocal s3 mb s3://securebase-test-reports 2>/dev/null || echo "Reports bucket exists"
docker exec securebase-test-localstack awslocal s3 mb s3://securebase-test-audit-logs 2>/dev/null || echo "Audit logs bucket exists"

# Create DynamoDB tables
docker exec securebase-test-localstack awslocal dynamodb create-table \
    --table-name analytics_cache \
    --attribute-definitions AttributeName=cache_key,AttributeType=S \
    --key-schema AttributeName=cache_key,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "Analytics cache table exists"

docker exec securebase-test-localstack awslocal dynamodb create-table \
    --table-name notifications \
    --attribute-definitions AttributeName=notification_id,AttributeType=S \
    --key-schema AttributeName=notification_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    2>/dev/null || echo "Notifications table exists"

# Create SQS queues
docker exec securebase-test-localstack awslocal sqs create-queue \
    --queue-name notification-queue 2>/dev/null || echo "Notification queue exists"

# Create SNS topics
docker exec securebase-test-localstack awslocal sns create-topic \
    --name critical-alerts 2>/dev/null || echo "Critical alerts topic exists"

echo -e "${GREEN}✅ LocalStack initialization complete!${NC}"
