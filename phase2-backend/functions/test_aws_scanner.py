import json
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch


sys.path.insert(0, os.path.dirname(__file__))

mock_db_utils = types.ModuleType("db_utils")
mock_db_utils.execute_one = MagicMock()
mock_db_utils.query_one = MagicMock(return_value={"count": 0})
sys.modules["db_utils"] = mock_db_utils

import aws_scanner


class FakeSession:
    def __init__(self, clients):
        self._clients = clients

    def client(self, name):
        return self._clients[name]


class TestAwsScanner(unittest.TestCase):
    @patch("aws_scanner._run_customer_scan")
    def test_post_verify_trigger(self, mock_run):
        mock_run.return_value = {"scan_status": "completed"}
        event = {
            "trigger": "post_verify",
            "customer_id": "cust-1",
            "role_arn": "arn:aws:iam::123456789012:role/SecureBaseReadOnlyRole",
            "external_id": "ext-1",
        }
        result = aws_scanner.lambda_handler(event, None)
        self.assertEqual(result["scan_status"], "completed")
        mock_run.assert_called_once_with(
            "cust-1", "arn:aws:iam::123456789012:role/SecureBaseReadOnlyRole", "ext-1"
        )

    @patch("aws_scanner._run_customer_scan")
    @patch("aws_scanner._get_connected_customers")
    def test_scheduled_trigger(self, mock_customers, mock_run):
        mock_customers.return_value = [
            {"customer_id": "c1", "role_arn": "arn:1", "external_id": "e1", "status": "connected"},
            {"customer_id": "c2", "role_arn": "arn:2", "external_id": "e2", "status": "connected"},
        ]
        mock_run.side_effect = [
            {"customer_id": "c1", "scan_status": "completed"},
            {"customer_id": "c2", "scan_status": "completed"},
        ]
        result = aws_scanner.lambda_handler({"source": "aws.events"}, None)
        self.assertEqual(result["customers_scanned"], 2)
        self.assertEqual(mock_run.call_count, 2)

    @patch("aws_scanner._get_customer_id_from_event", return_value=None)
    @patch("aws_scanner._get_connection")
    def test_on_demand_missing_customer_id(self, mock_connection, mock_customer_id):
        event = {"httpMethod": "POST", "path": "/scan/trigger", "headers": {}}
        result = aws_scanner.lambda_handler(event, None)
        self.assertEqual(result["statusCode"], 401)
        mock_connection.assert_not_called()
        mock_customer_id.assert_called_once()

    @patch("aws_scanner._invoke_compliance_score")
    @patch("aws_scanner._get_customer_id_from_event", return_value="cust-1")
    @patch("aws_scanner._get_connection")
    def test_on_demand_connected_customer(self, mock_connection, mock_customer_id, mock_invoke):
        mock_connection.return_value = {
            "customer_id": "cust-1",
            "status": "connected",
            "role_arn": "arn:role",
            "external_id": "ext-1",
        }
        event = {
            "httpMethod": "POST",
            "path": "/scan/trigger",
            "headers": {"Authorization": "Bearer token"},
        }
        result = aws_scanner.lambda_handler(event, None)
        self.assertEqual(result["statusCode"], 202)
        body = json.loads(result["body"])
        self.assertEqual(body["scan_status"], "queued")
        mock_customer_id.assert_called_once_with(event)
        mock_invoke.assert_called_once_with("cust-1", "arn:role", "api_scan_trigger")

    @patch("aws_scanner.execute_one")
    @patch("aws_scanner.query_one")
    def test_seed_baa_first_scan_only(self, mock_query_one, mock_execute_one):
        mock_query_one.return_value = {"count": 0}
        aws_scanner._seed_baa_if_needed("cust-1")
        self.assertEqual(mock_execute_one.call_count, 1)

        mock_execute_one.reset_mock()
        mock_query_one.return_value = {"count": 1}
        aws_scanner._seed_baa_if_needed("cust-1")
        mock_execute_one.assert_not_called()

    @patch("aws_scanner._upsert_encryption_status")
    def test_scan_s3_bucket(self, mock_upsert):
        s3_client = MagicMock()
        s3_client.list_buckets.return_value = {"Buckets": [{"Name": "customer-phi-data"}]}
        s3_client.get_bucket_encryption.return_value = {
            "ServerSideEncryptionConfiguration": {
                "Rules": [
                    {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms", "KMSMasterKeyID": "kms-1"}}
                ]
            }
        }
        s3_client.get_public_access_block.return_value = {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            }
        }
        s3_client.get_bucket_policy.return_value = {"Policy": json.dumps({"Statement": []})}

        session = FakeSession({"s3": s3_client})
        scanned = aws_scanner._scan_s3(session, "cust-1")
        self.assertEqual(scanned, 1)
        mock_upsert.assert_called_once()

    def test_run_customer_scan_continues_on_service_failure(self):
        table_mock = MagicMock()
        with (
            patch.object(aws_scanner, "ddb") as mock_ddb,
            patch.object(aws_scanner, "_assume_customer_session", return_value=MagicMock()),
            patch.object(aws_scanner, "_seed_baa_if_needed"),
            patch.object(aws_scanner, "_scan_s3", side_effect=Exception("s3 failed")),
            patch.object(aws_scanner, "_scan_rds", return_value=2),
            patch.object(aws_scanner, "_scan_kms", return_value=1),
            patch.object(aws_scanner, "_scan_cloudtrail", return_value=1),
            patch.object(aws_scanner, "_scan_iam", return_value=1),
            patch.object(aws_scanner, "_scan_config", return_value=1),
            patch.object(aws_scanner, "_scan_securityhub", return_value=1),
            patch("aws_scanner.boto3.client") as mock_boto_client,
        ):
            mock_ddb.Table.return_value = table_mock
            mock_lambda_client = MagicMock()
            mock_boto_client.return_value = mock_lambda_client

            result = aws_scanner._run_customer_scan("cust-1", "arn:role", "ext-1")

            self.assertEqual(result["scan_status"], "completed")
            self.assertEqual(result["resources_scanned"], 7)
            self.assertTrue(table_mock.update_item.called)
            self.assertTrue(mock_lambda_client.invoke.called)


if __name__ == "__main__":
    unittest.main()
