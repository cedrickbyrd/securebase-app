#!/bin/bash
# Package Lambda Functions for Deployment
# Creates deployment-ready zip files in ../deploy/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/../deploy"
TEMP_DIRS=()

cleanup() {
  local dir
  for dir in "${TEMP_DIRS[@]}"; do
    if [ -n "${dir}" ] && [ -d "${dir}" ]; then
      rm -rf "${dir}"
    fi
  done
}

trap cleanup EXIT

requirements_for() {
  case "$1" in
    auth_v2)
      printf '%s\n' PyJWT bcrypt boto3
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
}

mkdir -p "${DEPLOY_DIR}"

package auth_v2
package report_engine
package demo_auth
package session_management

echo ""
echo "🚀 All Lambda functions packaged in ../deploy/"
echo ""
echo "Next steps:"
echo "1. Build Lambda layer: cd ../layers/reporting && ./build-layer.sh"
echo "2. Publish layer to AWS"
echo "3. Deploy with Terraform: cd landing-zone/environments/dev && terraform apply"
