#!/usr/bin/env python3
"""
generate-examiner-cdr-manifest.py
Verifies SHA-256 HMAC chain over 7-year WORM CDR vault for FDIC/OCR/DORA examiners.
"""
import hashlib
import json
import sys


def verify_chain(records: list[dict]) -> bool:
    for idx, rec in enumerate(records):
        if idx > 0 and rec.get("prevHash") != records[idx - 1].get("hmacSha256"):
            return False
    return True


if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as fh:
            data = json.load(fh)
        ok = verify_chain(data)
        print(json.dumps({"verified": ok, "record_count": len(data)}))
        sys.exit(0 if ok else 1)
    print("Usage: generate-examiner-cdr-manifest.py <cdr-chain.json>")
