"""
SecureBase live E2E signup smoke test.

Required environment variables:
- API_BASE_URL: API base URL (e.g. https://api.securebase.tximhotep.com/v1)
- TEST_EMAIL: Disposable/test email address
- DB_SECRET_ARN: ARN of the RDS secret for direct DB checks
- AWS_REGION: AWS region (default: us-east-1)
- PROVISIONER_TIMEOUT: Seconds to wait for provisioner transition (default: 30)
- CLEANUP: Set to "false" to retain test data after run
"""

import os
import sys
import time
import uuid
import re

import boto3
import requests

# ── Config ────────────────────────────────────────────────────────────────
API_BASE = os.environ["API_BASE_URL"].rstrip("/")
TEST_EMAIL = os.environ["TEST_EMAIL"]
DB_SECRET_ARN = os.environ["DB_SECRET_ARN"]
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
PROV_TIMEOUT = int(os.environ.get("PROVISIONER_TIMEOUT", "30"))
CLEANUP = os.environ.get("CLEANUP", "true").lower() != "false"

# Unique per run so repeated runs don't collide
RUN_ID = uuid.uuid4().hex[:8]
ORG_NAME = f"SmokeTest-{RUN_ID}"

rds_data = boto3.client("rds-data", region_name=AWS_REGION)
cognito = boto3.client("cognito-idp", region_name=AWS_REGION)
ssm = boto3.client("ssm", region_name=AWS_REGION)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"

results = []


# ── Helpers ───────────────────────────────────────────────────────────────
def get_param(name):
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def db_query(sql, params=None):
    """Execute SQL against Aurora via RDS Data API."""
    cluster_arn = get_param("/securebase/db/cluster_arn")
    db_name = get_param("/securebase/db/name")

    kwargs = {
        "resourceArn": cluster_arn,
        "secretArn": DB_SECRET_ARN,
        "database": db_name,
        "sql": sql,
    }
    if params:
        kwargs["parameters"] = params

    return rds_data.execute_statement(**kwargs)


def check(name, condition, detail=""):
    icon = PASS if condition else FAIL
    msg = f"{icon} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append((name, condition))
    return condition


def section(title):
    print(f"\n{'─' * 60}")
    print(f" {title}")
    print(f"{'─' * 60}")


# ── Step 1: Health check ──────────────────────────────────────────────────
def test_health():
    section("Step 1: API Health")
    response = requests.get(f"{API_BASE}/health", timeout=10)
    check("API reachable", response.status_code == 200)

    body = response.json()
    db_status = body.get("checks", {}).get("database")
    check("DB healthy", db_status == "healthy", db_status)


# ── Step 2: POST /signup ──────────────────────────────────────────────────
def test_signup():
    section("Step 2: POST /signup")

    payload = {
        "firstName": "Smoke",
        "lastName": "Test",
        "email": TEST_EMAIL,
        "password": f"SmokeTest!{RUN_ID}Aa1",
        "orgName": ORG_NAME,
        "orgSize": "1-10",
        "industry": "fintech",
        "awsRegion": "us-east-1",
        "mfaEnabled": True,
        "guardrailsLevel": "standard",
    }

    response = requests.post(f"{API_BASE}/signup", json=payload, timeout=15)
    check(
        "POST /signup returns 201",
        response.status_code == 201,
        f"got {response.status_code}: {response.text[:200]}",
    )

    body = response.json()
    job_id = body.get("jobId", "")
    check("Response contains jobId", bool(job_id), job_id)
    check(
        "jobId is valid UUID",
        bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", job_id)),
    )

    return job_id


# ── Step 3: DB state after signup ─────────────────────────────────────────
def test_db_after_signup(job_id):
    section("Step 3: DB state post-signup")

    customers = db_query(
        "SELECT id, email, email_verified, status FROM customers WHERE email = :email LIMIT 1",
        [{"name": "email", "value": {"stringValue": TEST_EMAIL}}],
    ).get("records", [])

    check("customers row exists", len(customers) == 1)
    customer_id = None

    if customers:
        customer_id = customers[0][0]["stringValue"]
        email_verified = customers[0][2]["booleanValue"]
        status = customers[0][3]["stringValue"]
        check("email_verified=FALSE before verify", not email_verified)
        check("status=pending_verification", status == "pending_verification", status)

    jobs = db_query(
        "SELECT id, status FROM onboarding_jobs WHERE id = :jid LIMIT 1",
        [{"name": "jid", "value": {"stringValue": job_id}}],
    ).get("records", [])

    check("onboarding_jobs row exists", len(jobs) == 1)
    if jobs:
        job_status = jobs[0][1]["stringValue"]
        check(
            "job status pending or waiting_for_email",
            job_status in ("pending", "waiting_for_email"),
            job_status,
        )

    return customer_id


# ── Step 4: GET /verify-email ─────────────────────────────────────────────
def test_verify_email(job_id):
    section("Step 4: GET /verify-email")

    bad = requests.get(
        f"{API_BASE}/verify-email",
        params={"token": "not-a-uuid", "email": TEST_EMAIL},
        timeout=10,
    )
    check("Invalid token returns 400", bad.status_code == 400, f"got {bad.status_code}")

    missing = requests.get(f"{API_BASE}/verify-email", timeout=10)
    check("Missing params returns 400", missing.status_code == 400, f"got {missing.status_code}")

    verified = requests.get(
        f"{API_BASE}/verify-email",
        params={"token": job_id, "email": TEST_EMAIL},
        timeout=15,
    )
    check(
        "GET /verify-email returns 200",
        verified.status_code == 200,
        f"got {verified.status_code}: {verified.text[:200]}",
    )

    body = verified.json()
    check(
        "Response confirms verification",
        "verified" in body.get("message", "").lower(),
        body.get("message", ""),
    )
    check("Response echoes jobId", body.get("jobId") == job_id)

    idempotent = requests.get(
        f"{API_BASE}/verify-email",
        params={"token": job_id, "email": TEST_EMAIL},
        timeout=15,
    )
    check(
        "Second verify click returns 200 (idempotent)",
        idempotent.status_code == 200,
        f"got {idempotent.status_code}",
    )


# ── Step 5: DB state after verify ─────────────────────────────────────────
def test_db_after_verify(customer_id):
    section("Step 5: DB state post-verify")

    rows = db_query(
        "SELECT email_verified, status FROM customers WHERE id = :cid LIMIT 1",
        [{"name": "cid", "value": {"stringValue": customer_id}}],
    ).get("records", [])

    if rows:
        email_verified = rows[0][0]["booleanValue"]
        status = rows[0][1]["stringValue"]
        check("email_verified=TRUE", email_verified)
        check("status=active", status == "active", status)
    else:
        check("customer row still exists post-verify", False)


# ── Step 6: Provisioner transitions ───────────────────────────────────────
def test_provisioner_starts(job_id):
    section(f"Step 6: Provisioner transitions (polling {PROV_TIMEOUT}s)")

    deadline = time.time() + PROV_TIMEOUT
    final_status = None

    while time.time() < deadline:
        rows = db_query(
            "SELECT status FROM onboarding_jobs WHERE id = :jid LIMIT 1",
            [{"name": "jid", "value": {"stringValue": job_id}}],
        ).get("records", [])

        if rows:
            final_status = rows[0][0]["stringValue"]
            if final_status in ("in_progress", "complete"):
                break

        time.sleep(3)

    check(
        "Provisioner reached in_progress/complete",
        final_status in ("in_progress", "complete"),
        f"final status: {final_status}",
    )


# ── Step 7: Cognito state ─────────────────────────────────────────────────
def test_cognito_verified():
    section("Step 7: Cognito email_verified attribute")

    user_pool_id = get_param("/securebase/cognito/user_pool_id")

    try:
        response = cognito.admin_get_user(UserPoolId=user_pool_id, Username=TEST_EMAIL)
        attrs = {item["Name"]: item["Value"] for item in response.get("UserAttributes", [])}
        check("Cognito email_verified=true", attrs.get("email_verified") == "true", attrs.get("email_verified"))
    except cognito.exceptions.UserNotFoundException:
        check("Cognito user exists", False, "user not found")


# ── Step 8: Cross-account assume-role (PR #563 validation) ────────────────
def test_cross_account_assume_role():
    section("Step 8: Cross-account assume-role (PR #563)")

    management_account_id = get_param("/securebase/management_account_id")
    environment = get_param("/securebase/environment")
    role_arn = f"arn:aws:iam::{management_account_id}:role/securebase-{environment}-lambda-execution"

    sts = boto3.client("sts", region_name=AWS_REGION)

    try:
        identity = sts.get_caller_identity()
        current_arn = identity["Arn"]
        check("STS callable from test runner", True, current_arn)
        check("Management account ID resolvable", bool(management_account_id), management_account_id)
        print("ℹ️ Full cross-account test runs inside Lambda context")
        print(f"ℹ️ Expected role: {role_arn}")
    except Exception as exc:
        check("STS reachable", False, str(exc))


# ── Cleanup ───────────────────────────────────────────────────────────────
def cleanup():
    if not CLEANUP:
        print(f"\n{WARN} CLEANUP=false — test data retained ({TEST_EMAIL})")
        return

    section("Cleanup")
    user_pool_id = get_param("/securebase/cognito/user_pool_id")

    try:
        cognito.admin_delete_user(UserPoolId=user_pool_id, Username=TEST_EMAIL)
        print(f"✅ Cognito user deleted: {TEST_EMAIL}")
    except Exception as exc:
        print(f"{WARN} Cognito delete skipped: {exc}")

    try:
        db_query(
            "DELETE FROM customers WHERE email = :email",
            [{"name": "email", "value": {"stringValue": TEST_EMAIL}}],
        )
        print(f"✅ DB customer row deleted: {TEST_EMAIL}")
    except Exception as exc:
        print(f"{WARN} DB delete skipped: {exc}")


# ── Summary ───────────────────────────────────────────────────────────────
def summary():
    section("Results")
    passed = sum(1 for _, ok in results if ok)
    total = len(results)

    for name, ok in results:
        print(f"{'✅' if ok else '❌'} {name}")

    print(f"\n{passed}/{total} checks passed")
    return passed == total


# ── Main ──────────────────────────────────────────────────────────────────
def main():
    print("\nSecureBase E2E Smoke Test")
    print(f"API: {API_BASE}")
    print(f"Email: {TEST_EMAIL}")
    print(f"RunID: {RUN_ID}")

    customer_id = None

    try:
        test_health()
        job_id = test_signup()
        customer_id = test_db_after_signup(job_id)
        test_verify_email(job_id)

        if customer_id:
            test_db_after_verify(customer_id)

        test_provisioner_starts(job_id)
        test_cognito_verified()
        test_cross_account_assume_role()
    except Exception as exc:
        print(f"\n{FAIL} Unexpected error: {exc}")
        import traceback
        traceback.print_exc()
    finally:
        cleanup()

    passed = summary()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
