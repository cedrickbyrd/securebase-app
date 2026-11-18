#!/usr/bin/env python3
"""SecureBase Model Context Protocol (MCP) Control Plane Server.

Component: securebase-mcp (TxImhotep LLC)
Path: /Users/cedrickbyrd/projects/securebase-terraform/tximhotep/securebase_mcp_server.py
Description: Enforces deterministic multi-cloud compliance gates (FFIEC, SOC 2, HIPAA)
             and telemetry validation directly into agentic dev workflows via HTTP/SSE.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Callable, Dict, List, Optional, Set

import boto3
import uvicorn
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError
from mcp.server.fastmcp import FastMCP
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("securebase-mcp")

mcp = FastMCP(
    "securebase-mcp",
    instructions="SecureBase Autonomous Compliance & Governance Control Plane",
)

Finding = Dict[str, str]

# ----------------------------------------------------------------------------
# Constants & Validation Constraints
# ----------------------------------------------------------------------------
MOCK_AWS_AUDIT = os.getenv("MOCK_AWS_AUDIT", "false").lower() in ("true", "1", "yes")

FATAL_AUTH_CODES = frozenset({
    "InvalidClientTokenId",
    "InvalidAccessKeyId",
    "UnrecognizedClientException",
    "AuthFailure",
    "AccountSuspendedException",
    "ExpiredToken",
    "SignatureDoesNotMatch",
})

SEVERITY_PENALTY = {
    "CRITICAL": 40.0,
    "HIGH": 20.0,
    "MEDIUM": 10.0,
    "LOW": 5.0,
}

PASS_THRESHOLD = 90.0
MAX_PLAN_BYTES = 50 * 1024 * 1024  # 50 MB safety cap

CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
BUCKET_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")

BOTO_CONFIG = Config(
    retries={"max_attempts": 3, "mode": "standard"},
    connect_timeout=5,
    read_timeout=10,
)

UNASSESSED_DOMAINS = [
    "information_security",
    "business_continuity",
    "identity_access_management",
]

def _finding(control: str, severity: str, description: str) -> Finding:
    return {"control": control, "severity": severity, "description": description}


def _err_code(exc: Exception) -> str:
    if isinstance(exc, ClientError):
        return exc.response.get("Error", {}).get("Code", "Unknown")
    return type(exc).__name__


def _check_public_access_block(s3: Any, bucket: str) -> List[Finding]:
    try:
        cfg = s3.get_public_access_block(Bucket=bucket).get("PublicAccessBlockConfiguration", {})
    except ClientError as e:
        if _err_code(e) == "NoSuchPublicAccessBlockConfiguration":
            return [_finding(
                "FFIEC-IS-001",
                "CRITICAL",
                f"Bucket '{bucket}' has NO Public Access Block configured.",
            )]
        raise

    keys = ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")
    if all(cfg.get(k, False) for k in keys):
        return []
    return [_finding(
        "FFIEC-IS-001 / SOC2-CC6.1",
        "HIGH",
        f"Bucket '{bucket}' has incomplete Public Access Block protection.",
    )]


def _check_encryption(s3: Any, bucket: str) -> List[Finding]:
    try:
        enc = s3.get_bucket_encryption(Bucket=bucket)
    except ClientError as e:
        if _err_code(e) == "ServerSideEncryptionConfigurationNotFoundError":
            return [_finding(
                "FFIEC-IS-002",
                "CRITICAL",
                f"Bucket '{bucket}' has no encryption configured.",
            )]
        raise

    rules = enc.get("ServerSideEncryptionConfiguration", {}).get("Rules", [])
    for rule in rules:
        default = rule.get("ApplyServerSideEncryptionByDefault", {})
        key_id = default.get("KMSMasterKeyId") or default.get("KMSMasterKeyID")
        if default.get("SSEAlgorithm") in ("aws:kms", "aws:kms:dsse") and key_id and "alias/aws/s3" not in key_id:
            return []
    return [_finding(
        "FFIEC-IS-002 / SOC2-CC6.6 / HIPAA-164.312",
        "HIGH",
        f"Bucket '{bucket}' does not enforce Customer-Managed Keys (CMEK).",
    )]


def _check_object_lock(s3: Any, bucket: str) -> List[Finding]:
    try:
        cfg = s3.get_object_lock_configuration(Bucket=bucket)
    except ClientError as e:
        if _err_code(e) == "ObjectLockConfigurationNotFoundError":
            return [_finding(
                "FFIEC-BCP-001",
                "MEDIUM",
                f"Bucket '{bucket}' does not have S3 Object Lock configured.",
            )]
        raise

    if cfg.get("ObjectLockConfiguration", {}).get("ObjectLockEnabled") == "Enabled":
        return []
    return [_finding(
        "FFIEC-BCP-001 / SEC-17a-4 / HIPAA-164.312",
        "MEDIUM",
        f"Bucket '{bucket}' does not have Object Lock enabled.",
    )]


def _check_versioning(s3: Any, bucket: str) -> List[Finding]:
    if s3.get_bucket_versioning(Bucket=bucket).get("Status") == "Enabled":
        return []
    return [_finding(
        "FFIEC-BCP-002",
        "HIGH",
        f"Bucket '{bucket}' does not have versioning Enabled.",
    )]


def _enforces_secure_transport(policy: Dict[str, Any]) -> bool:
    statements = policy.get("Statement", [])
    if isinstance(statements, dict):
        statements = [statements]
    for stmt in statements:
        if stmt.get("Effect") != "Deny":
            continue
        principal = stmt.get("Principal")
        if principal not in ("*", {"AWS": "*"}):
            continue
        value = (stmt.get("Condition", {}).get("Bool", {}) or {}).get("aws:SecureTransport")
        if str(value).lower() == "false":
            return True
    return False


def _check_transport_policy(s3: Any, bucket: str) -> List[Finding]:
    try:
        policy_str = s3.get_bucket_policy(Bucket=bucket).get("Policy")
    except ClientError as e:
        if _err_code(e) == "NoSuchBucketPolicy":
            return [_finding(
                "FFIEC-IS-003",
                "HIGH",
                f"Bucket '{bucket}' has no policy enforcing TLS in transit.",
            )]
        raise

    if policy_str and _enforces_secure_transport(json.loads(policy_str)):
        return []
    return [_finding(
        "FFIEC-IS-003 / HIPAA-164.312",
        "HIGH",
        f"Bucket '{bucket}' policy does not enforce TLS/HTTPS transit.",
    )]


S3_CHECKS: List[tuple[str, str, Callable[[Any, str], List[Finding]]]] = [
    ("public_access_block", "FFIEC-IS-001", _check_public_access_block),
    ("encryption", "FFIEC-IS-002", _check_encryption),
    ("object_lock", "FFIEC-BCP-001", _check_object_lock),
    ("versioning", "FFIEC-BCP-002", _check_versioning),
    ("transport_policy", "FFIEC-IS-003", _check_transport_policy),
]


def audit_aws_s3_storage(bucket_name: str, region: str = "us-east-1") -> Dict[str, Any]:
    """Blocking audit of one S3 bucket. Supports MOCK_AWS_AUDIT for local testing."""
    if MOCK_AWS_AUDIT or os.getenv("MOCK_AWS_AUDIT", "false").lower() in ("true", "1", "yes"):
        logger.info("MOCK_AWS_AUDIT enabled: Returning clean offline mock audit for '%s'", bucket_name)
        return {
            "provider": "AWS",
            "target_resource": bucket_name,
            "region": region,
            "status": "COMPLIANT",
            "findings_count": 0,
            "findings": [],
        }

    findings: List[Finding] = []
    status = "COMPLIANT"

    def result() -> Dict[str, Any]:
        return {
            "provider": "AWS",
            "target_resource": bucket_name,
            "region": region,
            "status": status,
            "findings_count": len(findings),
            "findings": findings,
        }

    try:
        s3 = boto3.client("s3", region_name=region, config=BOTO_CONFIG)
    except Exception as e:
        logger.error("Unable to create S3 client: %s", e)
        findings.append(_finding(
            "AWS-AUTH-001",
            "CRITICAL",
            f"AWS live audit unavailable for '{bucket_name}' (Reason: {_err_code(e)}).",
        ))
        status = "OFFLINE_SUSPENDED"
        return result()

    for name, control, check in S3_CHECKS:
        try:
            findings.extend(check(s3, bucket_name))
        except NoCredentialsError:
            logger.error("AWS credential error auditing '%s'", bucket_name)
            findings.append(_finding(
                "AWS-AUTH-001",
                "CRITICAL",
                f"AWS live audit suspended/offline for '{bucket_name}' (Reason: NoCredentials).",
            ))
            status = "OFFLINE_SUSPENDED"
            return result()
        except ClientError as e:
            code = _err_code(e)
            if code in FATAL_AUTH_CODES:
                logger.error("AWS auth failure auditing '%s' (%s)", bucket_name, code)
                findings.append(_finding(
                    "AWS-AUTH-001",
                    "CRITICAL",
                    f"AWS live audit suspended/offline for '{bucket_name}' (Reason: {code}).",
                ))
                status = "OFFLINE_SUSPENDED"
                return result()
            if code in ("NoSuchBucket", "404"):
                findings.append(_finding(
                    "AWS-TARGET-001",
                    "CRITICAL",
                    f"Bucket '{bucket_name}' does not exist or is not visible to this principal.",
                ))
                status = "TARGET_NOT_FOUND"
                return result()

            logger.warning("Check '%s' unverified for '%s': %s", name, bucket_name, code)
            findings.append(_finding(
                f"{control}-UNVERIFIED",
                "HIGH",
                f"Could not verify '{name}' for bucket '{bucket_name}' (Reason: {code}).",
            ))

    if findings:
        status = "DEGRADED"
    return result()


def _storage_score(audit: Dict[str, Any]) -> float:
    if audit["status"] in ("OFFLINE_SUSPENDED", "TARGET_NOT_FOUND"):
        return 0.0
    penalty = sum(SEVERITY_PENALTY.get(f["severity"], 0.0) for f in audit["findings"])
    return max(0.0, 100.0 - penalty)


def _persist_report(bucket: str, region: str, key: str, body: bytes, sha256: str) -> Optional[str]:
    """Writes report bytes to S3 with SSE-KMS and SHA256 metadata."""
    try:
        s3 = boto3.client("s3", region_name=region, config=BOTO_CONFIG)
        kwargs: Dict[str, Any] = {
            "Bucket": bucket,
            "Key": key,
            "Body": body,
            "ContentType": "application/json",
            "ServerSideEncryption": "aws:kms",
            "Metadata": {"sha256": sha256},
        }
        if os.getenv("SECUREBASE_REPORT_KMS_KEY_ID"):
            kwargs["SSEKMSKeyId"] = os.environ["SECUREBASE_REPORT_KMS_KEY_ID"]
        s3.put_object(**kwargs)
        return None
    except (ClientError, NoCredentialsError) as e:
        logger.error("Failed to persist report to s3://%s/%s: %s", bucket, key, _err_code(e))
        return _err_code(e)


@mcp.tool()
async def run_ffiec_compliance_pipeline(
    client_identifier: str,
    aws_region: str = "us-east-1",
    target_s3_bucket: str = "securebase-vault-logs",
    gcp_project_id: Optional[str] = None,
    persist_report: bool = False,
) -> Dict[str, Any]:
    """Executes the FFIEC IT Examination Handbook compliance pipeline across S3 vaults."""
    if not CLIENT_ID_RE.match(client_identifier):
        return {"status": "ERROR", "message": "client_identifier must match [A-Za-z0-9._-], 1-64 chars."}

    bucket = target_s3_bucket.removeprefix("s3://").strip("/")
    if target_s3_bucket.startswith("gs://") or not BUCKET_RE.match(bucket):
        return {"status": "ERROR", "message": "target_s3_bucket must be a valid S3 bucket name (or s3:// URI)."}

    logger.info("Initiating FFIEC Compliance Pipeline for client '%s'", client_identifier)
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y-%m-%d")
    suffix = now.strftime("%Y%m%d_%H%M%S")

    storage_audit = await asyncio.to_thread(audit_aws_s3_storage, bucket, aws_region)
    offline = storage_audit["status"] in ("OFFLINE_SUSPENDED", "TARGET_NOT_FOUND")

    domain_scores = {"storage_and_evidence_vault": _storage_score(storage_audit)}
    overall_score = round(mean(domain_scores.values()), 2)
    passed = storage_audit["status"] == "COMPLIANT" and overall_score >= PASS_THRESHOLD

    report = {
        "assessment_metadata": {
            "client_identifier": client_identifier,
            "evaluation_engine": "SecureBase-MCP/3.1",
            "framework": "FFIEC IT Examination Handbook (2026 Revision)",
            "generated_at": now.isoformat(),
            "execution_mode": "OFFLINE" if offline else "LIVE",
        },
        "summary": {
            "overall_score": overall_score,
            "status": "PASS" if passed else "NEEDS_REMEDIATION",
            "storage_health": storage_audit["status"],
            "coverage": f"{len(domain_scores)} of {len(domain_scores) + len(UNASSESSED_DOMAINS)} domains assessed",
        },
        "domains": {
            "storage": storage_audit,
            "domain_scores": domain_scores,
            "not_assessed": UNASSESSED_DOMAINS + (["gcp"] if gcp_project_id else []),
        },
    }

    report_json = json.dumps(report, indent=2, sort_keys=True)
    report_bytes = report_json.encode("utf-8")
    sha256_hash = hashlib.sha256(report_bytes).hexdigest()

    key = f"{client_identifier}/{date_part}/ffiec_report_{suffix}.json"
    storage_location = f"s3://{bucket}/{key}"

    persisted, persist_error = False, None
    if persist_report and not offline:
        persist_error = await asyncio.to_thread(
            _persist_report, bucket, aws_region, key, report_bytes, sha256_hash
        )
        persisted = persist_error is None

    return {
        "status": "OFFLINE_COMPLETED" if offline else "SUCCESS",
        "pipeline_id": f"pipe-{client_identifier}-{suffix}",
        "verification_sync_timestamp": now.isoformat(),
        "storage_location": storage_location,
        "persisted": persisted,
        "persist_error": persist_error,
        "sha256_hash": sha256_hash,
        "report": report,
    }


@mcp.tool()
async def run_hipaa_compliance_pipeline(
    client_identifier: str,
    aws_region: str = "us-east-1",
    target_s3_bucket: str = "securebase-vault-logs",
    gcp_project_id: Optional[str] = None,
    persist_report: bool = False,
) -> Dict[str, Any]:
    """Executes the HIPAA Security Rule compliance pipeline across S3 vaults."""
    if not CLIENT_ID_RE.match(client_identifier):
        return {"status": "ERROR", "message": "client_identifier must match [A-Za-z0-9._-], 1-64 chars."}

    bucket = target_s3_bucket.removeprefix("s3://").strip("/")
    if target_s3_bucket.startswith("gs://") or not BUCKET_RE.match(bucket):
        return {"status": "ERROR", "message": "target_s3_bucket must be a valid S3 bucket name (or s3:// URI)."}

    logger.info("Initiating HIPAA Compliance Pipeline for client '%s'", client_identifier)
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y-%m-%d")
    suffix = now.strftime("%Y%m%d_%H%M%S")

    storage_audit = await asyncio.to_thread(audit_aws_s3_storage, bucket, aws_region)
    offline = storage_audit["status"] in ("OFFLINE_SUSPENDED", "TARGET_NOT_FOUND")

    domain_scores = {"phi_storage_and_evidence_vault": _storage_score(storage_audit)}
    overall_score = round(mean(domain_scores.values()), 2)
    passed = storage_audit["status"] == "COMPLIANT" and overall_score >= PASS_THRESHOLD

    report = {
        "assessment_metadata": {
            "client_identifier": client_identifier,
            "evaluation_engine": "SecureBase-MCP/3.1",
            "framework": "HIPAA Security Rule (45 CFR § 164.300)",
            "generated_at": now.isoformat(),
            "execution_mode": "OFFLINE" if offline else "LIVE",
        },
        "summary": {
            "overall_score": overall_score,
            "status": "PASS" if passed else "NEEDS_REMEDIATION",
            "storage_health": storage_audit["status"],
            "coverage": f"{len(domain_scores)} of {len(domain_scores) + len(UNASSESSED_DOMAINS)} domains assessed",
        },
        "domains": {
            "storage": storage_audit,
            "domain_scores": domain_scores,
            "not_assessed": UNASSESSED_DOMAINS + (["gcp"] if gcp_project_id else []),
        },
    }

    report_json = json.dumps(report, indent=2, sort_keys=True)
    report_bytes = report_json.encode("utf-8")
    sha256_hash = hashlib.sha256(report_bytes).hexdigest()

    key = f"{client_identifier}/{date_part}/hipaa_report_{suffix}.json"
    storage_location = f"s3://{bucket}/{key}"

    persisted, persist_error = False, None
    if persist_report and not offline:
        persist_error = await asyncio.to_thread(
            _persist_report, bucket, aws_region, key, report_bytes, sha256_hash
        )
        persisted = persist_error is None

    return {
        "status": "OFFLINE_COMPLETED" if offline else "SUCCESS",
        "pipeline_id": f"pipe-{client_identifier}-hipaa-{suffix}",
        "verification_sync_timestamp": now.isoformat(),
        "storage_location": storage_location,
        "persisted": persisted,
        "persist_error": persist_error,
        "sha256_hash": sha256_hash,
        "report": report,
    }


def _first(value: Any) -> Dict[str, Any]:
    if isinstance(value, list):
        return value[0] if value and isinstance(value[0], dict) else {}
    return value if isinstance(value, dict) else {}


def _nth(value: Any, i: int) -> Dict[str, Any]:
    return value[i] if isinstance(value, list) and i < len(value) and isinstance(value[i], dict) else {}


def _s3_sse_has_cmek(after: Dict[str, Any], unknown: Dict[str, Any]) -> bool:
    rules = after.get("rule") or []
    unknown_rules = unknown.get("rule")
    for i, rule in enumerate(rules):
        cfg = _first(rule.get("apply_server_side_encryption_by_default"))
        ucfg = _first(_nth(unknown_rules, i).get("apply_server_side_encryption_by_default"))
        key_id = cfg.get("kms_master_key_id")
        key_known_later = ucfg.get("kms_master_key_id") is True
        if cfg.get("sse_algorithm") in ("aws:kms", "aws:kms:dsse") and (key_id or key_known_later):
            return True
    return False


def _load_plan(plan_json_path: str) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    base = Path(os.getenv("SECUREBASE_PLAN_DIR", Path.cwd())).resolve()
    path = Path(plan_json_path).expanduser().resolve()
    if not path.is_relative_to(base):
        return None, "Plan path is outside the allowed plan directory."
    if not path.is_file():
        return None, f"Plan file not found: {plan_json_path}"
    if path.stat().st_size > MAX_PLAN_BYTES:
        return None, "Plan file exceeds size limit."
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return None, f"Plan file is not valid JSON: {e}"


def _evaluate_plan(plan: Dict[str, Any]) -> List[str]:
    violations: List[str] = []
    created_buckets: Set[str] = set()
    configured_sse_buckets: Set[str] = set()

    for change in plan.get("resource_changes", []):
        ch = change.get("change", {}) or {}
        if ch.get("actions") == ["delete"]:
            continue
        rtype, address = change.get("type"), change.get("address", "<unknown>")
        after = ch.get("after") or {}
        unknown = ch.get("after_unknown") or {}

        if rtype == "aws_s3_bucket":
            created_buckets.add(address)
        elif rtype == "aws_s3_bucket_server_side_encryption_configuration":
            bucket_ref = after.get("bucket") or address
            configured_sse_buckets.add(bucket_ref)
            if not _s3_sse_has_cmek(after, unknown):
                violations.append(f"AWS-001: {address}: S3 bucket SSE configuration must enforce CMEK.")
        elif rtype == "google_storage_bucket":
            if not after.get("uniform_bucket_level_access") and unknown.get("uniform_bucket_level_access") is not True:
                violations.append(f"GCP-002: {address}: Bucket missing uniform bucket-level access.")
            if after.get("public_access_prevention") != "enforced" and unknown.get("public_access_prevention") is not True:
                violations.append(f"GCP-003: {address}: Bucket missing enforced public access prevention.")

    # Flag created buckets that lack an explicit SSE configuration block entirely
    for b_addr in created_buckets:
        if not any(b_addr in sse_ref for sse_ref in configured_sse_buckets):
            violations.append(f"AWS-001: {b_addr}: Bucket creation missing explicit CMEK SSE configuration resource.")

    return violations


@mcp.tool()
async def validate_terraform_plan(plan_json_path: str) -> Dict[str, Any]:
    """Shift-left IaC validator: parses a JSON Terraform plan and asserts FFIEC guardrails."""
    plan, error = await asyncio.to_thread(_load_plan, plan_json_path)
    if error:
        return {"status": "ERROR", "message": error}
    violations = _evaluate_plan(plan)
    return {
        "status": "PASS" if not violations else "FAILED",
        "compliant": not violations,
        "violations_count": len(violations),
        "violations": violations,
    }


class BearerAuthMiddleware:
    """ASGI bearer-token authorization middleware for persistent SSE streams."""

    def __init__(self, app: Any, token: str):
        self.app = app
        self._expected = f"Bearer {token}".encode()

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] == "http":
            supplied = dict(scope["headers"]).get(b"authorization", b"")
            if not hmac.compare_digest(supplied, self._expected):
                await JSONResponse({"error": "unauthorized"}, status_code=401)(scope, receive, send)
                return
        await self.app(scope, receive, send)


def build_app(host: str) -> Any:
    token = os.getenv("SECUREBASE_MCP_TOKEN", "securebase-tximhotep-token")
    if not token and host not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit("SECUREBASE_MCP_TOKEN is required when binding to a non-loopback host.")

    app = mcp.sse_app()
    if token:
        app = BearerAuthMiddleware(app, token)

    origins = [o.strip() for o in os.getenv("SECUREBASE_MCP_CORS_ORIGINS", "").split(",") if o.strip()]
    if origins:
        app = CORSMiddleware(
            app,
            allow_origins=origins,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )
    return app


def main() -> None:
    host = os.getenv("SECUREBASE_MCP_HOST", "127.0.0.1")
    port = int(os.getenv("SECUREBASE_MCP_PORT", "8000"))
    uvicorn.run(build_app(host), host=host, port=port)


if __name__ == "__main__":
    main()