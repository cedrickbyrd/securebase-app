"""Lightweight staging smoke tests for Terraform-managed Lambda endpoints."""

from __future__ import annotations

import json
import os
import unittest
from typing import Any
from urllib import error, request


DEFAULT_BASE_URL = "https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/staging"
TIMEOUT_SECONDS = float(os.environ.get("SMOKE_TIMEOUT_SECONDS", "15"))

TESTS = [
    ("OPTIONS /auth", "OPTIONS", "/auth", None, 200),
    ("POST /auth no token", "POST", "/auth", {}, 401),
    ("POST /checkout invalid tier", "POST", "/checkout", {"tier": "unknown"}, 400),
    ("GET /pilot/availability", "GET", "/pilot/availability?sku=pilot_compliance", None, 200),
    ("GET /validate-session", "GET", "/validate-session", None, 200),
]


def _request_status(base_url: str, method: str, path: str, payload: Any) -> tuple[int, str]:
    body = None
    headers = {"Accept": "application/json"}

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(f"{base_url.rstrip('/')}{path}", data=body, headers=headers, method=method)

    try:
        with request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            return response.getcode(), response.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


class LambdaEndpointSmokeTests(unittest.TestCase):
    maxDiff = None

    def test_expected_status_codes(self) -> None:
        base_url = os.environ.get("SMOKE_BASE_URL", DEFAULT_BASE_URL)

        for name, method, path, payload, expected_status in TESTS:
            with self.subTest(name=name):
                status, body = _request_status(base_url, method, path, payload)
                self.assertEqual(
                    status,
                    expected_status,
                    msg=f"{name} returned {status} instead of {expected_status}. Response body: {body}",
                )


if __name__ == "__main__":
    unittest.main()
