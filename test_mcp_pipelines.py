#!/usr/bin/env python3
"""
SecureBase MCP Control Plane - Full Suite Test Runner
-----------------------------------------------------
Executes sequential SSE tool evaluations across FFIEC, HIPAA,
and Shift-Left IaC Terraform plan validation guardrails.
"""

import asyncio
import json
import os
import sys
from mcp import ClientSession
from mcp.client.sse import sse_client

SERVER_URL = "http://127.0.0.1:8000/sse"
AUTH_HEADER = {"Authorization": "Bearer securebase-tximhotep-token"}
PLANS_DIR = "/Users/cedrickbyrd/projects/securebase-terraform/tximhotep/plans"

async def run_pipeline_tests():
    print("=" * 65)
    print("  SECUREBASE MCP CONTROL PLANE - FULL SUITE TEST")
    print("=" * 65)
    print(f"[*] Connecting to MCP server at {SERVER_URL}...")

    os.makedirs(PLANS_DIR, exist_ok=True)
    test_plan_path = os.path.join(PLANS_DIR, "test_plan.json")

    # Generate compliant terraform plan JSON with explicit CMEK SSE configuration
    dummy_plan_data = {
        "format_version": "1.2",
        "terraform_version": "1.9.0",
        "resource_changes": [
            {
                "address": "aws_s3_bucket.securebase_vault",
                "type": "aws_s3_bucket",
                "name": "securebase_vault",
                "change": {
                    "actions": ["create"],
                    "after": {
                        "bucket": "securebase-vault-logs-test"
                    }
                }
            },
            {
                "address": "aws_s3_bucket_server_side_encryption_configuration.securebase_vault_cmek",
                "type": "aws_s3_bucket_server_side_encryption_configuration",
                "name": "securebase_vault_cmek",
                "change": {
                    "actions": ["create"],
                    "after": {
                        "bucket": "aws_s3_bucket.securebase_vault.id",
                        "rule": [
                            {
                                "apply_server_side_encryption_by_default": [
                                    {
                                        "kms_master_key_id": "arn:aws:kms:us-east-1:731184206915:key/securebase-cmek-kms-id",
                                        "sse_algorithm": "aws:kms"
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        ]
    }
    with open(test_plan_path, "w") as f:
        json.dump(dummy_plan_data, f, indent=2)

    try:
        async with sse_client(SERVER_URL, headers=AUTH_HEADER) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                print("[*] Initializing MCP session...")
                await session.initialize()
                print("[+] Session initialized successfully.")

                print("\n[*] Fetching registered tool manifest...")
                tools_response = await session.list_tools()
                print(f"[+] Available Tools ({len(tools_response.tools)}):")
                for tool in tools_response.tools:
                    print(f"    - {tool.name}: {tool.description.splitlines()[0]}")

                # Step 1: FFIEC Pipeline
                print("\n" + "-" * 65)
                print("[1/3] EXECUTING: FFIEC Compliance Pipeline (Client: jpmc)")
                print("-" * 65)
                ffiec_result = await session.call_tool(
                    "run_ffiec_compliance_pipeline",
                    arguments={"client_identifier": "jpmc"}
                )
                print("[+] Raw FFIEC Execution Result:")
                for content in ffiec_result.content:
                    if hasattr(content, "text"):
                        try:
                            print(json.dumps(json.loads(content.text), indent=2))
                        except json.JSONDecodeError:
                            print(content.text)

                # Step 2: HIPAA Pipeline
                print("\n" + "-" * 65)
                print("[2/3] EXECUTING: HIPAA Compliance Pipeline (Client: trinetx)")
                print("-" * 65)
                hipaa_result = await session.call_tool(
                    "run_hipaa_compliance_pipeline",
                    arguments={"client_identifier": "trinetx"}
                )
                print("[+] Raw HIPAA Execution Result:")
                for content in hipaa_result.content:
                    if hasattr(content, "text"):
                        try:
                            print(json.dumps(json.loads(content.text), indent=2))
                        except json.JSONDecodeError:
                            print(content.text)

                # Step 3: Shift-Left Terraform Plan Validator
                print("\n" + "-" * 65)
                print("[3/3] EXECUTING: Shift-Left Terraform Plan Validation")
                print("-" * 65)
                tf_result = await session.call_tool(
                    "validate_terraform_plan",
                    arguments={"plan_json_path": test_plan_path}
                )
                print("[+] Terraform Validation Result:")
                for content in tf_result.content:
                    if hasattr(content, "text"):
                        try:
                            print(json.dumps(json.loads(content.text), indent=2))
                        except json.JSONDecodeError:
                            print(content.text)

                print("\n=" * 65)
                print("  ALL 3 CONTROL PLANE TESTS COMPLETED SUCCESSFULLY")
                print("=" * 65)

    except Exception as e:
        print(f"\n[!] Test Execution Failed: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        if os.path.exists(test_plan_path):
            os.remove(test_plan_path)

if __name__ == "__main__":
    asyncio.run(run_pipeline_tests())