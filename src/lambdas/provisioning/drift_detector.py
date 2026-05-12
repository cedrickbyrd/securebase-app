"""Track 6.4 infrastructure drift detector Lambda."""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

try:
    import boto3
except Exception:  # pragma: no cover
    boto3 = None

DRIFT_TABLE = os.getenv("DRIFT_TABLE", "securebase-drift-history")
TERRAFORM_DIR = os.getenv("TERRAFORM_DIR", "/tmp/terraform")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY", "cedrickbyrd/securebase-app")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
SNS_TOPIC_ARN = os.getenv("DRIFT_ALERT_TOPIC_ARN", "")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_plan_summary(plan_output: str) -> Tuple[int, int, int]:
    match = re.search(r"Plan:\s+(\d+) to add,\s+(\d+) to change,\s+(\d+) to destroy", plan_output)
    if not match:
        return (0, 0, 0)
    return tuple(int(value) for value in match.groups())


def classify_drift(add: int, change: int, destroy: int) -> str:
    if destroy > 0:
        return "P1"
    if change > 5:
        return "P2"
    if add > 0 or change > 0:
        return "P3"
    return "NONE"


def run_plan(environment: str) -> Dict[str, Any]:
    env_dir = os.path.join(TERRAFORM_DIR, environment)
    completed = subprocess.run(
        ["terraform", "plan", "-refresh-only", "-no-color"],
        cwd=env_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    stdout = completed.stdout + "\n" + completed.stderr
    add, change, destroy = parse_plan_summary(stdout)
    return {
        "environment": environment,
        "add": add,
        "change": change,
        "destroy": destroy,
        "severity": classify_drift(add, change, destroy),
        "drift_detected": (add + change + destroy) > 0,
        "plan_output": stdout,
        "exit_code": completed.returncode,
    }


def _write_history(record: Dict[str, Any]) -> None:
    if boto3 is None:
        return
    boto3.resource("dynamodb").Table(DRIFT_TABLE).put_item(
        Item={
            "environment": record["environment"],
            "timestamp": _now(),
            "add_count": record["add"],
            "change_count": record["change"],
            "destroy_count": record["destroy"],
            "severity": record["severity"],
            "drift_detected": record["drift_detected"],
        }
    )


def _create_github_issue(record: Dict[str, Any]) -> None:
    if not GITHUB_TOKEN or boto3 is None:
        return
    owner, repo = GITHUB_REPOSITORY.split("/", 1)
    body = {
        "title": f"[IaC Drift] {record['environment']} ({record['severity']})",
        "body": (
            f"Drift detected in `{record['environment']}`.\n\n"
            f"- add: {record['add']}\n"
            f"- change: {record['change']}\n"
            f"- destroy: {record['destroy']}\n"
            f"- severity: {record['severity']}\n\n"
            "```\n"
            f"{record['plan_output'][:60000]}\n"
            "```"
        ),
        "labels": ["infra", "drift"],
    }
    import urllib.request

    req = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}/issues",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)


def _send_sns(record: Dict[str, Any]) -> None:
    if not SNS_TOPIC_ARN or boto3 is None:
        return
    boto3.client("sns").publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=f"SecureBase drift alert {record['environment']} ({record['severity']})",
        Message=json.dumps(
            {
                "environment": record["environment"],
                "severity": record["severity"],
                "add": record["add"],
                "change": record["change"],
                "destroy": record["destroy"],
            }
        ),
    )


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    environments = event.get("environments") or ["dev", "staging", "prod"]
    results = []

    for environment in environments:
        result = run_plan(environment)
        _write_history(result)
        if result["drift_detected"]:
            _create_github_issue(result)
            _send_sns(result)
        results.append(result)

    return {
        "checked_at": _now(),
        "results": [{k: v for k, v in result.items() if k != "plan_output"} for result in results],
    }
