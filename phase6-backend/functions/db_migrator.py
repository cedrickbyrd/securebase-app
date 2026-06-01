from __future__ import annotations
import json, logging, os
from typing import Any
import boto3, psycopg2

logger = logging.getLogger()
logger.setLevel(logging.INFO)
REGION = os.environ.get("AWS_REGION", "us-east-1")
DEFAULT_MIGRATIONS = ["001_audit_evidence_tables", "002_compliance_score_history"]
REQUIRED_TABLES = ["schema_migrations", "evidence_packages", "macie_findings", "compliance_score_daily", "control_violation_log"]
MIGRATION_SQL: dict[str, str] = {}

def _load_inline_sql() -> None:
    import pathlib
    base = pathlib.Path("/var/task/migrations")
    if not base.exists():
        return
    for f in sorted(base.glob("*.sql")):
        MIGRATION_SQL[f.stem] = f.read_text()

_load_inline_sql()

def _get_conn(secret_arn: str):
    sm = boto3.client("secretsmanager", region_name=REGION)
    secret = json.loads(sm.get_secret_value(SecretId=secret_arn)["SecretString"])
    host = secret.get("host") or secret.get("hostname")
    port = int(secret.get("port", 5432))
    dbname = secret.get("dbname") or secret.get("database", "securebase")
    user = secret.get("username") or secret.get("user")
    password = secret.get("password")
    if not all([host, user, password]):
        raise ValueError(f"Incomplete credentials in secret {secret_arn}")
    return psycopg2.connect(host=host, port=port, dbname=dbname, user=user, password=password, sslmode="require", connect_timeout=10)

def _bootstrap(cur: Any) -> None:
    cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());")

def _apply(cur: Any, version: str, sql: str) -> str:
    cur.execute("SELECT 1 FROM schema_migrations WHERE version = %s LIMIT 1;", (version,))
    if cur.fetchone():
        return "skipped"
    logger.info("[apply] %s", version)
    cur.execute(sql)
    cur.execute("INSERT INTO schema_migrations(version) VALUES (%s) ON CONFLICT (version) DO NOTHING;", (version,))
    return "applied"

def _validate(cur: Any) -> list[str]:
    missing = []
    for table in REQUIRED_TABLES:
        cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s);", (table,))
        if not cur.fetchone()[0]:
            missing.append(table)
    return missing

def handler(event: dict, _context: Any) -> dict:
    secret_arn: str = event.get("db_secret_arn", "")
    if not secret_arn:
        return {"statusCode": 400, "error": "db_secret_arn is required"}
    migration_names: list[str] = event.get("migration_files", DEFAULT_MIGRATIONS)
    validate: bool = bool(event.get("validate_required_tables", False))
    results: list[dict] = []
    missing_tables: list[str] = []
    try:
        conn = _get_conn(secret_arn)
        conn.autocommit = False
        with conn:
            with conn.cursor() as cur:
                _bootstrap(cur)
                for version in migration_names:
                    sql = MIGRATION_SQL.get(version)
                    if sql is None:
                        results.append({"version": version, "status": "error", "detail": "SQL not found in Lambda bundle"})
                        conn.rollback()
                        return {"statusCode": 500, "error": f"SQL not bundled for migration: {version}", "results": results}
                    status = _apply(cur, version, sql)
                    results.append({"version": version, "status": status})
                if validate:
                    missing_tables = _validate(cur)
        conn.close()
    except Exception as exc:
        logger.exception("Migration failed")
        return {"statusCode": 500, "error": str(exc), "results": results}
    if missing_tables:
        return {"statusCode": 500, "error": "Validation failed — missing required tables", "missing_tables": missing_tables, "results": results}
    return {"statusCode": 200, "results": results, "validated": validate}
