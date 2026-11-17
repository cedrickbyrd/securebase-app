#!/usr/bin/env bash
set -euo pipefail

echo "==> Simulating SIM posture evaluation against CoreLink MCP (127.0.0.1:8085)..."
curl -s -X POST http://127.0.0.1:8085/v1/mcp/authorize-session \
  -H "Content-Type: application/json" \
  -d '{
    "imsi": "310260000000001",
    "imei": "356938035643809",
    "apn": "sovereign.securebase.tximhotep",
    "sovereign_scope": "securebase-us",
    "target_tac": "TAC-0x9F88 (Unverified-External-Border)",
    "target_tenant_id": "pilot-citizens-national-bank-ffiec-2026",
    "target_vpc_id": "vpc-0a1b2c3d4e5f",
    "source_mcc_mnc": "310-260"
  }' | python3 -m json.tool
