import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROVISIONING_DIR = os.path.join(ROOT, "src", "lambdas", "provisioning")
sys.path.insert(0, PROVISIONING_DIR)

import drift_detector  # noqa: E402
import tenant_provisioner  # noqa: E402


class Track6ProvisioningTests(unittest.TestCase):
    def test_parse_plan_summary(self):
        add, change, destroy = drift_detector.parse_plan_summary(
            "Plan: 2 to add, 6 to change, 1 to destroy."
        )
        self.assertEqual((add, change, destroy), (2, 6, 1))

    def test_classify_drift(self):
        self.assertEqual(drift_detector.classify_drift(0, 0, 1), "P1")
        self.assertEqual(drift_detector.classify_drift(0, 6, 0), "P2")
        self.assertEqual(drift_detector.classify_drift(1, 0, 0), "P3")
        self.assertEqual(drift_detector.classify_drift(0, 0, 0), "NONE")

    def test_generate_api_key(self):
        key = tenant_provisioner._generate_api_key("tenant-abc")
        self.assertIn("raw", key)
        self.assertIn("hash", key)
        self.assertIn("prefix", key)
        self.assertTrue(key["raw"].startswith("sk_live_tenant-abc"))
        self.assertEqual(len(key["hash"]), 64)


if __name__ == "__main__":
    unittest.main()
