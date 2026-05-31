#!/usr/bin/env bash
set -euo pipefail

TARGET_ENV="${TARGET_ENV:-}"
if [ -z "$TARGET_ENV" ]; then
  echo "TARGET_ENV is required (dev|staging|prod)." >&2
  exit 1
fi

DB_SECRET_NAME_OR_ARN="${DB_SECRET_NAME_OR_ARN:-${DB_SECRET_IDENTIFIER:-${DB_SECRET_ID:-${DB_SECRET_ARN:-securebase/${TARGET_ENV}/rds/admin-password}}}}"
MIGRATION_FILES="${MIGRATION_FILES:-phase6-backend/database/migrations/001_audit_evidence_tables.sql phase6-backend/database/migrations/002_compliance_score_history.sql}"
VALIDATE_REQUIRED_TABLES="${VALIDATE_REQUIRED_TABLES:-0}"
REQUIRED_TABLES="${REQUIRED_TABLES:-schema_migrations evidence_packages macie_findings compliance_score_daily control_violation_log}"

SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_NAME_OR_ARN" --query 'SecretString' --output text)

DB_HOST=$(echo "$SECRET_JSON" | jq -r '.host // .hostname')
DB_PORT=$(echo "$SECRET_JSON" | jq -r '.port // 5432')
DB_NAME=$(echo "$SECRET_JSON" | jq -r '.dbname // .database // "securebase"')
DB_USER=$(echo "$SECRET_JSON" | jq -r '.username // .user')
DB_PASS=$(echo "$SECRET_JSON" | jq -r '.password')

if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "null" ] || [ -z "$DB_USER" ] || [ "$DB_USER" = "null" ] || [ -z "$DB_PASS" ] || [ "$DB_PASS" = "null" ]; then
  echo "Failed to parse DB credentials from Secrets Manager secret: $DB_SECRET_NAME_OR_ARN" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASS"
PSQL_CONN="host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER sslmode=require"

psql "$PSQL_CONN" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

apply_migration() {
  local migration_file="$1"
  local version
  version="$(basename "$migration_file" .sql)"

  if psql "$PSQL_CONN" -tA -v version="$version" -c "SELECT 1 FROM schema_migrations WHERE version = :'version' LIMIT 1;" | grep -q '^1$'; then
    echo "[skip] ${version} already applied"
    return
  fi

  echo "[apply] ${version}"
  psql "$PSQL_CONN" -v ON_ERROR_STOP=1 -f "$migration_file"
  psql "$PSQL_CONN" -v ON_ERROR_STOP=1 -v version="$version" -c "INSERT INTO schema_migrations(version) VALUES (:'version') ON CONFLICT (version) DO NOTHING;"
}

for migration_file in $MIGRATION_FILES; do
  apply_migration "$migration_file"
done

if [ "$VALIDATE_REQUIRED_TABLES" = "1" ]; then
  for table in $REQUIRED_TABLES; do
    exists=$(psql "$PSQL_CONN" -tA -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}');")
    if [ "$exists" != "t" ]; then
      echo "Missing required table: ${table}" >&2
      exit 1
    fi
    echo "[ok] found table: ${table}"
  done
fi

unset PGPASSWORD
