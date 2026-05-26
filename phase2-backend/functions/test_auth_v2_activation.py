"""
Unit tests for auth_v2 activation event tracking.

Covers:
- _publish_activation_event: SNS publish on invite_accepted and first_login
- _record_first_login: DynamoDB conditional write + SNS publish
- accept_invite: fires invite_accepted SNS event on success
- login: fires first_login SNS event on first successful login; skips on repeat logins
"""

import json
import os
import sys
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

# ── Stub heavy AWS/crypto dependencies before importing the module ─────────────

# botocore.exceptions must be a real module with ClientError so except clauses work
import types

_botocore_exc = types.ModuleType("botocore.exceptions")


class _ClientError(Exception):
    def __init__(self, error_response, operation_name="Op"):
        self.response = error_response
        super().__init__(str(error_response))


_botocore_exc.ClientError = _ClientError
sys.modules["botocore"] = MagicMock()
sys.modules["botocore.exceptions"] = _botocore_exc

# jwt / bcrypt stubs
sys.modules["jwt"] = MagicMock()
sys.modules["bcrypt"] = MagicMock()

# boto3 stub — we'll replace individual clients in each test via patch
_boto3_stub = MagicMock()
sys.modules["boto3"] = _boto3_stub

sys.path.insert(0, os.path.dirname(__file__))

# Set env vars before import so module-level constants are correct
os.environ.setdefault("TOKENS_TABLE", "securebase-tokens")
os.environ.setdefault("USERS_TABLE", "securebase-users")
os.environ.setdefault("JWT_SECRET", "test-secret")

import auth_v2  # noqa: E402 — must come after stubs


# ── helpers ────────────────────────────────────────────────────────────────────

def _make_token_record(email="user@example.com", status="active", plan="standard"):
    return {
        "token": "tok123",
        "email": email,
        "status": status,
        "type": "invite",
        "plan": plan,
        "pilot_tier": "",
        "pilot_ends": "",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }


def _make_user_record(email="user@example.com", plan="standard", first_login_at=None):
    record = {
        "email": email,
        "plan": plan,
        "pilot_tier": "",
        "password_hash": "$2b$12$fakehash",
        "activated_at": "2026-05-01T00:00:00+00:00",
        "role": "user",
    }
    if first_login_at:
        record["first_login_at"] = first_login_at
    return record


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestPublishActivationEvent(unittest.TestCase):
    """_publish_activation_event — SNS publish behaviour."""

    def setUp(self):
        self._orig_topic = auth_v2._ACTIVATION_TOPIC_ARN
        self._orig_sns = auth_v2._sns_client

    def tearDown(self):
        auth_v2._ACTIVATION_TOPIC_ARN = self._orig_topic
        auth_v2._sns_client = self._orig_sns

    def test_no_op_when_topic_not_configured(self):
        """Should do nothing (not raise) if ACTIVATION_SNS_TOPIC_ARN is empty."""
        auth_v2._ACTIVATION_TOPIC_ARN = ""
        mock_sns = MagicMock()
        auth_v2._sns_client = mock_sns

        auth_v2._publish_activation_event("u@example.com", "invite_accepted", {"plan": "standard"})

        mock_sns.publish.assert_not_called()

    def test_publishes_to_configured_topic(self):
        """Should call sns.publish with correct TopicArn and MessageAttributes."""
        auth_v2._ACTIVATION_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:customer-activations"
        mock_sns = MagicMock()
        auth_v2._sns_client = mock_sns

        auth_v2._publish_activation_event(
            "u@example.com",
            "invite_accepted",
            {"plan": "standard", "tier": ""},
        )

        mock_sns.publish.assert_called_once()
        kwargs = mock_sns.publish.call_args.kwargs
        self.assertEqual(kwargs["TopicArn"], "arn:aws:sns:us-east-1:123456789012:customer-activations")
        self.assertIn("Invite Accepted", kwargs["Subject"])
        msg = json.loads(kwargs["Message"])
        self.assertEqual(msg["event_type"], "invite_accepted")
        self.assertNotIn("email", msg, "raw email must not appear in SNS payload (PII)")
        self.assertIn("correlation_id", msg)
        self.assertIn("timestamp", msg)
        self.assertEqual(
            kwargs["MessageAttributes"]["event_type"]["StringValue"], "invite_accepted"
        )

    def test_swallows_sns_exception(self):
        """Errors from SNS should be swallowed (best-effort)."""
        auth_v2._ACTIVATION_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:customer-activations"
        mock_sns = MagicMock()
        mock_sns.publish.side_effect = RuntimeError("SNS unavailable")
        auth_v2._sns_client = mock_sns

        # Should not raise
        auth_v2._publish_activation_event("u@example.com", "invite_accepted", {})


class TestRecordFirstLogin(unittest.TestCase):
    """_record_first_login — DynamoDB conditional write + SNS publish."""

    def setUp(self):
        self._orig_topic = auth_v2._ACTIVATION_TOPIC_ARN
        self._orig_sns = auth_v2._sns_client
        self._orig_users = auth_v2._users_table
        auth_v2._ACTIVATION_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:customer-activations"
        auth_v2._sns_client = MagicMock()
        auth_v2._users_table = MagicMock()

    def tearDown(self):
        auth_v2._ACTIVATION_TOPIC_ARN = self._orig_topic
        auth_v2._sns_client = self._orig_sns
        auth_v2._users_table = self._orig_users

    def test_writes_first_login_and_publishes(self):
        """First login: updates DynamoDB and fires SNS."""
        user = _make_user_record()
        auth_v2._record_first_login("u@example.com", user)

        auth_v2._users_table.update_item.assert_called_once()
        call_kwargs = auth_v2._users_table.update_item.call_args.kwargs
        self.assertEqual(call_kwargs["Key"], {"email": "u@example.com"})
        self.assertIn("first_login_at", call_kwargs["UpdateExpression"])
        self.assertEqual(call_kwargs["ConditionExpression"], "attribute_not_exists(first_login_at)")

        auth_v2._sns_client.publish.assert_called_once()
        msg = json.loads(auth_v2._sns_client.publish.call_args.kwargs["Message"])
        self.assertEqual(msg["event_type"], "first_login")
        self.assertNotIn("email", msg, "raw email must not appear in SNS payload (PII)")
        self.assertIn("correlation_id", msg)

    def test_conditional_check_failed_is_silently_ignored(self):
        """ConditionalCheckFailedException means another request beat us — should be silent."""
        err = _ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": ""}},
            "UpdateItem",
        )
        auth_v2._users_table.update_item.side_effect = err

        # Should not raise, should not publish SNS
        auth_v2._record_first_login("u@example.com", _make_user_record())
        auth_v2._sns_client.publish.assert_not_called()

    def test_other_dynamodb_error_is_swallowed(self):
        """Non-conditional DynamoDB errors should also be swallowed (best-effort)."""
        err = _ClientError(
            {"Error": {"Code": "ProvisionedThroughputExceededException", "Message": ""}},
            "UpdateItem",
        )
        auth_v2._users_table.update_item.side_effect = err

        # Should not raise
        auth_v2._record_first_login("u@example.com", _make_user_record())


class TestAcceptInviteActivationEvent(unittest.TestCase):
    """accept_invite fires invite_accepted SNS event on success."""

    def setUp(self):
        self._orig_topic = auth_v2._ACTIVATION_TOPIC_ARN
        self._orig_sns = auth_v2._sns_client
        self._orig_tokens = auth_v2._tokens_table
        self._orig_users = auth_v2._users_table
        auth_v2._ACTIVATION_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:customer-activations"
        auth_v2._sns_client = MagicMock()
        auth_v2._tokens_table = MagicMock()
        auth_v2._users_table = MagicMock()

    def tearDown(self):
        auth_v2._ACTIVATION_TOPIC_ARN = self._orig_topic
        auth_v2._sns_client = self._orig_sns
        auth_v2._tokens_table = self._orig_tokens
        auth_v2._users_table = self._orig_users

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_fires_invite_accepted_event(self, mock_mint, mock_bcrypt):
        """Successful accept_invite should publish invite_accepted to SNS."""
        token_rec = _make_token_record(email="User.MixedCase@Example.com")
        auth_v2._tokens_table.get_item.return_value = {"Item": token_rec}
        auth_v2._users_table.get_item.return_value = {}  # new user
        mock_mint.return_value = "session-jwt"
        mock_bcrypt.hashpw.return_value = b"hashed"
        mock_bcrypt.gensalt.return_value = b"salt"

        event = {
            "httpMethod": "POST",
            "path": "/auth/accept-invite",
            "body": json.dumps({"token": "tok123", "password": "securepass"}),
            "requestContext": {"requestId": "req-001"},
        }
        resp = auth_v2.accept_invite(event, "req-001")

        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(body["user"]["email"], "user.mixedcase@example.com")
        auth_v2._users_table.put_item.assert_called_once()
        put_item = auth_v2._users_table.put_item.call_args.kwargs["Item"]
        self.assertEqual(put_item["email"], "user.mixedcase@example.com")
        auth_v2._sns_client.publish.assert_called_once()
        msg = json.loads(auth_v2._sns_client.publish.call_args.kwargs["Message"])
        self.assertEqual(msg["event_type"], "invite_accepted")
        self.assertNotIn("email", msg, "raw email must not appear in SNS payload (PII)")
        self.assertIn("correlation_id", msg)

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_no_event_on_invalid_token(self, mock_mint, mock_bcrypt):
        """Failed accept_invite (bad token) must not publish SNS."""
        auth_v2._tokens_table.get_item.return_value = {}  # token not found

        event = {
            "httpMethod": "POST",
            "path": "/auth/accept-invite",
            "body": json.dumps({"token": "badtok", "password": "securepass"}),
            "requestContext": {"requestId": "req-002"},
        }
        resp = auth_v2.accept_invite(event, "req-002")

        self.assertEqual(resp["statusCode"], 401)
        auth_v2._sns_client.publish.assert_not_called()


class TestValidateInviteToken(unittest.TestCase):
    """GET invite token validation for email-link landing."""

    def setUp(self):
        self._orig_tokens = auth_v2._tokens_table
        auth_v2._tokens_table = MagicMock()

    def tearDown(self):
        auth_v2._tokens_table = self._orig_tokens

    def test_missing_token_returns_400(self):
        resp = auth_v2.validate_invite_token({"queryStringParameters": {}}, "req-009")
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 400)
        self.assertEqual(body["error"], "token is required")

    def test_invalid_token_returns_401(self):
        auth_v2._tokens_table.get_item.return_value = {}
        resp = auth_v2.validate_invite_token(
            {"queryStringParameters": {"token": "missing"}},
            "req-010",
        )
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 401)
        self.assertEqual(body["error"], "Invalid or expired invite link")

    def test_used_token_returns_401(self):
        token_rec = _make_token_record(status="used")
        auth_v2._tokens_table.get_item.return_value = {"Item": token_rec}
        resp = auth_v2.validate_invite_token(
            {"queryStringParameters": {"token": "tok123"}},
            "req-011",
        )
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 401)
        self.assertEqual(body["error"], "Invite link has already been used")

    def test_expired_token_returns_401(self):
        token_rec = _make_token_record()
        token_rec["expires_at"] = "2000-01-01T00:00:00+00:00"
        auth_v2._tokens_table.get_item.return_value = {"Item": token_rec}
        resp = auth_v2.validate_invite_token(
            {"queryStringParameters": {"token": "tok123"}},
            "req-012",
        )
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 401)
        self.assertEqual(body["error"], "Invite link has expired")

    def test_valid_token_returns_masked_email(self):
        token_rec = _make_token_record(email="ce@example.com", plan="pro")
        auth_v2._tokens_table.get_item.return_value = {"Item": token_rec}
        resp = auth_v2.validate_invite_token(
            {"queryStringParameters": {"token": "tok123"}},
            "req-013",
        )
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 200)
        self.assertTrue(body["valid"])
        self.assertEqual(body["email"], "ce***@example.com")
        self.assertEqual(body["plan"], "pro")
        self.assertEqual(body["expires_at"], token_rec["expires_at"])

    def test_valid_token_with_single_char_local_part_masks_fully(self):
        token_rec = _make_token_record(email="a@example.com", plan="pro")
        auth_v2._tokens_table.get_item.return_value = {"Item": token_rec}
        resp = auth_v2.validate_invite_token(
            {"queryStringParameters": {"token": "tok123"}},
            "req-014",
        )
        body = json.loads(resp["body"])
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(body["email"], "***@example.com")


class TestLambdaHandlerAcceptInviteRoutes(unittest.TestCase):
    """lambda_handler routes GET accept-invite paths to validate_invite_token."""

    @patch("auth_v2.validate_invite_token")
    def test_get_accept_invite_paths_are_routed(self, mock_validate):
        mock_validate.return_value = {"statusCode": 200, "body": "{}"}

        for path in ("/auth/accept-invite", "/accept-invite"):
            with self.subTest(path=path):
                event = {
                    "httpMethod": "GET",
                    "path": path,
                    "queryStringParameters": {"token": "tok123"},
                    "requestContext": {"requestId": f"req-{path}"},
                    "headers": {},
                }
                auth_v2.lambda_handler(event, None)

        self.assertEqual(mock_validate.call_count, 2)


class TestLoginFirstLoginTracking(unittest.TestCase):
    """login fires first_login SNS event on first successful login only."""

    def setUp(self):
        self._orig_topic = auth_v2._ACTIVATION_TOPIC_ARN
        self._orig_sns = auth_v2._sns_client
        self._orig_users = auth_v2._users_table
        auth_v2._ACTIVATION_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:customer-activations"
        auth_v2._sns_client = MagicMock()
        auth_v2._users_table = MagicMock()

    def tearDown(self):
        auth_v2._ACTIVATION_TOPIC_ARN = self._orig_topic
        auth_v2._sns_client = self._orig_sns
        auth_v2._users_table = self._orig_users

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_fires_first_login_event_when_first_login_at_absent(self, mock_mint, mock_bcrypt):
        """First successful login (no first_login_at in user record) fires SNS."""
        user = _make_user_record()  # no first_login_at
        auth_v2._users_table.get_item.return_value = {"Item": user}
        mock_bcrypt.checkpw.return_value = True
        mock_mint.return_value = "session-jwt"

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "user@example.com", "password": "pass"}),
            "requestContext": {"requestId": "req-003"},
        }
        resp = auth_v2.login(event, "req-003")

        self.assertEqual(resp["statusCode"], 200)
        # update_item called for first_login_at
        auth_v2._users_table.update_item.assert_called_once()
        # SNS published
        auth_v2._sns_client.publish.assert_called_once()
        msg = json.loads(auth_v2._sns_client.publish.call_args.kwargs["Message"])
        self.assertEqual(msg["event_type"], "first_login")
        self.assertNotIn("email", msg, "raw email must not appear in SNS payload (PII)")
        self.assertIn("correlation_id", msg)

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_skips_first_login_event_on_repeat_login(self, mock_mint, mock_bcrypt):
        """Subsequent logins (first_login_at already set) must not publish SNS."""
        user = _make_user_record(first_login_at="2026-05-01T10:00:00+00:00")
        auth_v2._users_table.get_item.return_value = {"Item": user}
        mock_bcrypt.checkpw.return_value = True
        mock_mint.return_value = "session-jwt"

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "user@example.com", "password": "pass"}),
            "requestContext": {"requestId": "req-004"},
        }
        resp = auth_v2.login(event, "req-004")

        self.assertEqual(resp["statusCode"], 200)
        auth_v2._users_table.update_item.assert_not_called()
        auth_v2._sns_client.publish.assert_not_called()

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_no_event_on_bad_password(self, mock_mint, mock_bcrypt):
        """Failed login must not publish SNS."""
        user = _make_user_record()
        auth_v2._users_table.get_item.return_value = {"Item": user}
        mock_bcrypt.checkpw.return_value = False  # wrong password

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "user@example.com", "password": "wrong"}),
            "requestContext": {"requestId": "req-005"},
        }
        resp = auth_v2.login(event, "req-005")

        self.assertEqual(resp["statusCode"], 401)
        auth_v2._users_table.update_item.assert_not_called()
        auth_v2._sns_client.publish.assert_not_called()

    @patch("auth_v2.bcrypt")
    @patch("auth_v2._mint_jwt")
    def test_uppercase_email_login_succeeds(self, mock_mint, mock_bcrypt):
        """Login with uppercase email should resolve to lowercase user record."""
        user = _make_user_record(email="user@example.com")
        auth_v2._users_table.get_item.return_value = {"Item": user}
        mock_bcrypt.checkpw.return_value = True
        mock_mint.return_value = "session-jwt"

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "USER@EXAMPLE.COM", "password": "pass"}),
            "requestContext": {"requestId": "req-008"},
        }
        resp = auth_v2.login(event, "req-008")
        body = json.loads(resp["body"])

        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(body["user"]["email"], "user@example.com")
        auth_v2._users_table.get_item.assert_called_once_with(Key={"email": "user@example.com"})


class TestLoginInvitePending(unittest.TestCase):
    """login unknown-email behavior with pending invites."""

    def setUp(self):
        self._orig_tokens = auth_v2._tokens_table
        self._orig_users = auth_v2._users_table
        auth_v2._tokens_table = MagicMock()
        auth_v2._users_table = MagicMock()

    def tearDown(self):
        auth_v2._tokens_table = self._orig_tokens
        auth_v2._users_table = self._orig_users

    def test_unknown_email_with_active_invite_returns_invite_pending(self):
        auth_v2._users_table.get_item.return_value = {}
        auth_v2._tokens_table.scan.return_value = {"Items": [{"email": "invitee@example.com", "status": "active"}]}

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "invitee@example.com", "password": "pass"}),
            "requestContext": {"requestId": "req-006"},
        }
        resp = auth_v2.login(event, "req-006")
        body = json.loads(resp["body"])

        self.assertEqual(resp["statusCode"], 403)
        self.assertEqual(body["error"], "invite_pending")
        self.assertEqual(body["redirect"], "/accept-invite")

    def test_unknown_email_without_active_invite_stays_generic_401(self):
        auth_v2._users_table.get_item.return_value = {}
        auth_v2._tokens_table.scan.return_value = {"Items": []}

        event = {
            "httpMethod": "POST",
            "path": "/auth/login",
            "body": json.dumps({"email": "nobody@example.com", "password": "pass"}),
            "requestContext": {"requestId": "req-007"},
        }
        resp = auth_v2.login(event, "req-007")
        body = json.loads(resp["body"])

        self.assertEqual(resp["statusCode"], 401)
        self.assertEqual(body["error"], "Invalid email or password")


if __name__ == "__main__":
    unittest.main()
