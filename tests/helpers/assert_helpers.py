"""
Custom assertion helpers for integration tests
Phase 4: Integration Testing Infrastructure
"""

from typing import Dict, List, Any, Optional
import json


def assert_response_ok(response, expected_status: int = 200, message: str = ''):
    """
    Assert response has expected status code
    
    Args:
        response: requests.Response object
        expected_status: Expected HTTP status code
        message: Custom error message
    """
    msg = message or f'Expected status {expected_status}, got {response.status_code}'
    if response.status_code != expected_status:
        # Include response body in error for debugging
        try:
            body = response.json()
            msg += f'\nResponse: {json.dumps(body, indent=2)}'
        except:
            msg += f'\nResponse: {response.text[:500]}'
    
    assert response.status_code == expected_status, msg


def assert_json_structure(data: Dict, expected_keys: List[str], message: str = ''):
    """
    Assert JSON response has expected structure
    
    Args:
        data: JSON data dictionary
        expected_keys: List of expected keys
        message: Custom error message
    """
    missing_keys = set(expected_keys) - set(data.keys())
    msg = message or f'Missing keys in response: {missing_keys}'
    assert not missing_keys, msg


def assert_permission_denied(response, message: str = ''):
    """
    Assert response indicates permission denied
    
    Args:
        response: requests.Response object
        message: Custom error message
    """
    msg = message or f'Expected 403 Forbidden, got {response.status_code}'
    assert response.status_code == 403, msg


def assert_unauthorized(response, message: str = ''):
    """
    Assert response indicates unauthorized
    
    Args:
        response: requests.Response object
        message: Custom error message
    """
    msg = message or f'Expected 401 Unauthorized, got {response.status_code}'
    assert response.status_code == 401, msg


def assert_validation_error(response, field: Optional[str] = None, message: str = ''):
    """
    Assert response indicates validation error
    
    Args:
        response: requests.Response object
        field: Optional specific field that should have error
        message: Custom error message
    """
    msg = message or f'Expected 400 Bad Request, got {response.status_code}'
    assert response.status_code == 400, msg
    
    if field:
        try:
            errors = response.json().get('errors', {})
            assert field in errors, f'Expected validation error for field: {field}'
        except:
            pass


def assert_performance_threshold(duration_ms: float, threshold_ms: float, 
                                operation: str = 'Operation'):
    """
    Assert operation completed within performance threshold
    
    Args:
        duration_ms: Actual duration in milliseconds
        threshold_ms: Maximum acceptable duration in milliseconds
        operation: Description of operation
    """
    msg = f'{operation} took {duration_ms:.2f}ms, expected < {threshold_ms}ms'
    assert duration_ms < threshold_ms, msg


def assert_data_equals(actual: Any, expected: Any, path: str = 'root',
                       ignore_keys: Optional[List[str]] = None):
    """
    Deep equality assertion for nested data structures
    
    Args:
        actual: Actual data
        expected: Expected data
        path: Current path in data structure (for error messages)
        ignore_keys: Keys to ignore in comparison
    """
    ignore_keys = ignore_keys or []
    
    if isinstance(expected, dict) and isinstance(actual, dict):
        # Compare dictionaries
        expected_keys = set(expected.keys()) - set(ignore_keys)
        actual_keys = set(actual.keys()) - set(ignore_keys)
        
        assert expected_keys == actual_keys, \
            f'Key mismatch at {path}: expected {expected_keys}, got {actual_keys}'
        
        for key in expected_keys:
            assert_data_equals(actual[key], expected[key], 
                             f'{path}.{key}', ignore_keys)
    
    elif isinstance(expected, list) and isinstance(actual, list):
        # Compare lists
        assert len(expected) == len(actual), \
            f'Length mismatch at {path}: expected {len(expected)}, got {len(actual)}'
        
        for i, (exp_item, act_item) in enumerate(zip(expected, actual)):
            assert_data_equals(act_item, exp_item, 
                             f'{path}[{i}]', ignore_keys)
    
    else:
        # Compare primitive values
        assert actual == expected, \
            f'Value mismatch at {path}: expected {expected}, got {actual}'


def assert_audit_logged(db_helper, action: str, user_id: str, 
                       resource_type: Optional[str] = None):
    """
    Assert action was logged in audit trail
    
    Args:
        db_helper: DatabaseHelper instance
        action: Action that should be logged
        user_id: User who performed action
        resource_type: Optional resource type filter
    """
    query = """
        SELECT COUNT(*) FROM audit_logs
        WHERE action = %s AND user_id = %s
    """
    params = [action, user_id]
    
    if resource_type:
        query += " AND resource_type = %s"
        params.append(resource_type)
    
    count = db_helper.query_one(query, tuple(params))['count']
    assert count > 0, f'Action {action} by user {user_id} not found in audit log'


def assert_email_sent(mailhog_client, to_email: str, subject_contains: str):
    """
    Assert email was sent (using MailHog for testing)
    
    Args:
        mailhog_client: MailHog API client
        to_email: Recipient email address
        subject_contains: Text that should be in subject
    """
    # This is a placeholder - actual implementation depends on MailHog API
    # In real tests, would query MailHog API to verify email
    pass


def assert_notification_delivered(db_helper, notification_id: str, 
                                 channel: str, status: str = 'delivered'):
    """
    Assert notification was delivered
    
    Args:
        db_helper: DatabaseHelper instance
        notification_id: Notification ID
        channel: Delivery channel (email, sms, etc.)
        status: Expected delivery status
    """
    query = """
        SELECT status FROM notification_deliveries
        WHERE notification_id = %s AND channel = %s
    """
    
    result = db_helper.query_one(query, (notification_id, channel))
    assert result is not None, f'No delivery record found for notification {notification_id}'
    assert result['status'] == status, \
        f'Expected status {status}, got {result["status"]}'
