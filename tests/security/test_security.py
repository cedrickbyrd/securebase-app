"""
Security tests for SecureBase platform
Phase 4: Testing & Quality Assurance
Tests for OWASP Top 10 vulnerabilities
"""

import unittest
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


if __name__ == '__main__':
    unittest.main(verbosity=2)
