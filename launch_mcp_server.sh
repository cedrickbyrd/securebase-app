#!/usr/bin/env bash
set -euo pipefail

# SecureBase MCP Control Plane Canonical Launcher (Workspace Directory)
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export SECUREBASE_MCP_TOKEN="${SECUREBASE_MCP_TOKEN:-securebase-tximhotep-token}"
export SECUREBASE_MCP_HOST="${SECUREBASE_MCP_HOST:-127.0.0.1}"
export SECUREBASE_MCP_PORT="${SECUREBASE_MCP_PORT:-8000}"
export PYTHONUNBUFFERED=1
export MOCK_AWS_AUDIT="${MOCK_AWS_AUDIT:-true}"

echo "================================================================="
echo "  STARTING SECUREBASE MCP CONTROL PLANE SERVER"
echo "  Workspace  : ${WORKSPACE_DIR}"
echo "  Entrypoint : securebase_mcp_server.py"
echo "  Endpoint   : http://${SECUREBASE_MCP_HOST}:${SECUREBASE_MCP_PORT}/sse"
echo "  Mock Mode  : ${MOCK_AWS_AUDIT}"
echo "================================================================="

cd "${WORKSPACE_DIR}"
exec "${WORKSPACE_DIR}/.venv/bin/python3" "${WORKSPACE_DIR}/securebase_mcp_server.py"
