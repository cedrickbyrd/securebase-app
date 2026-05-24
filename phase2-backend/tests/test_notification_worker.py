"""
Test Suite for Notification Worker

This test suite validates the notification worker Lambda function.

Test categories:
- SQS message parsing
- Template rendering
- Email delivery (mocked SES)
- SMS delivery (mocked SNS)
- Webhook delivery (mocked HTTP)
- In-app notification storage (DynamoDB)
- Retry logic and error handling
- Delivery status logging

Author: SecureBase Team
Created: 2026-01-26
"""

import json
import os
import sys
import pytest
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime, timedelta

# ============================================================================
# PATH SETUP — add phase2-backend/functions/ to sys.path before importing
# ============================================================================
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_FUNCTIONS = os.path.join(_REPO_ROOT, 'functions')

if _FUNCTIONS not in sys.path:
    sys.path.insert(0, _FUNCTIONS)

# ============================================================================
# STUB HEAVY DEPENDENCIES before importing the Lambda module
# ============================================================================

# Real exception classes so except clauses work correctly
class _ClientError(Exception):
    """Minimal botocore.exceptions.ClientError replacement for tests."""
    def __init__(self, error_response, operation_name='TestOperation'):
        self.response = error_response
        code = error_response.get('Error', {}).get('Code', 'Unknown')
        msg = error_response.get('Error', {}).get('Message', '')
        super().__init__(
            f"An error occurred ({code}) when calling the {operation_name} operation: {msg}"
        )


class _RequestException(Exception):
    """Minimal requests.exceptions.RequestException replacement for tests."""


_botocore_exceptions_stub = MagicMock()
_botocore_exceptions_stub.ClientError = _ClientError
_botocore_stub = MagicMock()
_botocore_stub.exceptions = _botocore_exceptions_stub

_requests_exceptions_stub = MagicMock()
_requests_exceptions_stub.RequestException = _RequestException
_requests_stub = MagicMock()
_requests_stub.exceptions = _requests_exceptions_stub

# Only stub modules that are NOT already available as real packages so that
# runs on a system *with* boto3/requests installed still use the stubs and
# remain isolated from real AWS/network calls.
sys.modules['boto3'] = MagicMock()
sys.modules['botocore'] = _botocore_stub
sys.modules['botocore.exceptions'] = _botocore_exceptions_stub
sys.modules['requests'] = _requests_stub
sys.modules['requests.exceptions'] = _requests_exceptions_stub

# ============================================================================
# IMPORT MODULE UNDER TEST
# ============================================================================
import notification_worker  # noqa: E402
from notification_worker import (  # noqa: E402
    lambda_handler,
    parse_sqs_message,
    process_notification,
    render_template,
    dispatch_with_retry,
    send_email,
    send_sms,
    send_webhook,
    store_in_app,
    validate_environment,
    get_template,
    get_user_preferences,
    get_enabled_channels,
    log_delivery,
    sanitize_notification_payload,
    should_suppress_notification,
    build_dedup_key,
)

# Expose stub exception types so test bodies can raise / assert them
ClientError = _ClientError
RequestException = _RequestException


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def sample_sqs_event():
    """Sample SQS event with SNS-wrapped notification message."""
    return {
        'Records': [
            {
                'messageId': 'test-message-id',
                'body': json.dumps({
                    'Message': json.dumps({
                        'id': 'notif-123',
                        'customer_id': 'customer-456',
                        'user_id': 'user-789',
                        'type': 'security_alert',
                        'priority': 'critical',
                        'title': 'Security Alert',
                        'body': 'Unauthorized access detected',
                        'channels': ['email', 'sms', 'in_app'],
                        'metadata': {
                            'account_id': 'aws-account-123',
                            'service': 'GuardDuty',
                            'severity': 'HIGH',
                        },
                    })
                }),
            }
        ]
    }


@pytest.fixture
def sample_notification():
    """Sample notification dict matching parse_sqs_message output."""
    return {
        'id': 'notif-123',
        'customer_id': 'customer-456',
        'user_id': 'user-789',
        'type': 'security_alert',
        'priority': 'critical',
        'title': 'Security Alert',
        'body': 'Unauthorized access detected',
        'channels': ['email', 'in_app'],
        'metadata': {'severity': 'HIGH'},
        'created_at': datetime.utcnow().isoformat(),
    }


@pytest.fixture
def rendered_template():
    """Sample rendered template dict."""
    return {
        'subject': 'Security Alert: HIGH',
        'body_html': '<p>Security Alert</p>',
        'body_text': 'Security Alert',
    }


# ============================================================================
# LAMBDA HANDLER TESTS
# ============================================================================

def test_lambda_handler_success(sample_sqs_event):
    """lambda_handler processes a valid SQS record and returns processed=1."""
    with patch.dict('os.environ', {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
        'TEMPLATES_TABLE': 'templates-table',
    }):
        with patch('notification_worker.process_notification') as mock_process:
            result = lambda_handler(sample_sqs_event, {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['processed'] == 1
    assert body['failed'] == 0
    mock_process.assert_called_once()


def test_lambda_handler_empty_records():
    """lambda_handler returns 200 with 'No records' message when Records is empty."""
    with patch.dict('os.environ', {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
        'TEMPLATES_TABLE': 'templates-table',
    }):
        result = lambda_handler({'Records': []}, {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['message'] == 'No records'


def test_lambda_handler_processing_error(sample_sqs_event):
    """lambda_handler increments failed count when process_notification raises."""
    with patch.dict('os.environ', {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
        'TEMPLATES_TABLE': 'templates-table',
    }):
        with patch('notification_worker.process_notification',
                   side_effect=Exception('Test error')):
            result = lambda_handler(sample_sqs_event, {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['failed'] == 1
    assert len(body['errors']) == 1


# ============================================================================
# MESSAGE PARSING TESTS
# ============================================================================

def test_parse_sqs_message_valid():
    """parse_sqs_message extracts all fields from an SNS-wrapped SQS record."""
    record = {
        'body': json.dumps({
            'Message': json.dumps({
                'id': 'notif-123',
                'customer_id': 'customer-456',
                'user_id': 'user-789',
                'type': 'security_alert',
                'priority': 'critical',
                'title': 'Security Alert',
                'body': 'Unauthorized access detected',
                'channels': ['email', 'in_app'],
                'metadata': {'severity': 'HIGH'},
            })
        })
    }

    result = parse_sqs_message(record)

    assert result['id'] == 'notif-123'
    assert result['type'] == 'security_alert'
    assert result['customer_id'] == 'customer-456'
    assert result['user_id'] == 'user-789'


def test_parse_sqs_message_missing_fields():
    """parse_sqs_message applies defaults when optional fields are absent."""
    record = {
        'body': json.dumps({
            'customer_id': 'customer-456',
            'user_id': 'user-789',
        })
    }

    result = parse_sqs_message(record)

    assert result['type'] == 'system'
    assert result['priority'] == 'medium'
    assert result['channels'] == ['in_app']


# ============================================================================
# NOTIFICATION PROCESSING TESTS
# ============================================================================

def test_process_notification_all_channels(sample_notification):
    """process_notification dispatches external channels and stores in-app notifications."""
    sample_notification['channels'] = ['email', 'sms', 'in_app']

    mock_prefs = {
        'email': 'user@example.com',
        'phone_number': '+15551234567',
        'subscriptions': {},
    }
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }

    with patch('notification_worker.should_suppress_notification', return_value=(False, 1)), \
         patch('notification_worker.get_user_preferences', return_value=mock_prefs), \
         patch('notification_worker.get_enabled_channels',
               return_value=['email', 'sms', 'in_app']), \
         patch('notification_worker.render_template', return_value=rendered), \
         patch('notification_worker.dispatch_with_retry',
               side_effect=[('success', None, None), ('success', None, None)]) as mock_dispatch, \
         patch('notification_worker.store_in_app') as mock_store, \
         patch('notification_worker.log_delivery') as mock_log:

        process_notification(sample_notification)

    assert mock_dispatch.call_count == 2
    mock_store.assert_called_once()
    assert mock_log.call_count == 1  # in_app channel logs directly in process_notification


def test_process_notification_channel_failure(sample_notification):
    """process_notification continues processing remaining channels when external dispatch fails."""
    sample_notification['channels'] = ['email', 'in_app']

    mock_prefs = {'email': 'user@example.com', 'subscriptions': {}}
    rendered = {'subject': 'Alert', 'body_html': '<p>Alert</p>', 'body_text': 'Alert'}

    with patch('notification_worker.should_suppress_notification', return_value=(False, 1)), \
         patch('notification_worker.get_user_preferences', return_value=mock_prefs), \
         patch('notification_worker.get_enabled_channels',
               return_value=['email', 'in_app']), \
         patch('notification_worker.render_template', return_value=rendered), \
         patch('notification_worker.dispatch_with_retry',
               return_value=('failed', None, 'SES error')) as mock_dispatch, \
         patch('notification_worker.store_in_app') as mock_store:

        # Implementation continues after a channel failure — should not raise
        process_notification(sample_notification)

    mock_dispatch.assert_called_once()
    mock_store.assert_called_once()


# ============================================================================
# TEMPLATE RENDERING TESTS
# ============================================================================

def test_render_template_with_variables(sample_notification):
    """render_template substitutes metadata placeholders using str.format."""
    sample_notification['metadata'] = {'severity': 'HIGH'}

    template = {
        'subject': 'Alert: {severity}',
        'body_html': '<p>Severity: {severity}</p>',
        'body_text': 'Severity: {severity}',
    }

    with patch('notification_worker.get_template', return_value=template):
        result = render_template(sample_notification)

    assert result['subject'] == 'Alert: HIGH'
    assert 'HIGH' in result['body_html']
    assert 'HIGH' in result['body_text']


def test_render_template_missing_variables(sample_notification):
    """render_template falls back to notification title/body when template fetch fails."""
    sample_notification['title'] = 'Fallback Title'
    sample_notification['body'] = 'Fallback body text'

    with patch('notification_worker.get_template',
               side_effect=Exception('Template not found')):
        result = render_template(sample_notification)

    assert result['subject'] == 'Fallback Title'
    assert 'Fallback body text' in result['body_html']
    assert result['body_text'] == 'Fallback body text'


# ============================================================================
# EMAIL DELIVERY TESTS
# ============================================================================

def test_send_email_success(sample_notification):
    """send_email calls ses_client.send_email with the correct ToAddress."""
    rendered = {
        'subject': 'Test Subject',
        'body_html': '<p>Test</p>',
        'body_text': 'Test',
    }
    user_prefs = {'email': 'user@example.com'}

    with patch('notification_worker.ses_client') as mock_ses:
        mock_ses.send_email.return_value = {'MessageId': 'msg-123'}
        send_email(sample_notification, rendered, user_prefs)

    mock_ses.send_email.assert_called_once()
    call_kwargs = mock_ses.send_email.call_args[1]
    assert call_kwargs['Destination']['ToAddresses'][0] == 'user@example.com'


def test_send_email_ses_error(sample_notification):
    """send_email raises Exception containing 'SES error' when SES rejects the message."""
    rendered = {
        'subject': 'Test',
        'body_html': '<p>Test</p>',
        'body_text': 'Test',
    }
    user_prefs = {'email': 'user@example.com'}
    error_response = {'Error': {'Code': 'MessageRejected', 'Message': 'Email rejected'}}

    with patch('notification_worker.ses_client') as mock_ses:
        mock_ses.send_email.side_effect = ClientError(error_response, 'SendEmail')

        with pytest.raises(Exception) as exc_info:
            send_email(sample_notification, rendered, user_prefs)

    assert 'SES error' in str(exc_info.value)


# ============================================================================
# SMS DELIVERY TESTS
# ============================================================================

def test_send_sms_success(sample_notification):
    """send_sms calls sns_client.publish with the correct PhoneNumber."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }
    user_prefs = {'phone_number': '+15551234567'}

    with patch('notification_worker.sns_client') as mock_sns:
        mock_sns.publish.return_value = {'MessageId': 'sms-123'}
        send_sms(sample_notification, rendered, user_prefs)

    mock_sns.publish.assert_called_once()
    call_kwargs = mock_sns.publish.call_args[1]
    assert call_kwargs['PhoneNumber'] == '+15551234567'


def test_send_sms_invalid_phone(sample_notification):
    """send_sms raises ValueError when user_prefs contains no phone_number."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }

    with pytest.raises(ValueError):
        send_sms(sample_notification, rendered, {})


# ============================================================================
# WEBHOOK DELIVERY TESTS
# ============================================================================

def test_send_webhook_success(sample_notification):
    """send_webhook POSTs to the configured webhook URL."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }
    user_prefs = {
        'webhook_url': 'https://example.com/webhook',
        'webhook_secret': 'secret',
    }

    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch.object(notification_worker.requests, 'post',
                      return_value=mock_response) as mock_post:
        send_webhook(sample_notification, rendered, user_prefs)

    mock_post.assert_called_once()
    assert mock_post.call_args[0][0] == 'https://example.com/webhook'


def test_send_webhook_timeout(sample_notification):
    """send_webhook raises Exception when POST fails."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }
    user_prefs = {
        'webhook_url': 'https://example.com/webhook',
        'webhook_secret': 'secret',
    }

    with patch.object(notification_worker.requests, 'post',
                      side_effect=RequestException('timeout')):

        with pytest.raises(Exception) as exc_info:
            send_webhook(sample_notification, rendered, user_prefs)

    assert 'Webhook delivery failed' in str(exc_info.value)


# ============================================================================
# IN-APP STORAGE TESTS
# ============================================================================

def test_store_in_app_success(sample_notification):
    """store_in_app calls DynamoDB put_item with id and user_id in the Item."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }

    with patch('notification_worker.dynamodb') as mock_dynamodb:
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        store_in_app(sample_notification, rendered)

    mock_table.put_item.assert_called_once()
    item = mock_table.put_item.call_args[1]['Item']
    assert item['id'] == 'notif-123'
    assert item['user_id'] == 'user-789'
    assert 'ttl' in item


def test_store_in_app_with_ttl(sample_notification):
    """store_in_app sets a TTL approximately 90 days from the current time."""
    rendered = {
        'subject': 'Alert',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }

    with patch('notification_worker.dynamodb') as mock_dynamodb:
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        store_in_app(sample_notification, rendered)

    item = mock_table.put_item.call_args[1]['Item']
    ttl = item['ttl']
    expected_ttl = int((datetime.utcnow() + timedelta(days=90)).timestamp())
    assert abs(ttl - expected_ttl) <= 60


# ============================================================================
# ENVIRONMENT VALIDATION TESTS
# ============================================================================

def test_validate_environment_all_vars_present():
    """validate_environment succeeds when all three required env vars are set."""
    with patch.dict('os.environ', {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
        'TEMPLATES_TABLE': 'templates-table',
    }):
        validate_environment()  # must not raise


def test_validate_environment_missing_var():
    """validate_environment raises ValueError when a required env var is missing."""
    env_with_two = {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
    }

    with patch.dict('os.environ', env_with_two, clear=True):
        with pytest.raises(ValueError) as exc_info:
            validate_environment()

    assert 'Missing required environment variables' in str(exc_info.value)


# ============================================================================
# END-TO-END INTEGRATION TEST
# ============================================================================

def test_end_to_end_notification_flow(sample_sqs_event):
    """Full flow: SQS event → parse → render → SES send + DynamoDB store."""
    mock_prefs = {
        'email': 'user@example.com',
        'phone_number': '+15551234567',
        'subscriptions': {
            'security_alert': {
                'email': True,
                'in_app': True,
            }
        },
    }
    template = {
        'subject': 'Security Alert: {severity}',
        'body_html': '<p>Alert: {severity}</p>',
        'body_text': 'Alert: {severity}',
    }

    with patch.dict('os.environ', {
        'NOTIFICATIONS_TABLE': 'notif-table',
        'SUBSCRIPTIONS_TABLE': 'subs-table',
        'TEMPLATES_TABLE': 'templates-table',
    }):
        with patch('notification_worker.ses_client') as mock_ses, \
             patch('notification_worker.dynamodb') as mock_dynamodb, \
             patch('notification_worker.get_user_preferences',
                   return_value=mock_prefs), \
             patch('notification_worker.get_template', return_value=template):

            mock_ses.send_email.return_value = {'MessageId': 'msg-e2e'}
            mock_table = MagicMock()
            mock_dynamodb.Table.return_value = mock_table

            result = lambda_handler(sample_sqs_event, {})

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['processed'] == 1

    # email channel — SES must have been called
    mock_ses.send_email.assert_called_once()

    # in_app channel — DynamoDB put_item must have been called
    mock_table.put_item.assert_called_once()


# ============================================================================
# HELPER FUNCTION TESTS
# ============================================================================

def test_get_template():
    """get_template fetches a customer-specific template from DynamoDB."""
    expected = {
        'customer_id': 'customer-456',
        'event_type': 'security_alert',
        'subject': 'Security Alert: {severity}',
        'body_html': '<p>Alert</p>',
        'body_text': 'Alert',
    }

    with patch('notification_worker.dynamodb') as mock_dynamodb:
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {'Item': expected}

        result = get_template('security_alert', 'customer-456')

    assert result['subject'] == expected['subject']
    mock_table.get_item.assert_called_once_with(
        Key={'customer_id': 'customer-456', 'event_type': 'security_alert'}
    )


def test_get_user_preferences():
    """get_user_preferences returns the full prefs dict from DynamoDB including email, phone, and webhook fields."""
    expected = {
        'customer_id': 'customer-456',
        'user_id': 'user-789',
        'email': 'user@example.com',
        'phone_number': '+15551234567',
        'webhook_url': 'https://example.com/hook',
        'webhook_secret': 'secret',
        'subscriptions': {'security_alert': {'email': True, 'in_app': True}},
    }

    with patch('notification_worker.dynamodb') as mock_dynamodb:
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {'Item': expected}

        result = get_user_preferences('user-789', 'customer-456')

    assert result['email'] == 'user@example.com'
    assert result['phone_number'] == '+15551234567'
    assert result['webhook_url'] == 'https://example.com/hook'
    assert 'subscriptions' in result


# ============================================================================
# DEDUP / SANITIZATION / DELIVERY LOG TESTS
# ============================================================================

def test_build_dedup_key_uses_customer_type_and_resource():
    """build_dedup_key includes customer, type, and metadata resource id."""
    notification = {
        'customer_id': 'customer-1',
        'type': 'iam_policy_drift',
        'metadata': {'resource_id': 'role/ci-role'}
    }
    assert build_dedup_key(notification) == 'customer-1#iam_policy_drift#role/ci-role'


def test_should_suppress_notification_when_event_repeats(sample_notification):
    """should_suppress_notification returns True when key is still inside dedup window."""
    with patch('notification_worker.dynamodb') as mock_dynamodb, \
         patch('notification_worker.time.time', return_value=1000):
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {'Item': {'expires_at': 1200, 'duplicate_count': 2}}

        should_suppress, duplicate_count = should_suppress_notification(sample_notification)

    assert should_suppress is True
    assert duplicate_count == 3
    mock_table.put_item.assert_called_once()


def test_sanitize_notification_payload_redacts_sensitive_values():
    """sanitize_notification_payload strips sensitive keys and token-like values."""
    payload = {
        'account_id': '123456789012',
        'arn': 'arn:aws:iam::123456789012:role/Admin',
        'body': 'Issue CVE-2024-12345 in account 123456789012',
        'metadata': {'access_key_fragment': 'AKIAZZZZZZZZZZZZZZZZ'}
    }

    sanitized = sanitize_notification_payload(payload, alert_id='alert-123')

    assert sanitized['account_id'] == '[REDACTED]'
    assert sanitized['arn'] == '[REDACTED]'
    assert '[REDACTED_CVE]' in sanitized['body']
    assert sanitized['metadata']['access_key_fragment'] == '[REDACTED]'
    assert sanitized['alert_reference_url'].endswith('/alert-123')


def test_dispatch_with_retry_retries_critical_notifications(sample_notification):
    """dispatch_with_retry retries critical channel failures and returns retried on recovery."""
    sample_notification['priority'] = 'critical'

    with patch('notification_worker.send_email', side_effect=[Exception('temp'), None]) as mock_send, \
         patch('notification_worker.log_delivery') as mock_log, \
         patch('notification_worker.time.sleep'):
        status, http_status, error = dispatch_with_retry(
            channel='email',
            notification=sample_notification,
            rendered={'subject': 'A', 'body_html': '<p>A</p>', 'body_text': 'A'},
            user_prefs={'email': 'user@example.com'}
        )

    assert status == 'retried'
    assert http_status is None
    assert error is None
    assert mock_send.call_count == 2
    assert mock_log.call_count == 2


def test_log_delivery_persists_delivery_record(sample_notification):
    """log_delivery writes structured delivery data to DynamoDB."""
    with patch('notification_worker.dynamodb') as mock_dynamodb:
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        log_delivery(
            sample_notification,
            channel='webhook',
            status='failed',
            http_status_code=429,
            error_message='rate limit',
            retry_attempt=2
        )

    mock_table.put_item.assert_called_once()
    item = mock_table.put_item.call_args[1]['Item']
    assert item['notification_id'] == 'notif-123'
    assert item['channel'] == 'webhook'
    assert item['status'] == 'failed'
    assert item['http_status_code'] == 429


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == '__main__':
    import pytest as _pytest
    _pytest.main([__file__, '-v'])
