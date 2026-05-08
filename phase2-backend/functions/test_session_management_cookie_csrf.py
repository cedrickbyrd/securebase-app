import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()
sys.modules['boto3'] = MagicMock()
sys.modules['botocore'] = MagicMock()
sys.modules['botocore.exceptions'] = MagicMock()
sys.modules['bcrypt'] = MagicMock()
sys.modules['pyotp'] = MagicMock()
sys.modules['jwt'] = MagicMock()

sys.path.insert(0, os.path.dirname(__file__))
lambda_layer_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lambda_layer', 'python')
if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)

import session_management


class TestSessionManagementCookieCsrf(unittest.TestCase):
    def test_validate_route_delegates_to_get_session_info(self):
        event = {
            'httpMethod': 'GET',
            'path': '/auth/session/validate',
            'headers': {
                'Authorization': 'Bearer token-123',
                'Cookie': 'securebase_session=session-abc'
            },
            'requestContext': {'identity': {'sourceIp': '127.0.0.1'}},
        }

        with patch.object(session_management, 'get_session_info', return_value={'statusCode': 200, 'body': '{}'}) as mock_get_session_info:
            response = session_management.lambda_handler(event, None)

        self.assertEqual(response['statusCode'], 200)
        mock_get_session_info.assert_called_once_with(
            'Bearer token-123',
            event,
            'securebase_session=session-abc'
        )

    def test_build_session_cookies_includes_csrf_cookie_without_httponly(self):
        cookies = session_management.build_session_cookies(
            session_token='session-token',
            refresh_token='refresh-token',
            expires_at=MagicMock(),
            csrf_token='csrf-token-123'
        )['multiValueHeaders']['Set-Cookie']

        csrf_cookie = [c for c in cookies if c.startswith('securebase_csrf=')][0]
        self.assertIn('securebase_csrf=csrf-token-123', csrf_cookie)
        self.assertNotIn('HttpOnly', csrf_cookie)
        self.assertIn('Secure', csrf_cookie)
        self.assertIn('SameSite=None', csrf_cookie)

    def test_refresh_rejects_invalid_csrf_token(self):
        event = {
            'httpMethod': 'POST',
            'path': '/auth/refresh',
            'headers': {
                'Cookie': 'securebase_session=session-abc; securebase_refresh=refresh-abc; securebase_csrf=csrf-cookie',
                'X-CSRF-Token': 'csrf-header-mismatch'
            },
            'requestContext': {'identity': {'sourceIp': '127.0.0.1'}},
            'body': json.dumps({})
        }

        response = session_management.lambda_handler(event, None)
        self.assertEqual(response['statusCode'], 403)
        self.assertIn('Invalid CSRF token', response['body'])


if __name__ == '__main__':
    unittest.main()
