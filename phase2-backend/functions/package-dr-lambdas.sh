#!/bin/bash
# Package DR Lambda Functions for Deployment
# Creates deployment-ready zip files in ../deploy/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/../deploy"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

package() {
  local name="$1"
  local source_file="${SCRIPT_DIR}/${name}.py"
  local zip_file="${DEPLOY_DIR}/${name}.zip"

  if [[ ! -f "${source_file}" ]]; then
    log "ERROR: Missing source file ${source_file}"
    return 1
  fi

  log "Packaging ${name}.py"
  rm -f "${zip_file}"
  zip -j "${zip_file}" "${source_file}" >/dev/null

  local size
  size=$(du -h "${zip_file}" | cut -f1)
  log "Created ${name}.zip (${size})"
}

mkdir -p "${DEPLOY_DIR}"

package "failover_orchestrator"
package "failback_orchestrator"
package "health_check_aggregator"

log "DR Lambda packaging complete. Artifacts are in ${DEPLOY_DIR}"
