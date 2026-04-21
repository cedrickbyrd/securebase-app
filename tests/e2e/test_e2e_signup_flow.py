import json
import os
import sys
import time
import uuid
import re
import boto3
import requests
e.g. https://api.securebase.tximhotep.com/v1 disposable/test email you can receive
ARN of the RDS secret for direct DB checks default us-east-1
seconds to wait for provisioner to start (default 30) set to "false" to keep test data after run
# ── Config ────────────────────────────────────────────────────────────────
API_BASE
TEST_EMAIL
DB_SECRET_ARN
AWS_REGION
PROV_TIMEOUT
= os.environ["API_BASE_URL"].rstrip("/")
= os.environ["TEST_EMAIL"]
= os.environ["DB_SECRET_ARN"]
= os.environ.get("AWS_REGION", "us-east-1")
= int(os.environ.get("PROVISIONER_TIMEOUT", "30"))
 CLEANUP = os.environ.get("CLEANUP", "true").lower() != "false" # Unique per run so repeated runs don't collide
RUN_ID
ORG_NAME
rds_data
cognito
ssm
PASS=" FAIL=" WARN="
= uuid.uuid4().hex[:8] = f"SmokeTest-{RUN_ID}"
= boto3.client("rds-data", region_name=AWS_REGION)
= boto3.client("cognito-idp", region_name=AWS_REGION) = boto3.client("ssm", region_name=AWS_REGION)
"
"
"
   results = []
# ── Helpers ───────────────────────────────────────────────────────────────
def get_param(name):
return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]
def db_query(sql, params=None):
"""Execute SQL against Aurora via RDS Data API.""" cluster_arn = get_param("/securebase/db/cluster_arn") db_name = get_param("/securebase/db/name")
kwargs = dict(
resourceArn=cluster_arn, secretArn=DB_SECRET_ARN, database=db_name, sql=sql,
)
if params:
kwargs["parameters"] = params
return rds_data.execute_statement(**kwargs)
def check(name, condition, detail=""): icon = PASS if condition else FAIL msg = f"{icon} {name}"
if detail:
msg += f" — {detail}" print(msg)
results.append((name, condition)) return condition
def section(title): print(f"\n{'─'*60}") print(f" {title}")

 print(f"{'─'*60}")
# ── Step 1: Health check ──────────────────────────────────────────────────
def test_health():
section("Step 1: API Health")
r = requests.get(f"{API_BASE}/health", timeout=10)
check("API reachable", r.status_code == 200)
body = r.json()
check("DB healthy", body.get("checks", {}).get("database") == "healthy",
body.get("checks", {}).get("database"))
# ── Step 2: POST /signup ──────────────────────────────────────────────────
def test_signup(): section("Step 2: POST payload = {
/signup")
"firstName":
"lastName":
"email":
"password":
"orgName":
"orgSize":
"industry":
"awsRegion":
"mfaEnabled": "guardrailsLevel": "standard",
"Smoke",
"Test",
TEST_EMAIL, f"SmokeTest!{RUN_ID}Aa1", ORG_NAME,
"1-10", "fintech", "us-east-1", True,
}
r =
check("POST /signup returns 201", r.status_code == 201,
requests.post(f"{API_BASE}/signup", json=payload, timeout=15) f"got {r.status_code}: {r.text[:200]}")
body = r.json()
job_id = body.get("jobId", "")
check("Response contains jobId", bool(job_id), job_id) check("jobId is valid UUID",
bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12 job_id)))
    return job_id
# ── Step 3: DB state after signup ─────────────────────────────────────────
def test_db_after_signup(job_id): section("Step 3: DB state post-signup")
# Customer row r = db_query(
}$",

 "SELECT id, email, email_verified, status FROM customers " "WHERE email = :email LIMIT 1",
[{"name": "email", "value": {"stringValue": TEST_EMAIL}}]
)
rows = r.get("records", [])
check("customers row exists", len(rows) == 1) if rows:
customer_id = rows[0][0]["stringValue"]
email_verified = rows[0][2]["booleanValue"]
status = rows[0][3]["stringValue"]
check("email_verified = FALSE before verify", not email_verified) check("status = pending_verification", status == "pending_verification", statu
else:
customer_id = None
# Onboarding job row r2 = db_query(
"SELECT id, status FROM onboarding_jobs WHERE id = :jid LIMIT 1", [{"name": "jid", "value": {"stringValue": job_id}}]
)
job_rows = r2.get("records", [])
check("onboarding_jobs row exists", len(job_rows) == 1) if job_rows:
job_status = job_rows[0][1]["stringValue"] check("job status is pending or waiting_for_email",
job_status in ("pending", "waiting_for_email"), job_status) return customer_id
# ── Step 4: GET /verify-email ─────────────────────────────────────────────
def test_verify_email(job_id): section("Step 4: GET /verify-email")
# Test: bad token format → 400 r_bad = requests.get(
f"{API_BASE}/verify-email",
params={"token": "not-a-uuid", "email": TEST_EMAIL}, timeout=10
)
check("Invalid token returns 400", r_bad.status_code == 400,
f"got {r_bad.status_code}")
# Test: missing params → 400
r_missing = requests.get(f"{API_BASE}/verify-email", timeout=10) check("Missing params returns 400", r_missing.status_code == 400,
f"got {r_missing.status_code}")
s)

 # Test: valid token r = requests.get(
f"{API_BASE}/verify-email",
params={"token": job_id, "email": TEST_EMAIL}, timeout=15
)
check("GET /verify-email returns 200", r.status_code == 200,
f"got {r.status_code}: {r.text[:200]}")
body = r.json()
check("Response confirms verification", "verified" in body.get("message", "").lowe
body.get("message"))
check("Response echoes jobId", body.get("jobId") == job_id)
# Test idempotency: second click should also return 200 r2 = requests.get(
f"{API_BASE}/verify-email",
params={"token": job_id, "email": TEST_EMAIL}, timeout=15
)
check("Second verify click returns 200 (idempotent)", r2.status_code == 200,
f"got {r2.status_code}")
# ── Step 5: DB state after verify ─────────────────────────────────────────
def test_db_after_verify(customer_id): section("Step 5: DB state post-verify")
r = db_query(
"SELECT email_verified, status FROM customers WHERE id = :cid LIMIT 1", [{"name": "cid", "value": {"stringValue": customer_id}}]
)
rows = r.get("records", []) if rows:
email_verified = rows[0][0]["booleanValue"]
status = rows[0][1]["stringValue"] check("email_verified = TRUE", email_verified) check("status = active", status == "active", status)
else:
check("customer row still exists post-verify", False)
# ── Step 6: Provisioner starts ────────────────────────────────────────────
def test_provisioner_starts(job_id):
section(f"Step 6: Provisioner transitions (polling {PROV_TIMEOUT}s)") deadline = time.time() + PROV_TIMEOUT
r(),

 final_status = None
while time.time() < deadline:
r = db_query(
"SELECT status FROM onboarding_jobs WHERE id = :jid LIMIT 1", [{"name": "jid", "value": {"stringValue": job_id}}]
)
rows = r.get("records", []) if rows:
final_status = rows[0][0]["stringValue"]
if final_status in ("in_progress", "complete"):
break time.sleep(3)
check("Provisioner moved job out of pending/waiting", final_status in ("in_progress", "complete", "failed"), f"final status: {final_status}")
check("Provisioner not stuck in failed", final_status != "failed",
f"check CloudWatch logs for job {job_id}")
# ── Step 7: Cognito state ─────────────────────────────────────────────────
def test_cognito_verified():
section("Step 7: Cognito email_verified attribute") user_pool_id = get_param("/securebase/cognito/user_pool_id") try:
resp = cognito.admin_get_user(UserPoolId=user_pool_id, Username=TEST_EMAIL) attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])} check("Cognito email_verified = true",
attrs.get("email_verified") == "true",
attrs.get("email_verified"))
except cognito.exceptions.UserNotFoundException:
check("Cognito user exists", False, "user not found")
# ── Step 8: Cross-account assume-role (PR #563 validation) ────────────────
def test_cross_account_assume_role():
section("Step 8: Cross-account assume-role (PR #563)") management_account_id = get_param("/securebase/management_account_id") environment = get_param("/securebase/environment")
role_arn = (
f"arn:aws:iam::{management_account_id}:role/"
f"securebase-{environment}-lambda-execution" )
sts = boto3.client("sts", region_name=AWS_REGION) try:
resp = sts.get_caller_identity()

 current_arn = resp["Arn"]
check("STS callable from test runner", True, current_arn)
# Note: full cross-account assume-role requires the Lambda execution role
# to be the caller. This check confirms the management account ARN resolves. check("Management account ID resolvable",
bool(management_account_id), management_account_id)
print(f" Full cross-account test runs inside Lambda context.") print(f" Expected role: {role_arn}")
except Exception as e:
check("STS reachable", False, str(e))
# ── Cleanup ───────────────────────────────────────────────────────────────
def cleanup(customer_id):
    if not CLEANUP:
print(f"\n{WARN} CLEANUP=false — test data retained (customer_id={customer_id}
return
section("Cleanup")
user_pool_id = get_param("/securebase/cognito/user_pool_id") try:
cognito.admin_delete_user(UserPoolId=user_pool_id, Username=TEST_EMAIL)
print(f" Cognito user deleted: {TEST_EMAIL}") except Exception as e:
print(f" {WARN} Cognito delete skipped: {e}") try:
db_query(
"DELETE FROM customers WHERE email = :email",
[{"name": "email", "value": {"stringValue": TEST_EMAIL}}]
)
print(f" DB customer row deleted: {TEST_EMAIL}") except Exception as e:
print(f" {WARN} DB delete skipped: {e}")
# ── Summary ───────────────────────────────────────────────────────────────
def summary():
section("Results")
passed = sum(1 for _, ok in results if ok) total = len(results)
for name, ok in results:
print(f" {PASS if ok else FAIL} {name}") print(f"\n {passed}/{total} checks passed") return passed == total
# ── Main ──────────────────────────────────────────────────────────────────
def main():
  )")

  print(f"\n SecureBase E2E Smoke Test") print(f" API: {API_BASE}")
print(f" Email: {TEST_EMAIL}")
print(f" RunID: {RUN_ID}")
customer_id = None job_id = None
try:
    test_health()
job_id =
customer_id = test_verify_email(job_id) if customer_id:
test_signup()
test_db_after_signup(job_id)
            test_db_after_verify(customer_id)
        test_provisioner_starts(job_id)
        test_cognito_verified()
        test_cross_account_assume_role()
except Exception as e:
print(f"\n{FAIL} Unexpected error: {e}") import traceback; traceback.print_exc()
    finally:
        if customer_id:
            cleanup(customer_id)
passed = summary() sys.exit(0 if passed else 1)
if __name__ == "__main__":
