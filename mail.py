#!/usr/bin/env python3
"""
ses_check.py
Quick diagnostic for cedrickbyrd@tximhotep.com SES inbound setup.
Requirements: pip install boto3
Run: python ses_check.py
"""

import subprocess
import sys

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
except ImportError:
    print("Installing boto3...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "boto3", "-q"])
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

REGION  = "us-east-1"
DOMAIN  = "tximhotep.com"
EMAIL   = "cedrickbyrd@tximhotep.com"

OK   = "✅"
FAIL = "❌"
WARN = "⚠️ "

def header(title):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print(f"{'─'*50}")

# ── 1. MX Record ─────────────────────────────────────────────────────────────
header("1. MX Record — does tximhotep.com point to SES?")
try:
    result = subprocess.run(
        ["nslookup", "-type=MX", DOMAIN],
        capture_output=True, text=True, timeout=10
    )
    output = result.stdout + result.stderr
    ses_mx = "inbound-smtp.us-east-1.amazonaws.com"
    if ses_mx in output:
        print(f"{OK}  MX record found → {ses_mx}")
    elif "amazonaws.com" in output:
        print(f"{WARN} MX points to AWS but unexpected endpoint:")
        for line in output.splitlines():
            if "amazonaws" in line:
                print(f"    {line.strip()}")
    else:
        print(f"{FAIL} No SES MX record found for {DOMAIN}")
        print(f"    Expected: 10 {ses_mx}")
        print(f"    Fix: Add this MX record in Route 53 / your DNS provider")
        for line in output.splitlines():
            if line.strip() and "Server" not in line and "Address" not in line:
                print(f"    Found instead: {line.strip()}")
except FileNotFoundError:
    # nslookup not available — try dig
    try:
        result = subprocess.run(
            ["dig", "MX", DOMAIN, "+short"],
            capture_output=True, text=True, timeout=10
        )
        output = result.stdout.strip()
        if "inbound-smtp.us-east-1" in output:
            print(f"{OK}  MX record found → {output}")
        elif output:
            print(f"{FAIL} MX record found but not pointing to SES us-east-1:")
            print(f"    {output}")
        else:
            print(f"{FAIL} No MX record found for {DOMAIN}")
    except Exception as e:
        print(f"{WARN} Could not run DNS lookup: {e}")
        print(f"    Manual check: nslookup -type=MX {DOMAIN}")

# ── 2. SES Receipt Rules ──────────────────────────────────────────────────────
header("2. SES Receipt Rules — is inbound routing configured?")
try:
    ses = boto3.client("ses", region_name=REGION)

    # Check active rule set
    try:
        active = ses.describe_active_receipt_rule_set()
        rule_set = active.get("Metadata", {})
        rules    = active.get("Rules", [])

        if not rule_set:
            print(f"{FAIL} No active receipt rule set found")
            print(f"    Fix: SES → Email receiving → Create rule set → Set as active")
        else:
            name = rule_set.get("Name", "unknown")
            print(f"{OK}  Active rule set: '{name}' ({len(rules)} rule(s))")

            if not rules:
                print(f"{FAIL} Rule set is active but has zero rules — mail will be dropped")
            else:
                email_matched = False
                for rule in rules:
                    rname    = rule.get("Name", "unnamed")
                    enabled  = rule.get("Enabled", False)
                    recips   = rule.get("Recipients", [])
                    actions  = rule.get("Actions", [])

                    status = OK if enabled else WARN
                    print(f"\n  Rule: '{rname}' — {'enabled' if enabled else 'DISABLED'} {status}")

                    if recips:
                        print(f"    Recipients: {', '.join(recips)}")
                        if EMAIL in recips or DOMAIN in recips or not recips:
                            email_matched = True
                    else:
                        print(f"    Recipients: (catch-all — matches all addresses)")
                        email_matched = True

                    for action in actions:
                        action_type = list(action.keys())[0]
                        detail = action[action_type]
                        if action_type == "S3Action":
                            bucket = detail.get("BucketName", "?")
                            prefix = detail.get("ObjectKeyPrefix", "")
                            print(f"    Action: Save to S3 → s3://{bucket}/{prefix}")
                        elif action_type == "LambdaAction":
                            fn = detail.get("FunctionArn", "?").split(":")[-1]
                            print(f"    Action: Invoke Lambda → {fn}")
                        elif action_type == "SNSAction":
                            topic = detail.get("TopicArn", "?").split(":")[-1]
                            print(f"    Action: Publish to SNS → {topic}")
                        elif action_type == "BounceAction":
                            print(f"    Action: Bounce (mail rejected)")
                        else:
                            print(f"    Action: {action_type}")

                if not email_matched:
                    print(f"\n{FAIL} No rule matches {EMAIL} — mail will be dropped")
                    print(f"    Fix: Add {EMAIL} or {DOMAIN} to a rule's recipients")
                else:
                    print(f"\n{OK}  {EMAIL} is covered by at least one rule")

    except ClientError as e:
        if "RuleSetDoesNotExist" in str(e) or "NoSuchActiveRuleSet" in str(e):
            print(f"{FAIL} No active receipt rule set")
            print(f"    Fix: SES → Email receiving → Create rule set → Set as active")
        else:
            raise

    # ── 3. Domain verification ────────────────────────────────────────────────
    header("3. SES Domain Verification — is tximhotep.com verified?")
    try:
        identity = ses.get_identity_verification_attributes(Identities=[DOMAIN, EMAIL])
        attrs    = identity.get("VerificationAttributes", {})

        for ident in [DOMAIN, EMAIL]:
            info   = attrs.get(ident, {})
            status = info.get("VerificationStatus", "NotFound")
            if status == "Success":
                print(f"{OK}  {ident} → Verified")
            elif status == "Pending":
                print(f"{WARN} {ident} → Pending (check DNS for TXT record)")
            elif status == "NotFound" or not info:
                print(f"{FAIL} {ident} → Not found in SES")
            else:
                print(f"{WARN} {ident} → {status}")
    except ClientError as e:
        print(f"{WARN} Could not check verification: {e}")

    # ── 4. Sending limits / sandbox ───────────────────────────────────────────
    header("4. SES Account Status — sandbox or production?")
    try:
        quota = ses.get_send_quota()
        max24 = quota.get("Max24HourSend", 0)
        if max24 <= 200:
            print(f"{WARN} Account appears to be in SANDBOX (max 200 sends/day)")
            print(f"    Note: sandbox doesn't affect inbound receiving")
            print(f"    But if you're sending replies, recipients must be verified")
        else:
            print(f"{OK}  Production account (max {int(max24):,} sends/day)")
    except ClientError:
        print(f"{WARN} Could not check send quota")

except NoCredentialsError:
    print(f"\n{FAIL} No AWS credentials found")
    print("    Run: aws configure")
    print("    Or set: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars")
except ClientError as e:
    print(f"\n{FAIL} AWS API error: {e}")

# ── Summary ───────────────────────────────────────────────────────────────────
header("Summary")
print(f"""
If all checks passed:
  → Mail IS being received and routed somewhere (S3/Lambda/SNS)
  → To READ it: check the S3 bucket or Lambda logs shown above

If MX record failed:
  → Add MX record to your DNS: 10 inbound-smtp.us-east-1.amazonaws.com

If no receipt rules:
  → SES Console → Email receiving → Receipt rules → Create rule
  → Add recipient: {EMAIL}
  → Add action: Save to S3 (pick or create a bucket)
  → Activate the rule set

To read mail from S3:
  aws s3 ls s3://YOUR_BUCKET/ --recursive
  aws s3 cp s3://YOUR_BUCKET/YOUR_EMAIL_KEY ./email.txt && cat email.txt
""")
