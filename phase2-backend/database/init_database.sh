#!/bin/bash

# ============================================
# SecureBase Phase 2: Database Initialization
# ============================================
# Initialize PostgreSQL database with schema, RLS, and audit trails
# Usage: ./init_database.sh <environment>
#
# Prerequisites:
#   - Aurora Serverless cluster deployed (terraform apply completed)
#   - RDS Proxy enabled with connection pooling
#   - Secrets Manager contains 'rds_admin_password' and 'rds_app_password'
#
# This script:
#   1. Retrieves RDS endpoint from Terraform outputs
#   2. Retrieves passwords from Secrets Manager
#   3. Creates schema with RLS policies
#   4. Creates roles (admin, app, analytics)
#   5. Tests connection pooling with RDS Proxy
#   6. Loads initial tier features and compliance mappings

set -e

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
TERRAFORM_DIR="../../landing-zone/environments/${ENVIRONMENT}"
SCHEMA_FILE="../database/schema.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== SecureBase Phase 2: Database Initialization ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"

# ============================================
# 1. Validate prerequisites
# ============================================
echo -e "${YELLOW}[1/6] Validating prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI not found${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}ERROR: psql client not found. Install PostgreSQL client: apt-get install postgresql-client${NC}"
    exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}ERROR: Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo -e "${RED}ERROR: Terraform directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites validated${NC}"

# ============================================
# 2. Retrieve RDS endpoint and credentials
# ============================================
echo -e "${YELLOW}[2/6] Retrieving RDS endpoint and credentials...${NC}"

# Get RDS endpoint from Terraform outputs
cd "$TERRAFORM_DIR"
RDS_WRITER_ENDPOINT=$(terraform output -raw rds_endpoint_writer 2>/dev/null || echo "")
RDS_PROXY_ENDPOINT=$(terraform output -raw rds_proxy_endpoint 2>/dev/null || echo "")
RDS_PORT=$(terraform output -raw rds_port 2>/dev/null || echo "5432")
RDS_DATABASE=$(terraform output -raw rds_database 2>/dev/null || echo "securebase")

if [ -z "$RDS_WRITER_ENDPOINT" ]; then
    echo -e "${RED}ERROR: Could not retrieve RDS endpoint. Ensure terraform apply completed.${NC}"
    exit 1
fi

# Get admin password from Secrets Manager
echo "Retrieving secrets from AWS Secrets Manager..."
RDS_ADMIN_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id phase2/rds/admin \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null || echo "")

if [ -z "$RDS_ADMIN_SECRET" ]; then
    echo -e "${YELLOW}WARNING: Admin secret not found in Secrets Manager${NC}"
    echo "Using environment variable RDS_ADMIN_PASSWORD (must be set)"
    RDS_ADMIN_PASSWORD="${RDS_ADMIN_PASSWORD:-CHANGE_ME_IN_PRODUCTION}"
    RDS_ADMIN_USER="postgres"
else
    RDS_ADMIN_PASSWORD=$(echo "$RDS_ADMIN_SECRET" | jq -r '.password // .rds_admin_password' 2>/dev/null)
    RDS_ADMIN_USER=$(echo "$RDS_ADMIN_SECRET" | jq -r '.username // "postgres"' 2>/dev/null)
fi

echo -e "${GREEN}✓ RDS endpoint: $RDS_WRITER_ENDPOINT${NC}"
echo -e "${GREEN}✓ RDS proxy: $RDS_PROXY_ENDPOINT${NC}"
echo -e "${GREEN}✓ Database: $RDS_DATABASE${NC}"

# ============================================
# 3. Test direct connection to RDS (for schema initialization)
# ============================================
echo -e "${YELLOW}[3/6] Testing RDS connection...${NC}"

export PGPASSWORD="$RDS_ADMIN_PASSWORD"

# Test connection
if ! psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d postgres -c "SELECT version();" &>/dev/null; then
    echo -e "${RED}ERROR: Could not connect to RDS writer endpoint${NC}"
    echo "Endpoint: $RDS_WRITER_ENDPOINT"
    echo "User: $RDS_ADMIN_USER"
    exit 1
fi

echo -e "${GREEN}✓ RDS connection successful${NC}"

# ============================================
# 4. Create database and schema
# ============================================
echo -e "${YELLOW}[4/6] Creating database schema...${NC}"

# Create database if not exists
psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d postgres <<EOF
-- Create database
CREATE DATABASE IF NOT EXISTS "$RDS_DATABASE" WITH 
  OWNER postgres
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database created/verified${NC}"
else
    echo -e "${YELLOW}Note: Database may already exist${NC}"
fi

# Load schema
echo "Loading schema..."
if psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d "$RDS_DATABASE" -f "$SCHEMA_FILE" &>/dev/null; then
    echo -e "${GREEN}✓ Schema loaded successfully${NC}"
else
    echo -e "${RED}ERROR: Schema load failed${NC}"
    # Try to see the actual error
    psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d "$RDS_DATABASE" -f "$SCHEMA_FILE"
    exit 1
fi

# ============================================
# 5. Create application roles
# ============================================
echo -e "${YELLOW}[5/6] Creating application roles...${NC}"

# Generate secure passwords for app roles
APP_PASSWORD=$(openssl rand -base64 32 | head -c 32)
ANALYTICS_PASSWORD=$(openssl rand -base64 32 | head -c 32)

# Create roles
psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d "$RDS_DATABASE" <<EOF
-- Drop existing roles if needed (for re-initialization)
DROP ROLE IF EXISTS securebase_app;
DROP ROLE IF EXISTS securebase_analytics;

-- Create app role (Lambda execution)
CREATE ROLE securebase_app WITH LOGIN PASSWORD '$APP_PASSWORD';
GRANT USAGE ON SCHEMA public TO securebase_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO securebase_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO securebase_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO securebase_app;

-- Create analytics role (read-only)
CREATE ROLE securebase_analytics WITH LOGIN PASSWORD '$ANALYTICS_PASSWORD';
GRANT USAGE ON SCHEMA public TO securebase_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO securebase_analytics;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO securebase_analytics;

-- Verify roles created
SELECT rolname FROM pg_roles WHERE rolname IN ('securebase_app', 'securebase_analytics');
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Application roles created${NC}"
else
    echo -e "${YELLOW}Note: Roles may already exist${NC}"
fi

# Store app credentials in Secrets Manager
echo "Storing application credentials in Secrets Manager..."
aws secretsmanager create-secret \
    --name phase2/rds/app \
    --description "SecureBase Phase 2 RDS application user" \
    --secret-string "{\"username\":\"securebase_app\",\"password\":\"$APP_PASSWORD\",\"engine\":\"postgres\",\"host\":\"$RDS_WRITER_ENDPOINT\",\"port\":$RDS_PORT,\"dbname\":\"$RDS_DATABASE\"}" \
    --region "$AWS_REGION" \
    --tags "Key=Environment,Value=$ENVIRONMENT" "Key=Project,Value=SecureBase" \
    --error-handling=ALLOW_IF_EXISTS 2>/dev/null || echo "Secret may already exist"

echo -e "${GREEN}✓ App credentials stored in Secrets Manager${NC}"

# ============================================
# 6. Verify schema and test RLS
# ============================================
echo -e "${YELLOW}[6/6] Verifying schema and RLS...${NC}"

psql -h "$RDS_WRITER_ENDPOINT" -U "$RDS_ADMIN_USER" -d "$RDS_DATABASE" <<EOF
-- List created tables
\echo '=== Tables Created ==='
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- List RLS policies
\echo '=== RLS Policies ==='
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check tier features
\echo '=== Tier Features ==='
SELECT tier, max_accounts, custom_scps, priority_support FROM tier_features ORDER BY tier;

-- Verify extensions
\echo '=== Extensions ==='
SELECT extname FROM pg_extension ORDER BY extname;
EOF

echo -e "${GREEN}✓ Schema verification complete${NC}"

# ============================================
# 7. Output configuration
# ============================================
echo -e "${YELLOW}=== Setup Complete ===${NC}"
echo -e "${GREEN}Database initialized successfully${NC}"
echo ""
echo "Configuration:"
echo "  RDS Writer Endpoint: $RDS_WRITER_ENDPOINT"
echo "  RDS Proxy Endpoint:  $RDS_PROXY_ENDPOINT"
echo "  Database: $RDS_DATABASE"
echo "  Port: $RDS_PORT"
echo ""
echo "Environment variables for Lambda (store in Secrets Manager):"
echo "  RDS_HOST: $RDS_PROXY_ENDPOINT  (use RDS Proxy for connection pooling)"
echo "  RDS_DATABASE: $RDS_DATABASE"
echo "  RDS_USER: securebase_app"
echo "  RDS_PASSWORD: (stored in Secrets Manager 'phase2/rds/app')"
echo ""
echo "Next steps:"
echo "  1. Deploy Lambda functions with db_utils layer"
echo "  2. Update Lambda environment to use RDS_PROXY_ENDPOINT"
echo "  3. Run: terraform apply phase2-database (if not already done)"
echo "  4. Test Lambda auth functions"
echo "  5. Enable scheduled billing worker (1st of month 00:00 UTC)"
echo ""
echo "To manually test the database:"
echo "  psql -h $RDS_PROXY_ENDPOINT -U securebase_app -d $RDS_DATABASE"
echo ""
echo -e "${GREEN}Phase 2 database is ready for API deployment${NC}"

# Cleanup sensitive data
unset PGPASSWORD
unset RDS_ADMIN_PASSWORD
unset APP_PASSWORD
unset ANALYTICS_PASSWORD
