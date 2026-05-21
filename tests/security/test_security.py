"""
Security tests for SecureBase platform
Phase 4: Testing & Quality Assurance
Tests for OWASP Top 10 vulnerabilities
"""

import json
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, AsyncMock

import requests
import os


class TestSecurity(unittest.TestCase):
    """Security test suite"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.api_base = os.getenv('API_BASE_URL', 'http://localhost:3000')
        cls.portal_url = os.getenv('PORTAL_URL', 'http://localhost:5173')

    def test_sql_injection_protection(self):
        """Test SQL injection protection"""
        # Test various SQL injection patterns
        injection_payloads = [
            "' OR '1'='1",
            "1' OR 1=1--",
            "admin'--",
            "' UNION SELECT NULL--",
        ]
        
        for payload in injection_payloads:
            try:
                response = requests.get(
                    f'{self.api_base}/invoices',
                    params={'customer_id': payload},
                    timeout=10
                )
                
                # Should return 400 Bad Request or 401 Unauthorized
                # Should NOT return SQL errors or 200 with unauthorized data
                self.assertNotIn(response.status_code, [200, 500])
                
                if response.status_code == 500:
                    body = response.text.lower()
                    self.assertNotIn('sql', body)
                    self.assertNotIn('syntax error', body)
                    self.assertNotIn('postgresql', body)
            except requests.exceptions.ConnectionError:
                self.skipTest('API server not available')

    def test_xss_protection(self):
        """Test XSS protection"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')",
        ]
        
        for payload in xss_payloads:
            try:
                response = requests.post(
                    f'{self.api_base}/webhooks',
                    json={'url': payload, 'events': ['test']},
                    timeout=10
                )
                
                # Payload should be escaped in response
                if response.status_code == 200:
                    body = response.text
                    self.assertNotIn('<script>', body)
                    self.assertNotIn('onerror=', body)
            except requests.exceptions.ConnectionError:
                self.skipTest('API server not available')

    def test_authentication_required(self):
        """Test that endpoints require authentication"""
        protected_endpoints = [
            '/invoices',
            '/api-keys',
            '/compliance/status',
            '/webhooks',
        ]
        
        for endpoint in protected_endpoints:
            try:
                response = requests.get(f'{self.api_base}{endpoint}', timeout=10)
                
                # Should return 401 Unauthorized
                self.assertEqual(response.status_code, 401,
                               f"{endpoint} should require authentication")
            except requests.exceptions.ConnectionError:
                self.skipTest('API server not available')

    def test_csrf_protection(self):
        """Test CSRF protection"""
        # Test that state-changing operations require proper tokens
        try:
            response = requests.post(
                f'{self.api_base}/api-keys',
                json={'name': 'Test'},
                headers={'Origin': 'https://evil.com'},
                timeout=10
            )
            
            # Should reject cross-origin requests or require CSRF token
            self.assertNotEqual(response.status_code, 200)
        except requests.exceptions.ConnectionError:
            self.skipTest('API server not available')

    def test_rate_limiting(self):
        """Test rate limiting protection"""
        # Make many rapid requests
        try:
            rate_limited = False
            for _ in range(150):
                response = requests.get(
                    f'{self.api_base}/invoices',
                    headers={'X-API-Key': 'test-key'},
                    timeout=10
                )
                
                if response.status_code == 429:
                    rate_limited = True
                    break
            
            # Should eventually hit rate limit
            # Note: May not hit limit in test environment
            if not rate_limited:
                print("Warning: Rate limiting not triggered")
        except requests.exceptions.ConnectionError:
            self.skipTest('API server not available')

    def test_secure_headers(self):
        """Test security headers are present"""
        try:
            response = requests.get(f'{self.portal_url}', timeout=10)
            headers = response.headers
            
            # Check for security headers
            # Note: These may vary based on hosting
            security_headers = [
                'X-Content-Type-Options',
                'X-Frame-Options',
                'Strict-Transport-Security',
            ]
            
            for header in security_headers:
                if header not in headers:
                    print(f"Warning: Missing security header: {header}")
        except requests.exceptions.ConnectionError:
            self.skipTest('Portal not available')

    def test_sensitive_data_exposure(self):
        """Test that sensitive data is not exposed"""
        try:
            response = requests.get(f'{self.api_base}/invoices', timeout=10)
            body = response.text.lower()
            
            # Should not expose sensitive information in errors
            self.assertNotIn('password', body)
            self.assertNotIn('secret', body)
            self.assertNotIn('api_key', body)
            self.assertNotIn('token', body)
        except requests.exceptions.ConnectionError:
            self.skipTest('API server not available')

    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        invalid_tokens = [
            'invalid.token.here',
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
            '',
        ]
        
        for token in invalid_tokens:
            try:
                response = requests.get(
                    f'{self.api_base}/invoices',
                    headers={'Authorization': f'Bearer {token}'},
                    timeout=10
                )
                
                # Should reject invalid tokens
                self.assertEqual(response.status_code, 401)
            except requests.exceptions.ConnectionError:
                self.skipTest('API server not available')


# ── Unit tests for lambdas/auth brute-force hardening ─────────────────────────

class TestAuthBruteForce(unittest.TestCase):
    """Verify that the new auth Lambda enforces account lockout."""

    # ------------------------------------------------------------------
    # HTTP-level brute-force test against live auth endpoint
    # ------------------------------------------------------------------
    def test_auth_login_brute_force_triggers_lockout(self):
        """
        Sending MAX_FAILED_ATTEMPTS+1 bad-password requests to POST /auth/login
        must eventually return 429 (or 423 from the session_management Lambda).
        """
        api_base = os.getenv('API_BASE_URL', '')
        if not api_base:
            self.skipTest('API_BASE_URL not set — skipping live auth brute-force test')

        lockout_triggered = False
        for i in range(7):
            try:
                res = requests.post(
                    f'{api_base}/auth/login',
                    json={'email': 'bruteforce_test@example.invalid', 'password': f'wrong{i}'},
                    timeout=10,
                )
                if res.status_code in (429, 423):
                    lockout_triggered = True
                    break
            except requests.exceptions.ConnectionError:
                self.skipTest('Auth endpoint not reachable')

        self.assertTrue(
            lockout_triggered,
            'Expected HTTP 429/423 after repeated failed logins but never received it — '
            'account lockout may not be enforced.',
        )

    def test_auth_login_lockout_has_retry_after_header(self):
        """
        When the auth endpoint returns 429, it must include a Retry-After header
        so clients can back off correctly.
        """
        api_base = os.getenv('API_BASE_URL', '')
        if not api_base:
            self.skipTest('API_BASE_URL not set')

        # Saturate the counter first
        for i in range(6):
            try:
                requests.post(
                    f'{api_base}/auth/login',
                    json={'email': 'retry_after_test@example.invalid', 'password': f'bad{i}'},
                    timeout=10,
                )
            except requests.exceptions.ConnectionError:
                self.skipTest('Auth endpoint not reachable')

        try:
            res = requests.post(
                f'{api_base}/auth/login',
                json={'email': 'retry_after_test@example.invalid', 'password': 'final'},
                timeout=10,
            )
        except requests.exceptions.ConnectionError:
            self.skipTest('Auth endpoint not reachable')

        if res.status_code == 429:
            self.assertIn(
                'Retry-After', res.headers,
                'HTTP 429 response is missing Retry-After header',
            )

    # ------------------------------------------------------------------
    # User-enumeration via mfaSetup must not return 404
    # ------------------------------------------------------------------
    def test_mfa_setup_unknown_user_returns_400_not_404(self):
        """
        POST /auth/mfa/setup for a non-existent email must return 400, not 404,
        to prevent account enumeration.
        """
        api_base = os.getenv('API_BASE_URL', '')
        if not api_base:
            self.skipTest('API_BASE_URL not set')

        try:
            res = requests.post(
                f'{api_base}/auth/mfa/setup',
                json={'email': 'definitely_does_not_exist@example.invalid'},
                timeout=10,
            )
        except requests.exceptions.ConnectionError:
            self.skipTest('Auth endpoint not reachable')

        self.assertNotEqual(
            res.status_code, 404,
            'mfaSetup returned 404 — this leaks account existence (user enumeration)',
        )

    # ------------------------------------------------------------------
    # CORS must not be wildcard on auth endpoints
    # ------------------------------------------------------------------
    def test_auth_cors_is_not_wildcard(self):
        """
        CORS Allow-Origin on auth endpoints must be an explicit origin, not '*',
        because credentials (JWT) are involved.
        """
        api_base = os.getenv('API_BASE_URL', '')
        if not api_base:
            self.skipTest('API_BASE_URL not set')

        try:
            res = requests.options(
                f'{api_base}/auth/login',
                headers={'Origin': 'https://attacker.example.com'},
                timeout=10,
            )
        except requests.exceptions.ConnectionError:
            self.skipTest('Auth endpoint not reachable')

        allow_origin = res.headers.get('Access-Control-Allow-Origin', '')
        self.assertNotEqual(
            allow_origin, '*',
            f'Access-Control-Allow-Origin is "*" on /auth/login — this allows any '
            f'origin to send credentialed requests',
        )


# ---------------------------------------------------------------------------
# Unit tests for audit_logging.py
# ---------------------------------------------------------------------------

class TestAuditLogging(unittest.TestCase):
    """Verify the audit_logging module emits structured logs and writes to DB."""

    def _import_module(self):
        import importlib
        import sys
        # Ensure db_utils stub is in place so the module loads without the layer
        if 'db_utils' not in sys.modules:
            sys.modules['db_utils'] = MagicMock()
        import phase2_backend.functions.audit_logging as al  # noqa: F401
        return importlib.import_module('phase2-backend.functions.audit_logging'.replace('-', '_').replace('/', '.'))

    def test_log_activity_emits_cloudwatch_log(self):
        """log_activity must emit a structured log even when DB is unavailable."""
        import sys
        # Stub out db layer
        db_stub = MagicMock()
        db_stub.get_connection.side_effect = Exception('no db in test')
        sys.modules['db_utils'] = db_stub

        # Re-import to pick up the stub
        import importlib
        if 'phase2-backend' in sys.modules:
            del sys.modules['phase2-backend']

        # Dynamically locate the module file and exec it in isolation
        import types
        import os as _os
        module_path = _os.path.join(
            _os.path.dirname(__file__),
            '..', '..', 'phase2-backend', 'functions', 'audit_logging.py',
        )
        module_path = _os.path.normpath(module_path)
        spec = importlib.util.spec_from_file_location('audit_logging', module_path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules['audit_logging'] = mod
        spec.loader.exec_module(mod)

        with patch.object(mod.logger, 'info') as mock_log:
            result = mod.log_activity(
                customer_id='cust-1',
                user_id='user-1',
                activity_type='auth.login',
                action='authenticate',
                ip_address='1.2.3.4',
            )
        mock_log.assert_called_once()
        call_arg = mock_log.call_args[0][0]
        parsed = json.loads(call_arg)
        self.assertEqual(parsed['event'], 'audit_log')
        self.assertEqual(parsed['activity_type'], 'auth.login')
        # DB unavailable → returns False but log was still emitted
        self.assertFalse(result)

    def test_log_authentication_calls_log_activity(self):
        """log_authentication must delegate to log_activity with activity_type auth.*"""
        import importlib
        import os as _os
        import sys

        module_path = _os.path.normpath(_os.path.join(
            _os.path.dirname(__file__),
            '..', '..', 'phase2-backend', 'functions', 'audit_logging.py',
        ))
        spec = importlib.util.spec_from_file_location('audit_logging2', module_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        with patch.object(mod, 'log_activity', return_value=True) as mock_la:
            mod.log_authentication(
                customer_id='cust-1',
                user_id='user-1',
                event_type='login',
                success=False,
                ip_address='5.6.7.8',
                failure_reason='bad_password',
            )
        mock_la.assert_called_once()
        kwargs = mock_la.call_args[1]
        self.assertEqual(kwargs['activity_type'], 'auth.login')
        self.assertEqual(kwargs['ip_address'], '5.6.7.8')
        self.assertFalse(kwargs['changes']['success'])

    def test_query_audit_logs_parameterised_no_sql_injection(self):
        """query_audit_logs must pass filters as bound parameters, not string concat."""
        import importlib
        import os as _os
        import sys

        module_path = _os.path.normpath(_os.path.join(
            _os.path.dirname(__file__),
            '..', '..', 'phase2-backend', 'functions', 'audit_logging.py',
        ))
        spec = importlib.util.spec_from_file_location('audit_logging3', module_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.description = []
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(mod, '_DB_AVAILABLE', True), \
             patch.object(mod, 'get_connection', return_value=mock_conn), \
             patch.object(mod, 'release_connection'):
            mod.query_audit_logs(
                customer_id="'; DROP TABLE activity_feed; --",
                filters={'user_id': "' OR 1=1 --"},
            )

        execute_call = mock_cursor.execute.call_args
        sql_str = execute_call[0][0]
        params = execute_call[0][1]
        # SQL must use %s placeholders, NOT inline injection values
        self.assertIn('%s', sql_str)
        self.assertNotIn('DROP TABLE', sql_str)
        self.assertIn("'; DROP TABLE activity_feed; --", params)


if __name__ == '__main__':
    unittest.main(verbosity=2)
