import hashlib
import importlib.util
import json
import os
import sys
import unittest


def _load_module(path):
    module_name = f"module_under_test_{abs(hash(path))}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod


class Track1ComplianceLambdasTest(unittest.TestCase):
    def test_evidence_collector_builds_required_schema(self):
        mod = _load_module(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "src",
                "lambdas",
                "compliance",
                "evidence_collector.py",
            )
        )
        records = mod.build_evidence("soc2", "test", {"k": "v"})
        self.assertTrue(records)
        first = records[0]
        self.assertTrue(first.control_id)
        self.assertTrue(first.timestamp)
        self.assertEqual(first.source, "test")
        self.assertTrue(first.status)
        self.assertIsInstance(first.raw_payload, dict)

    def test_audit_log_validator_checks_sha256(self):
        mod = _load_module(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "src",
                "lambdas",
                "compliance",
                "audit_log_validator.py",
            )
        )
        payload = "hello"
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        result = mod.lambda_handler({"payload": payload, "expected_sha256": digest}, None)
        body = json.loads(result["body"])
        self.assertTrue(body["valid"])


if __name__ == "__main__":
    unittest.main()
