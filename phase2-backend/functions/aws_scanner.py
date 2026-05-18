"""
AWS Scanner Lambda — cross-account compliance evidence collection.
"""

import json
import logging
import os
import time
import csv
import io
from datetime import datetime, timezone
from typing import Any

import boto3
import jwt
from botocore.exceptions import ClientError

from db_utils import execute_one, query_one

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

CONNECTIONS_TABLE = os.environ.get("CONNECTIONS_TABLE", "securebase-cloud-connections")
COLLECTOR_FUNCTION_NAME = os.environ.get(
    "HIPAA_COLLECTOR_FUNCTION_NAME", "securebase-hipaa-compliance-collector"
)
SERVICE_TIMEOUT_SECONDS = int(os.environ.get("SERVICE_TIMEOUT_SECONDS", "45"))
HIPAA_MIN_BACKUP_RETENTION_DAYS = 7
IAM_CRED_REPORT_MIN_COLUMNS = 8

PHI_KEYWORDS = ("phi", "ehr", "patient", "health", "medical", "hipaa", "clinical")
ddb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
COMPLIANCE_SCORE_FUNCTION_NAME = os.environ.get(
    "COMPLIANCE_SCORE_FUNCTION_NAME", "securebase-dev-compliance-score"
)


def _log_resource(service: str, resource: str, status: str, findings: dict | None = None, error: str | None = None) -> None:
    entry = {"service": service, "resource": resource, "status": status}
    if findings is not None:
        entry["finding_keys"] = sorted(str(key) for key in findings.keys())
    if error:
        entry["error"] = "redacted"
    logger.info(json.dumps(entry, default=str))


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _safe_json_loads(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}


def _get_customer_id_from_event(event: dict[str, Any]) -> str | None:
    auth = (event.get("headers") or {}).get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None

    token = auth[7:]
    try:
        secret_name = os.environ.get("JWT_SECRET", "securebase-jwt-production")
        try:
            resp = secrets_client.get_secret_value(SecretId=secret_name)
            raw = resp.get("SecretString", "")
            try:
                secret = json.loads(raw).get("jwt_secret") or raw
            except (json.JSONDecodeError, AttributeError):
                secret = raw
        except ClientError as exc:
            logger.warning("JWT secret lookup failed: %s", exc)
            return None
        if not secret:
            logger.warning("JWT secret is empty; rejecting request")
            return None
        claims = jwt.decode(token, secret, algorithms=["HS256"])
        return claims.get("sub") or claims.get("customer_id")
    except jwt.InvalidTokenError:
        return None


def _invoke_compliance_score(customer_id: str, role_arn: str, source: str) -> None:
    boto3.client("lambda").invoke(
        FunctionName=COMPLIANCE_SCORE_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps(
            {
                "customer_id": customer_id,
                "role_arn": role_arn,
                "source": source,
            }
        ),
    )


def _assume_customer_session(customer_id: str, role_arn: str, external_id: str):
    if not external_id:
        raise ValueError("external_id is required for AssumeRole")
    sts = boto3.client("sts")
    assumed = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=f"securebase-scan-{int(time.time())}",
        ExternalId=external_id,
        DurationSeconds=3600,
    )
    creds = assumed["Credentials"]
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name="us-east-1",
    )


def _upsert_encryption_status(
    customer_id: str,
    resource_type: str,
    resource_id: str,
    resource_name: str | None = None,
    contains_phi: bool = False,
    encryption_enabled: bool = False,
    kms_key_status: str | None = None,
    tls_version: str | None = None,
    access_control_configured: bool = False,
    overly_permissive: bool = False,
    world_readable: bool = False,
) -> None:
    query = """
        INSERT INTO hipaa_encryption_status (
            customer_id, resource_type, resource_id, resource_name, contains_phi,
            encryption_enabled, kms_key_status, tls_version, access_control_configured,
            overly_permissive, world_readable, snapshot_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (customer_id, resource_type, resource_id)
        DO UPDATE SET
            resource_name = EXCLUDED.resource_name,
            contains_phi = EXCLUDED.contains_phi,
            encryption_enabled = EXCLUDED.encryption_enabled,
            kms_key_status = EXCLUDED.kms_key_status,
            tls_version = EXCLUDED.tls_version,
            access_control_configured = EXCLUDED.access_control_configured,
            overly_permissive = EXCLUDED.overly_permissive,
            world_readable = EXCLUDED.world_readable,
            snapshot_at = NOW()
    """
    params = (
        customer_id,
        resource_type,
        resource_id,
        resource_name,
        contains_phi,
        encryption_enabled,
        kms_key_status,
        tls_version,
        access_control_configured,
        overly_permissive,
        world_readable,
    )
    try:
        execute_one(query, params)
    except Exception:
        logger.warning("Upsert fallback insert for %s/%s", resource_type, resource_id)
        execute_one(
            """
            INSERT INTO hipaa_encryption_status (
                customer_id, resource_type, resource_id, resource_name, contains_phi,
                encryption_enabled, kms_key_status, tls_version, access_control_configured,
                overly_permissive, world_readable, snapshot_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            params,
        )


def _insert_phi_access_log(
    customer_id: str,
    record_type: str,
    user_id: str | None = None,
    action: str | None = None,
    resource_id: str | None = None,
    resource_type: str | None = None,
    transmission_type: str | None = None,
    encrypted: bool | None = None,
    integrity_verified: bool | None = None,
    document_status: str | None = None,
    remediation_items_open: int = 0,
) -> None:
    execute_one(
        """
        INSERT INTO hipaa_phi_access_logs (
            customer_id, record_type, user_id, action, resource_id, resource_type,
            transmission_type, encrypted, integrity_verified, document_status, remediation_items_open
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            customer_id,
            record_type,
            user_id,
            action,
            resource_id,
            resource_type,
            transmission_type,
            encrypted,
            integrity_verified,
            document_status,
            remediation_items_open,
        ),
    )


def _seed_baa_if_needed(customer_id: str) -> None:
    existing = query_one(
        "SELECT COUNT(*) AS count FROM hipaa_baa_agreements WHERE customer_id = %s",
        (customer_id,),
    )
    count = int((existing or {}).get("count", 0))
    if count == 0:
        execute_one(
            """
            INSERT INTO hipaa_baa_agreements
              (customer_id, counterparty, signed_at, expiry, status)
            VALUES (%s, 'SecureBase / TxImhotep LLC', CURRENT_DATE, NULL, 'active')
            ON CONFLICT DO NOTHING
            """,
            (customer_id,),
        )


def _contains_phi(name: str) -> bool:
    lowered = (name or "").lower()
    return any(keyword in lowered for keyword in PHI_KEYWORDS)


def _service_deadline() -> float:
    return time.monotonic() + SERVICE_TIMEOUT_SECONDS


def _timed_out(deadline: float) -> bool:
    return time.monotonic() > deadline


def _scan_s3(session, customer_id: str) -> int:
    logger.info("Starting S3 scan")
    scanned = 0
    deadline = _service_deadline()
    s3 = session.client("s3")

    buckets = s3.list_buckets().get("Buckets", [])
    for bucket in buckets:
        if _timed_out(deadline):
            logger.warning("S3 scan timed out")
            break
        name = bucket["Name"]
        try:
            encryption_enabled = False
            kms_key_status = None
            world_readable = False
            overly_permissive = False

            try:
                enc = s3.get_bucket_encryption(Bucket=name)
                rules = enc.get("ServerSideEncryptionConfiguration", {}).get("Rules", [])
                if rules:
                    encryption_enabled = True
                    default_rule = rules[0].get("ApplyServerSideEncryptionByDefault", {})
                    if default_rule.get("SSEAlgorithm") == "aws:kms":
                        kms_key_status = "active" if default_rule.get("KMSMasterKeyID") else None
            except ClientError as e:
                if e.response.get("Error", {}).get("Code") not in (
                    "ServerSideEncryptionConfigurationNotFoundError",
                    "NoSuchBucket",
                ):
                    raise

            try:
                pab = s3.get_public_access_block(Bucket=name).get("PublicAccessBlockConfiguration", {})
                world_readable = not all(
                    [
                        pab.get("BlockPublicAcls", False),
                        pab.get("IgnorePublicAcls", False),
                        pab.get("BlockPublicPolicy", False),
                        pab.get("RestrictPublicBuckets", False),
                    ]
                )
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                if code in ("NoSuchPublicAccessBlockConfiguration", "NoSuchPublicAccessBlock"):
                    world_readable = True

            try:
                policy = s3.get_bucket_policy(Bucket=name)
                policy_doc = json.loads(policy.get("Policy", "{}"))
                for stmt in policy_doc.get("Statement", []):
                    if stmt.get("Effect") != "Allow":
                        continue
                    principal = stmt.get("Principal")
                    if principal == "*" or (isinstance(principal, dict) and any(v == "*" for v in principal.values())):
                        overly_permissive = True
                        break
            except ClientError:
                pass

            _upsert_encryption_status(
                customer_id=customer_id,
                resource_type="s3",
                resource_id=name,
                resource_name=name,
                contains_phi=_contains_phi(name),
                encryption_enabled=encryption_enabled,
                kms_key_status=kms_key_status,
                access_control_configured=not world_readable,
                overly_permissive=overly_permissive,
                world_readable=world_readable,
            )
            _log_resource(
                "s3",
                name,
                "ok",
                {
                    "encryption_enabled": encryption_enabled,
                    "world_readable": world_readable,
                    "overly_permissive": overly_permissive,
                },
            )
            scanned += 1
        except Exception as e:
            _log_resource("s3", name, "error", error=str(e))
    logger.info("Completed S3 scan")
    return scanned


def _scan_rds(session, customer_id: str) -> int:
    logger.info("Starting RDS scan")
    scanned = 0
    deadline = _service_deadline()
    rds = session.client("rds")
    instances = rds.describe_db_instances().get("DBInstances", [])

    for instance in instances:
        if _timed_out(deadline):
            logger.warning("RDS scan timed out")
            break
        db_id = instance.get("DBInstanceIdentifier")
        try:
            encrypted = bool(instance.get("StorageEncrypted", False))
            _upsert_encryption_status(
                customer_id=customer_id,
                resource_type="rds",
                resource_id=db_id,
                resource_name=db_id,
                contains_phi=True,
                encryption_enabled=encrypted,
                kms_key_status="active" if instance.get("KmsKeyId") else None,
                access_control_configured=bool(instance.get("IAMDatabaseAuthenticationEnabled", False)),
                overly_permissive=instance.get("BackupRetentionPeriod", 0) < HIPAA_MIN_BACKUP_RETENTION_DAYS,
                world_readable=False,
            )
            _log_resource(
                "rds",
                db_id or "unknown",
                "ok",
                {
                    "storage_encrypted": encrypted,
                    "multi_az": instance.get("MultiAZ", False),
                    "backup_retention_days": instance.get("BackupRetentionPeriod", 0),
                },
            )
            scanned += 1
        except Exception as e:
            _log_resource("rds", db_id or "unknown", "error", error=str(e))
    logger.info("Completed RDS scan")
    return scanned


def _scan_kms(session, customer_id: str) -> int:
    logger.info("Starting KMS scan")
    scanned = 0
    deadline = _service_deadline()
    kms = session.client("kms")
    paginator = kms.get_paginator("list_keys")

    for page in paginator.paginate():
        for key in page.get("Keys", []):
            if _timed_out(deadline):
                logger.warning("KMS scan timed out")
                logger.info("Completed KMS scan")
                return scanned
            key_id = key.get("KeyId")
            try:
                meta = kms.describe_key(KeyId=key_id).get("KeyMetadata", {})
                if meta.get("KeyManager") != "CUSTOMER":
                    continue
                state = (meta.get("KeyState") or "").lower()
                status_map = {"enabled": "active", "disabled": "disabled", "pendingdeletion": "pending_deletion"}
                kms_status = status_map.get(state, state or None)
                rotation_enabled = kms.get_key_rotation_status(KeyId=key_id).get("KeyRotationEnabled", False)

                _upsert_encryption_status(
                    customer_id=customer_id,
                    resource_type="kms",
                    resource_id=key_id,
                    resource_name=meta.get("Description") or key_id,
                    contains_phi=False,
                    encryption_enabled=state == "enabled",
                    kms_key_status=kms_status,
                    access_control_configured=True,
                    overly_permissive=not rotation_enabled,
                    world_readable=False,
                )
                _log_resource(
                    "kms",
                    key_id or "unknown",
                    "ok",
                    {"key_state": kms_status, "rotation_enabled": rotation_enabled},
                )
                scanned += 1
            except Exception as e:
                _log_resource("kms", key_id or "unknown", "error", error=str(e))
    logger.info("Completed KMS scan")
    return scanned


def _scan_cloudtrail(session, customer_id: str) -> int:
    logger.info("Starting CloudTrail scan")
    scanned = 0
    deadline = _service_deadline()
    cloudtrail = session.client("cloudtrail")
    trails = cloudtrail.describe_trails(includeShadowTrails=False).get("trailList", [])

    for trail in trails:
        if _timed_out(deadline):
            logger.warning("CloudTrail scan timed out")
            break
        trail_name = trail.get("Name") or trail.get("TrailARN") or "unknown"
        try:
            status = cloudtrail.get_trail_status(Name=trail_name)
            selectors = cloudtrail.get_event_selectors(TrailName=trail_name)
            data_events_enabled = False
            for selector in selectors.get("EventSelectors", []):
                for data_resource in selector.get("DataResources", []):
                    if data_resource.get("Type") == "AWS::S3::Object":
                        data_events_enabled = True
                        break
                if data_events_enabled:
                    break

            _insert_phi_access_log(
                customer_id=customer_id,
                record_type="phi_access",
                user_id="cloudtrail-service",
                action="read" if data_events_enabled else "write",
                resource_id=trail_name,
                resource_type="cloudtrail",
                transmission_type="internal",
                encrypted=bool(trail.get("KmsKeyId")),
                integrity_verified=bool(trail.get("LogFileValidationEnabled")),
            )
            _log_resource(
                "cloudtrail",
                trail_name,
                "ok",
                {
                    "is_logging": bool(status.get("IsLogging")),
                    "data_events_enabled": data_events_enabled,
                },
            )
            scanned += 1
        except Exception as e:
            _log_resource("cloudtrail", trail_name, "error", error=str(e))
    logger.info("Completed CloudTrail scan")
    return scanned


def _scan_iam(session, customer_id: str) -> int:
    logger.info("Starting IAM scan")
    scanned = 0
    deadline = _service_deadline()
    iam = session.client("iam")
    summary = iam.get_account_summary().get("SummaryMap", {})
    account_mfa_enabled = bool(summary.get("AccountMFAEnabled", 0))

    if not account_mfa_enabled:
        _insert_phi_access_log(
            customer_id=customer_id,
            record_type="risk_analysis",
            user_id="iam-account-summary",
            action="write",
            resource_type="iam",
            resource_id="account",
            document_status="draft",
            remediation_items_open=1,
        )

    paginator = iam.get_paginator("list_users")
    users_without_mfa = set()

    for page in paginator.paginate():
        for user in page.get("Users", []):
            if _timed_out(deadline):
                logger.warning("IAM scan timed out")
                logger.info("Completed IAM scan")
                return scanned
            username = user.get("UserName")
            try:
                mfa_devices = iam.list_mfa_devices(UserName=username).get("MFADevices", [])
                if not mfa_devices:
                    users_without_mfa.add(username)
            except Exception as e:
                _log_resource("iam", username or "unknown", "error", error=str(e))

    try:
        iam.generate_credential_report()
        report = None
        delay_seconds = 0.5
        for _ in range(5):
            try:
                report = iam.get_credential_report().get("Content", b"").decode("utf-8", errors="ignore")
                break
            except ClientError:
                time.sleep(delay_seconds)
                delay_seconds *= 2
        if report is None:
            raise RuntimeError("IAM credential report generation timed out after 5 retries")
        reader = csv.DictReader(io.StringIO(report))
        for row in reader:
            if len(row.keys()) < IAM_CRED_REPORT_MIN_COLUMNS:
                continue
            username = row.get("user")
            password_enabled = (row.get("password_enabled") or "").lower() == "true"
            mfa_active = (row.get("mfa_active") or "").lower() == "true"
            if username and password_enabled and not mfa_active:
                users_without_mfa.add(username)
    except Exception as e:
        logger.warning("Credential report unavailable: %s", e)

    for username in users_without_mfa:
        try:
            _upsert_encryption_status(
                customer_id=customer_id,
                resource_type="iam",
                resource_id=username,
                resource_name=username,
                contains_phi=False,
                encryption_enabled=False,
                access_control_configured=False,
                overly_permissive=True,
                world_readable=False,
            )
            _insert_phi_access_log(
                customer_id=customer_id,
                record_type="risk_analysis",
                user_id=username,
                action="write",
                resource_type="iam",
                resource_id=username,
                document_status="draft",
                remediation_items_open=1,
            )
            _log_resource("iam", username, "ok", {"mfa_enabled": False})
            scanned += 1
        except Exception as e:
            _log_resource("iam", username, "error", error=str(e))
    logger.info("Completed IAM scan")
    return scanned


def _scan_config(session, customer_id: str) -> int:
    logger.info("Starting Config scan")
    scanned = 0
    config = session.client("config")
    try:
        recorders = config.describe_configuration_recorders().get("ConfigurationRecorders", [])
        statuses = config.describe_configuration_recorder_status().get("ConfigurationRecordersStatus", [])
        any_enabled = bool(recorders and any(s.get("recording") for s in statuses))
        if not any_enabled:
            _insert_phi_access_log(
                customer_id=customer_id,
                record_type="risk_analysis",
                user_id="aws-config",
                action="write",
                resource_type="config",
                resource_id="configuration-recorder",
                document_status="draft",
                remediation_items_open=1,
            )
        _log_resource("config", "configuration-recorder", "ok", {"enabled": any_enabled})
        scanned += 1
    except Exception as e:
        _log_resource("config", "configuration-recorder", "error", error=str(e))
    logger.info("Completed Config scan")
    return scanned


def _scan_securityhub(session, customer_id: str) -> int:
    logger.info("Starting SecurityHub scan")
    scanned = 0
    try:
        sh = session.client("securityhub")
        paginator = sh.get_paginator("get_findings")
        count = 0
        for page in paginator.paginate(
            Filters={
                "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
                "SeverityLabel": [
                    {"Value": "CRITICAL", "Comparison": "EQUALS"},
                    {"Value": "HIGH", "Comparison": "EQUALS"},
                ],
            }
        ):
            count += len(page.get("Findings", []))

        _insert_phi_access_log(
            customer_id=customer_id,
            record_type="risk_analysis",
            user_id="securityhub",
            action="read",
            resource_type="securityhub",
            resource_id="active-high-critical-findings",
            document_status=f"open_findings={count}",
            remediation_items_open=count,
        )
        _log_resource("securityhub", "active-high-critical-findings", "ok", {"findings_count": count})
        scanned += 1
    except Exception as e:
        _log_resource("securityhub", "active-high-critical-findings", "error", error=str(e))
    logger.info("Completed SecurityHub scan")
    return scanned


def _run_customer_scan(customer_id: str, role_arn: str, external_id: str) -> dict[str, Any]:
    total_resources_scanned = 0
    table = ddb.Table(CONNECTIONS_TABLE)
    started = datetime.now(timezone.utc).isoformat()
    logger.info("Starting customer scan for %s", customer_id)

    try:
        session = _assume_customer_session(customer_id, role_arn, external_id)
        _seed_baa_if_needed(customer_id)

        scanners = [
            _scan_s3,
            _scan_rds,
            _scan_kms,
            _scan_cloudtrail,
            _scan_iam,
            _scan_config,
            _scan_securityhub,
        ]

        for scanner in scanners:
            try:
                total_resources_scanned += scanner(session, customer_id)
            except Exception as e:
                scanner_name = getattr(scanner, "__name__", scanner.__class__.__name__)
                logger.warning("Service scanner failed (%s): %s", scanner_name, e, exc_info=True)

        table.update_item(
            Key={"customer_id": customer_id},
            UpdateExpression="SET last_scan_at = :ts, scan_status = :s, resources_scanned = :n",
            ExpressionAttributeValues={
                ":ts": datetime.now(timezone.utc).isoformat(),
                ":s": "completed",
                ":n": total_resources_scanned,
            },
        )

        boto3.client("lambda").invoke(
            FunctionName=COLLECTOR_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps(
                {
                    "httpMethod": "POST",
                    "path": "/hipaa/collect",
                    "body": json.dumps({"customer_id": customer_id}),
                }
            ),
        )

        logger.info(
            json.dumps(
                {
                    "event": "scan_complete",
                    "customer_id": customer_id,
                    "started_at": started,
                    "resources_scanned": total_resources_scanned,
                },
                default=str,
            )
        )
        return {
            "customer_id": customer_id,
            "scan_status": "completed",
            "resources_scanned": total_resources_scanned,
        }
    except Exception as e:
        logger.error("Customer scan failed for %s: %s", customer_id, e, exc_info=True)
        table.update_item(
            Key={"customer_id": customer_id},
            UpdateExpression="SET last_scan_at = :ts, scan_status = :s",
            ExpressionAttributeValues={
                ":ts": datetime.now(timezone.utc).isoformat(),
                ":s": "failed",
            },
        )
        return {"customer_id": customer_id, "scan_status": "failed", "error": str(e)}


def _get_connection(customer_id: str) -> dict[str, Any] | None:
    item = ddb.Table(CONNECTIONS_TABLE).get_item(Key={"customer_id": customer_id}).get("Item")
    return item


def _get_connected_customers() -> list[dict[str, Any]]:
    table = ddb.Table(CONNECTIONS_TABLE)
    items: list[dict[str, Any]] = []
    last_evaluated_key = None
    while True:
        kwargs = {}
        if last_evaluated_key:
            kwargs["ExclusiveStartKey"] = last_evaluated_key
        response = table.scan(**kwargs)
        page_items = response.get("Items", [])
        items.extend([item for item in page_items if item.get("status") == "connected"])
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break
    return items


def _handle_post_verify(event: dict[str, Any]) -> dict[str, Any]:
    customer_id = event.get("customer_id")
    role_arn = event.get("role_arn")
    external_id = event.get("external_id")
    if not all([customer_id, role_arn, external_id]):
        return {"error": "post_verify requires customer_id, role_arn, external_id"}
    return _run_customer_scan(customer_id, role_arn, external_id)


def _handle_on_demand(event: dict[str, Any]) -> dict[str, Any]:
    if event.get("httpMethod") == "OPTIONS":
        return _response(200, {"ok": True})
    customer_id = _get_customer_id_from_event(event)
    if not customer_id:
        return _response(401, {"error": "Unauthorized"})

    conn = _get_connection(customer_id)
    if not conn or conn.get("status") != "connected":
        return _response(404, {"error": "connected customer not found"})

    role_arn = conn.get("role_arn")
    if not role_arn:
        return _response(400, {"error": "connected role ARN not found"})

    try:
        _invoke_compliance_score(customer_id, role_arn, "api_scan_trigger")
        return _response(202, {"scan_status": "queued", "customer_id": customer_id})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not invoke compliance score lambda: %s", exc)
        return _response(500, {"error": "Failed to queue scan"})


def _handle_scheduled() -> dict[str, Any]:
    results = []
    for item in _get_connected_customers():
        customer_id = item.get("customer_id")
        role_arn = item.get("role_arn")
        external_id = item.get("external_id")
        if not all([customer_id, role_arn, external_id]):
            logger.warning("Skipping incomplete connection item for customer %s", customer_id)
            continue
        results.append(_run_customer_scan(customer_id, role_arn, external_id))
    return {"trigger": "scheduled", "customers_scanned": len(results), "results": results}


def lambda_handler(event, context):
    logger.info("AWS scanner invoked")
    logger.debug("Event: %s", json.dumps(event, default=str))

    if event.get("trigger") == "post_verify":
        return _handle_post_verify(event)

    if event.get("source") == "aws.events":
        return _handle_scheduled()

    if event.get("httpMethod") == "POST" and event.get("path") == "/scan/trigger":
        return _handle_on_demand(event)

    return _response(400, {"error": "Unsupported trigger mode"})
