#!/bin/bash
set -e

echo "🔍 Getting database credentials..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id securebase/dev/rds/admin-password \
  --region us-east-1 \
  --query 'SecretString' \
  --output text)

DB_HOST=$(echo "$SECRET_JSON" | jq -r '.host')
DB_PORT=$(echo "$SECRET_JSON" | jq -r '.port')
DB_NAME=$(echo "$SECRET_JSON" | jq -r '.dbname')
DB_USER=$(echo "$SECRET_JSON" | jq -r '.username')
DB_PASS=$(echo "$SECRET_JSON" | jq -r '.password')

echo "✅ Credentials retrieved"
echo "📊 Applying migration..."

export PGPASSWORD="$DB_PASS"
psql -h "$DB_HOST" \
     -p "$DB_PORT" \
     -U "$DB_USER" \
     -d "$DB_NAME" \
     -f phase2-backend/database/migrations/004_unify_customer_schema.sql

unset PGPASSWORD
echo "✅ Migration applied successfully!"
