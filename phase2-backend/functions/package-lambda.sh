#!/usr/bin/env bash
# Package Lambda Functions for Deployment
# Creates deployment-ready zip files in ../deploy/
#
# Usage examples:
#   # Package only:
#   ./package-lambda.sh
#
#   # Package and deploy all:
#   ./package-lambda.sh --deploy
#
#   # Package and deploy specific function:
#   ./package-lambda.sh --deploy auth_v2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/../deploy"
TEMP_DIRS=()
DEFAULT_FUNCTIONS=(auth_v2 report_engine demo_auth session_management)
SELECTED_FUNCTIONS=()
SUMMARY_NAMES=()
SUMMARY_SIZES=()
SUMMARY_STATUSES=()
DEPLOY_ENABLED=false
LAST_DEPLOY_STATUS="packaged"
# Lambda update-function-code direct uploads top out at 50 MB; larger zips must go through S3.
DIRECT_DEPLOY_LIMIT_BYTES="${PACKAGE_LAMBDA_DIRECT_DEPLOY_LIMIT_BYTES:-52428800}"
S3_DEPLOY_BUCKET="securebase-terraform-state-prod"

usage() {
  cat <<'EOF'
Usage: ./package-lambda.sh [--deploy] [function_name ...]

Examples:
  # Package only:
  ./package-lambda.sh

  # Package and deploy all:
  ./package-lambda.sh --deploy

  # Package and deploy specific function:
  ./package-lambda.sh --deploy auth_v2
EOF
}

cleanup() {
  local dir
  for dir in "${TEMP_DIRS[@]}"; do
    if [ -n "${dir}" ] && [ -d "${dir}" ]; then
      rm -rf "${dir}"
    fi
  done
}

trap cleanup EXIT

is_supported_function() {
  local function_name="$1"
  local supported
  for supported in "${DEFAULT_FUNCTIONS[@]}"; do
    if [ "${supported}" = "${function_name}" ]; then
      return 0
    fi
  done
  return 1
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --deploy)
        DEPLOY_ENABLED=true
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      --)
        shift
        while [ "$#" -gt 0 ]; do
          SELECTED_FUNCTIONS+=("$1")
          shift
        done
        break
        ;;
      -*)
        echo "❌ ERROR: Unknown option '$1'"
        echo ""
        usage
        exit 1
        ;;
      *)
        if ! is_supported_function "$1"; then
          echo "❌ ERROR: Unsupported function '$1'"
          echo ""
          usage
          exit 1
        fi
        SELECTED_FUNCTIONS+=("$1")
        ;;
    esac
    shift
  done

  if [ "${#SELECTED_FUNCTIONS[@]}" -eq 0 ]; then
    SELECTED_FUNCTIONS=("${DEFAULT_FUNCTIONS[@]}")
  fi
}

requirements_for() {
  case "$1" in
    auth_v2)
      printf '%s\n' PyJWT bcrypt boto3 pyotp
      ;;
    session_management)
      printf '%s\n' PyJWT boto3
      ;;
    report_engine)
      printf '%s\n' boto3
      ;;
    demo_auth)
      printf '%s\n' boto3
      ;;
    *)
      printf ''
      ;;
  esac
}

docker_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

validate_requirements() {
  local requirement

  for requirement in "$@"; do
    case "${requirement}" in
      PyJWT|bcrypt|boto3|pyotp)
        ;;
      *)
        echo "❌ ERROR: Unsupported dependency '${requirement}'"
        return 1
        ;;
    esac
  done
}

resolve_session_management_function_name() {
  local default_name="securebase-production-session-management"
  local discovered_names
  local candidate
  local fallback_name=""

  if ! command -v aws >/dev/null 2>&1; then
    printf '%s\n' "${default_name}"
    return 0
  fi

  if ! discovered_names="$(
    aws lambda list-functions \
      --query "Functions[?contains(FunctionName, 'session-management')].FunctionName" \
      --output text \
      2>&1
  )"; then
    echo "⚠️ WARNING: Could not look up session_management Lambda name; using ${default_name}" >&2
    printf '%s\n' "${default_name}"
    return 0
  fi

  if [ -z "${discovered_names}" ]; then
    printf '%s\n' "${default_name}"
    return 0
  fi

  while IFS= read -r candidate; do
    [ -n "${candidate}" ] || continue
    case "${candidate}" in
      securebase-production-session-management)
        printf '%s\n' "${candidate}"
        return 0
        ;;
      securebase-prod-session-management)
        fallback_name="${candidate}"
        ;;
      *)
        if [ -z "${fallback_name}" ]; then
          fallback_name="${candidate}"
        fi
        ;;
    esac
  done <<EOF
$(printf '%s\n' "${discovered_names}" | tr '\t' '\n')
EOF

  if [ -n "${fallback_name}" ]; then
    printf '%s\n' "${fallback_name}"
  else
    printf '%s\n' "${default_name}"
  fi
}

resolve_lambda_function_name() {
  case "$1" in
    auth_v2)
      printf '%s\n' "securebase-production-auth-v2"
      ;;
    session_management)
      resolve_session_management_function_name
      ;;
    report_engine)
      printf '%s\n' "securebase-production-report-engine"
      ;;
    demo_auth)
      printf '%s\n' "securebase-dev-demo-auth"
      ;;
    *)
      printf '%s\n' "$1"
      ;;
  esac
}

deploy_package() {
  local name="$1"
  local zip_file="$2"
  local function_name
  local zip_size_bytes
  local s3_key

  function_name="$(resolve_lambda_function_name "${name}")"
  zip_size_bytes="$(wc -c < "${zip_file}" | tr -d ' ')"

  if [ "${zip_size_bytes}" -gt "${DIRECT_DEPLOY_LIMIT_BYTES}" ]; then
    s3_key="lambda-deploys/${name}.zip"
    echo "  ☁️ Uploading ${name}.zip to s3://${S3_DEPLOY_BUCKET}/${s3_key}..."
    aws s3 cp "${zip_file}" "s3://${S3_DEPLOY_BUCKET}/${s3_key}"
    echo "  🚀 Deploying ${function_name} from S3..."
    aws lambda update-function-code \
      --function-name "${function_name}" \
      --s3-bucket "${S3_DEPLOY_BUCKET}" \
      --s3-key "${s3_key}" \
      >/dev/null
    LAST_DEPLOY_STATUS="deployed via S3 (${function_name})"
  else
    echo "  🚀 Deploying ${function_name} with direct upload..."
    aws lambda update-function-code \
      --function-name "${function_name}" \
      --zip-file "fileb://${zip_file}" \
      >/dev/null
    LAST_DEPLOY_STATUS="deployed directly (${function_name})"
  fi

  echo "  ⏳ Waiting for ${function_name} update..."
  aws lambda wait function-updated --function-name "${function_name}"
}

print_summary() {
  local index

  echo ""
  echo "📋 Packaging Summary"

  if [ "${DEPLOY_ENABLED}" = true ]; then
    printf '%-20s %-10s %s\n' "Function" "Size" "Deploy status"
    printf '%-20s %-10s %s\n' "--------" "----" "-------------"
    for index in "${!SUMMARY_NAMES[@]}"; do
      printf '%-20s %-10s %s\n' \
        "${SUMMARY_NAMES[$index]}" \
        "${SUMMARY_SIZES[$index]}" \
        "${SUMMARY_STATUSES[$index]}"
    done
  else
    printf '%-20s %s\n' "Function" "Size"
    printf '%-20s %s\n' "--------" "----"
    for index in "${!SUMMARY_NAMES[@]}"; do
      printf '%-20s %s\n' "${SUMMARY_NAMES[$index]}" "${SUMMARY_SIZES[$index]}"
    done
  fi
}

install_dependencies() {
  local build_dir="$1"
  shift
  local requirements=("$@")

  if [ "${#requirements[@]}" -eq 0 ]; then
    return 0
  fi

  validate_requirements "${requirements[@]}"

  if docker_available; then
    echo "  🐳 Installing dependencies with Docker..."
    docker run --rm \
      --platform linux/amd64 \
      --entrypoint /bin/bash \
      -v "${build_dir}:/build" \
      -w /build \
      public.ecr.aws/lambda/python:3.11 \
      -lc 'python -m pip install --no-cache-dir --target /build "$@"' \
      bash \
      "${requirements[@]}"
  else
    echo "  🐍 Installing dependencies with pip..."
    python3 -m pip install \
      --no-cache-dir \
      --target "${build_dir}" \
      --platform manylinux2014_x86_64 \
      --implementation cp \
      --python-version 3.11 \
      --only-binary=:all: \
      "${requirements[@]}"
  fi
}

package() {
  local name="$1"
  local source_file="${SCRIPT_DIR}/${name}.py"
  local zip_file="${DEPLOY_DIR}/${name}.zip"
  local build_dir
  local requirements=()
  local size
  local requirement

  if [ ! -f "${source_file}" ]; then
    echo "❌ ERROR: ${name}.py not found"
    return 1
  fi

  while IFS= read -r requirement; do
    if [ -n "${requirement}" ]; then
      requirements+=("${requirement}")
    fi
  done <<EOF
$(requirements_for "${name}")
EOF

  build_dir="$(mktemp -d)"
  TEMP_DIRS+=("${build_dir}")

  echo "📦 Packaging ${name} Lambda..."
  cp "${source_file}" "${build_dir}/${name}.py"
  install_dependencies "${build_dir}" "${requirements[@]}"

  rm -f "${zip_file}"
  (cd "${build_dir}" && zip -rq "${zip_file}" .)

  size=$(du -h "${zip_file}" | cut -f1)
  echo "✅ ${name}.zip (${size})"

  LAST_DEPLOY_STATUS="packaged"
  if [ "${DEPLOY_ENABLED}" = true ]; then
    deploy_package "${name}" "${zip_file}"
    echo "  ✅ Deployment completed for ${name}"
  fi

  SUMMARY_NAMES+=("${name}")
  SUMMARY_SIZES+=("${size}")
  SUMMARY_STATUSES+=("${LAST_DEPLOY_STATUS}")
}

parse_args "$@"
mkdir -p "${DEPLOY_DIR}"

for function_name in "${SELECTED_FUNCTIONS[@]}"; do
  package "${function_name}"
done

print_summary

echo ""
if [ "${DEPLOY_ENABLED}" = true ]; then
  echo "🚀 Selected Lambda functions packaged and deployed from ../deploy/"
else
  echo "🚀 All selected Lambda functions packaged in ../deploy/"
  echo ""
  echo "Next steps:"
  echo "1. Build Lambda layer: cd ../layers/reporting && ./build-layer.sh"
  echo "2. Publish layer to AWS"
  echo "3. Deploy with Terraform: cd landing-zone/environments/dev && terraform apply"
fi
