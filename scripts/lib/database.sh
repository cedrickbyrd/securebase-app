#!/bin/bash

# ============================================
# Database connection helper functions
# ============================================

# Guard against multiple sourcing
[[ -n "${_DATABASE_SH_LOADED:-}" ]] && return 0
_DATABASE_SH_LOADED=1

# Load database connection config from environment / .env file
load_db_config() {
  # Try .env file first (from the repo root, two levels up from scripts/lib/)
  local env_file
  env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.env"
  if [[ -f "$env_file" ]]; then
    # Parse line-by-line to avoid command injection from untrusted .env content
    while IFS= read -r line || [[ -n "$line" ]]; do
      # Skip comments and blank lines
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      # Only export known-safe SUPABASE_* and DB_* variable assignments
      if [[ "$line" =~ ^(VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)= ]]; then
        export "$line"
      fi
    done < "$env_file"
  fi

  # Derive host from VITE_SUPABASE_URL when present and DB_HOST is not set
  if [[ -n "$VITE_SUPABASE_URL" && -z "$DB_HOST" ]]; then
    # Extract the full hostname (everything between https:// and the first /)
    DB_HOST=$(echo "$VITE_SUPABASE_URL" | sed 's|https://\([^/]*\).*|\1|')
    DB_NAME="postgres"
    DB_PORT="5432"
  fi

  # Allow environment variable overrides / set defaults
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-securebase}"
  DB_USER="${DB_USER:-postgres}"
  DB_PASSWORD="${DB_PASSWORD:-}"

  # Validate required variables
  if [[ -z "$DB_HOST" || -z "$DB_USER" ]]; then
    echo "ERROR: Database connection not configured."
    echo "Set VITE_SUPABASE_URL in .env or DB_HOST/DB_USER environment variables."
    return 1
  fi
}

# Escape a value for safe embedding in a single-quoted SQL string literal.
# Replaces each single-quote with two single-quotes (standard SQL escaping).
escape_sql_string() {
  echo "${1//\'/\'\'}"
}

# Execute a SQL string with error handling.
# Usage: execute_sql "<sql>" ["<error message>"]
execute_sql() {
  local sql="$1"
  local error_msg="${2:-Database operation failed}"

  load_db_config || return 1

  PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    -c "$sql" 2>&1
  local exit_code
  exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo "ERROR: $error_msg"
    return 1
  fi
}

# Execute a SQL file with error handling.
# Usage: execute_sql_file "<path>" ["<error message>"]
execute_sql_file() {
  local file="$1"
  local error_msg="${2:-Database operation failed}"

  load_db_config || return 1

  PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    -f "$file" 2>&1
  local exit_code
  exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo "ERROR: $error_msg"
    return 1
  fi
}
