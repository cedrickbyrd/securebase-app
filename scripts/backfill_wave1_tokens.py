#!/usr/bin/env python3
"""
backfill_wave1_tokens.py

One-time migration: backfill `status`, `created_at`, and `expires_at` on the
17 Wave 1 invite token records that were written before trigger_onboarding.py
included those fields.

What it does:
  - Scans securebase-tokens for invite records with no `status` attribute
  - Sets status      = "active"
  - Sets created_at  = "2026-05-16"  (known Wave 1 send date)
  - Sets expires_at  = 30 days from created_at
  - Skips test addresses (example.com, tximhotep.com)
  - Dry-run by default; pass --apply to write changes

Usage:
  python3 backfill_wave1_tokens.py              # dry run
  python3 backfill_wave1_tokens.py --apply      # write to DynamoDB
  python3 backfill_wave1_tokens.py --apply --table my-tokens-table
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr

WAVE1_CREATED_AT = "2026-05-16"
TOKEN_TTL_DAYS   = 30
TEST_DOMAINS     = {"example.com", "tximhotep.com"}

def is_test_address(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in TEST_DOMAINS

def expires_at_from(created_date: str) -> str:
    dt = datetime.strptime(created_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return (dt + timedelta(days=TOKEN_TTL_DAYS)).isoformat()

def backfill(table_name: str, apply: bool) -> None:
    ddb   = boto3.resource("dynamodb")
    table = ddb.Table(table_name)

    # Scan for invite tokens with no status field
    items = []
    kwargs = {
        "FilterExpression": (
            Attr("type").eq("invite") & Attr("status").not_exists()
        )
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last

    real    = [i for i in items if not is_test_address(i.get("email", ""))]
    skipped = [i for i in items if     is_test_address(i.get("email", ""))]

    print(f"Found {len(items)} token(s) with no status field")
    print(f"  {len(real)} real invite(s) to backfill")
    print(f"  {len(skipped)} test address(es) skipped\n")

    expires = expires_at_from(WAVE1_CREATED_AT)

    for item in real:
        token = item["token"]
        email = item["email"]
        print(f"  {'[DRY RUN] ' if not apply else ''}backfill {email[:45]:45} token={token[:12]}...")
        if apply:
            table.update_item(
                Key={"token": token},
                UpdateExpression=(
                    "SET #s = :status, created_at = :ca, expires_at = :ex"
                ),
                ConditionExpression=Attr("status").not_exists(),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":status": "active",
                    ":ca":     WAVE1_CREATED_AT,
                    ":ex":     expires,
                },
            )

    if skipped:
        print(f"\nSkipped test addresses:")
        for item in skipped:
            print(f"  {item.get('email', 'NO_EMAIL')}")

    print(f"\n{'Applied' if apply else 'Dry run complete — pass --apply to write changes'}")
    if apply:
        print(f"  status=active, created_at={WAVE1_CREATED_AT}, expires_at={expires}")

def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill Wave 1 invite tokens")
    parser.add_argument("--apply",  action="store_true", help="Write changes to DynamoDB")
    parser.add_argument("--table",  default="securebase-tokens", help="DynamoDB table name")
    args = parser.parse_args()

    if args.apply:
        confirm = input("This will modify live DynamoDB records. Type YES to proceed: ")
        if confirm.strip() != "YES":
            print("Aborted.")
            sys.exit(0)

    backfill(args.table, args.apply)

if __name__ == "__main__":
    main()
