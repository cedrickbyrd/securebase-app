"""Track 6.1 tenant provisioning Lambda.

Implements idempotent zero-touch tenant provisioning and can be invoked either
by an event bus payload or by API Gateway (`POST /admin/tenants/provision`).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import string
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    import boto3
    from botocore.exceptions import ClientError
except Exception:  # pragma: no cover
    boto3 = None

    class ClientError(Exception):
        """Fallback when botocore is unavailable in local test environments."""


logger = logging.getLogger(__name__)
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

PROVISIONING_TABLE = os.getenv("PROVISIONING_TABLE", "securebase-provisioning")
TENANTS_TABLE = os.getenv("TENANTS_TABLE", "securebase-tenants")
WELCOME_FROM = os.getenv("WELCOME_FROM", "noreply@securebase.io")
CODEBUILD_PROJECT = os.getenv("TENANT_TERRAFORM_PROJECT", "securebase-tenant-terraform-runner")
DEFAULT_REGION = os.getenv("AWS_REGION", "us-east-1")
POLLING_TIMEOUT_SECONDS = int(os.getenv("PROVISIONING_TIMEOUT_SECONDS", "600"))
API_KEY_SUFFIX_LENGTH = int(os.getenv("API_KEY_SUFFIX_LENGTH", "8"))
API_KEY_TOKEN_BYTES = int(os.getenv("API_KEY_TOKEN_BYTES", "24"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ddb_table(name: str):
    if boto3 is None:
        raise RuntimeError("boto3 is required in Lambda runtime")
    return boto3.resource("dynamodb").Table(name)


def _get_status(tenant_id: str) -> Optional[Dict[str, Any]]:
    item = _ddb_table(PROVISIONING_TABLE).get_item(Key={"tenant_id": tenant_id}).get("Item")
    return item


def _put_status(tenant_id: str, status: str, detail: Dict[str, Any]) -> None:
    item = {
        "tenant_id": tenant_id,
        "updated_at": _now(),
        "status": status,
        **detail,
    }
    _ddb_table(PROVISIONING_TABLE).put_item(Item=item)


def _generate_api_key(tenant_id: str) -> Dict[str, str]:
    suffix = "".join(
        secrets.choice(string.ascii_lowercase + string.digits) for _ in range(API_KEY_SUFFIX_LENGTH)
    )
    raw = f"sk_live_{tenant_id}_{suffix}_{secrets.token_hex(API_KEY_TOKEN_BYTES)}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return {"raw": raw, "hash": digest, "prefix": raw[:28]}


def _create_org_account(tenant_id: str, email: str, name: str) -> str:
    orgs = boto3.client("organizations")
    create = orgs.create_account(
        Email=email,
        AccountName=f"securebase-{name.lower().replace(' ', '-')[:34]}",
        IamUserAccessToBilling="DENY",
    )
    request_id = create["CreateAccountStatus"]["Id"]

    deadline = time.time() + POLLING_TIMEOUT_SECONDS
    while time.time() < deadline:
        status = orgs.describe_create_account_status(CreateAccountRequestId=request_id)["CreateAccountStatus"]
        state = status["State"]
        if state == "SUCCEEDED":
            return status["AccountId"]
        if state == "FAILED":
            raise RuntimeError(f"Organizations account creation failed: {status.get('FailureReason', 'unknown')}")
        time.sleep(10)

    raise TimeoutError("Timed out waiting for Organizations create_account")


def _run_tenant_terraform(tenant: Dict[str, Any], account_id: str) -> str:
    codebuild = boto3.client("codebuild")
    response = codebuild.start_build(
        projectName=CODEBUILD_PROJECT,
        environmentVariablesOverride=[
            {"name": "TF_VAR_tenant_id", "value": tenant["tenant_id"], "type": "PLAINTEXT"},
            {"name": "TF_VAR_tenant_name", "value": tenant["name"], "type": "PLAINTEXT"},
            {"name": "TF_VAR_tenant_tier", "value": tenant.get("tier", "standard"), "type": "PLAINTEXT"},
            {"name": "TF_VAR_compliance_framework", "value": tenant.get("framework", "cis"), "type": "PLAINTEXT"},
            {"name": "TF_VAR_tenant_account_id", "value": account_id, "type": "PLAINTEXT"},
            {"name": "TF_VAR_region", "value": tenant.get("region", DEFAULT_REGION), "type": "PLAINTEXT"},
        ],
    )
    build_id = response["build"]["id"]

    deadline = time.time() + POLLING_TIMEOUT_SECONDS
    while time.time() < deadline:
        build = codebuild.batch_get_builds(ids=[build_id])["builds"][0]
        status = build["buildStatus"]
        if status == "SUCCEEDED":
            return build_id
        if status in {"FAILED", "FAULT", "TIMED_OUT", "STOPPED"}:
            raise RuntimeError(f"Tenant Terraform build failed: {status}")
        time.sleep(10)

    raise TimeoutError("Timed out waiting for tenant Terraform build")


def _create_tenant_record(tenant: Dict[str, Any], account_id: str, api_key: Dict[str, str]) -> None:
    _ddb_table(TENANTS_TABLE).put_item(
        Item={
            "tenant_id": tenant["tenant_id"],
            "name": tenant["name"],
            "email": tenant["email"],
            "tier": tenant.get("tier", "standard"),
            "framework": tenant.get("framework", "cis"),
            "region": tenant.get("region", DEFAULT_REGION),
            "aws_account_id": account_id,
            "api_key_hash": api_key["hash"],
            "api_key_prefix": api_key["prefix"],
            "created_at": _now(),
        }
    )


def _send_welcome_email(tenant: Dict[str, Any], account_id: str, api_key: str) -> None:
    ses = boto3.client("ses", region_name=tenant.get("region", DEFAULT_REGION))
    body = (
        f"Hello {tenant['name']},\n\n"
        f"Your SecureBase tenant is ready.\n"
        f"Tenant ID: {tenant['tenant_id']}\n"
        f"AWS Account: {account_id}\n"
        f"API Key: {api_key}\n\n"
        "Please log into the portal to rotate this key immediately."
    )
    ses.send_email(
        Source=WELCOME_FROM,
        Destination={"ToAddresses": [tenant["email"]]},
        Message={"Subject": {"Data": "Your SecureBase tenant is ready"}, "Body": {"Text": {"Data": body}}},
    )


def _extract_tenant_payload(event: Dict[str, Any]) -> Dict[str, Any]:
    if event.get("httpMethod") == "POST":
        claims = ((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt", {}).get("claims", {})
        if claims.get("role") != "admin":
            raise PermissionError("Admin JWT required")
        body = event.get("body") or "{}"
        payload = json.loads(body) if isinstance(body, str) else body
    else:
        payload = event

    required = ["tenant_id", "email", "name"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    payload.setdefault("tier", "standard")
    payload.setdefault("framework", "cis")
    payload.setdefault("region", DEFAULT_REGION)
    return payload


def provision_tenant(tenant: Dict[str, Any]) -> Dict[str, Any]:
    existing = _get_status(tenant["tenant_id"])
    if existing and existing.get("status") == "completed":
        return {
            "status": "completed",
            "tenant_id": tenant["tenant_id"],
            "idempotent": True,
            "aws_account_id": existing.get("aws_account_id"),
        }

    _put_status(tenant["tenant_id"], "in_progress", {"started_at": _now(), "email": tenant["email"]})

    try:
        account_id = _create_org_account(tenant["tenant_id"], tenant["email"], tenant["name"])
        build_id = _run_tenant_terraform(tenant, account_id)
        api_key = _generate_api_key(tenant["tenant_id"])
        _create_tenant_record(tenant, account_id, api_key)
        _send_welcome_email(tenant, account_id, api_key["raw"])

        _put_status(
            tenant["tenant_id"],
            "completed",
            {
                "aws_account_id": account_id,
                "terraform_build_id": build_id,
                "completed_at": _now(),
            },
        )
        return {
            "status": "completed",
            "tenant_id": tenant["tenant_id"],
            "aws_account_id": account_id,
            "provisioned_in": "<10m",
        }
    except (ClientError, RuntimeError, TimeoutError) as exc:
        logger.exception("Provisioning failed for tenant %s", tenant["tenant_id"])
        _put_status(
            tenant["tenant_id"],
            "failed",
            {
                "error": str(exc),
                "error_type": type(exc).__name__,
                "failed_at": _now(),
            },
        )
        raise
    except Exception as exc:
        logger.exception(
            "Unexpected provisioning error for tenant %s (type=%s)",
            tenant["tenant_id"],
            type(exc).__name__,
        )
        _put_status(
            tenant["tenant_id"],
            "failed",
            {
                "error": str(exc),
                "error_type": type(exc).__name__,
                "failed_at": _now(),
            },
        )
        raise


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    try:
        tenant = _extract_tenant_payload(event)
        result = provision_tenant(tenant)
        status_code = 200 if result.get("idempotent") else 202
        return {
            "statusCode": status_code,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(result),
        }
    except PermissionError as exc:
        return {"statusCode": 403, "body": json.dumps({"error": str(exc)})}
    except ValueError as exc:
        return {"statusCode": 400, "body": json.dumps({"error": str(exc)})}
    except ClientError as exc:
        return {"statusCode": 502, "body": json.dumps({"error": str(exc)})}
    except Exception as exc:
        logger.exception("Unhandled tenant_provisioner error (type=%s)", type(exc).__name__)
        return {"statusCode": 500, "body": json.dumps({"error": "Internal provisioning error"})}
