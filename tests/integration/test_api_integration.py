"""
Integration tests for SecureBase API
Phase 4: Testing & Quality Assurance
Tests full API Gateway -> Lambda -> Aurora flow
"""

import unittest
import requests
import json
import os


class TestAPIIntegration(unittest.TestCase):
    """Integration tests for API endpoints"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.api_base = os.getenv('API_BASE_URL', 'http://localhost:3000')
        cls.test_api_key = os.getenv('TEST_API_KEY', 'test-key-123')
        cls.test_customer_id = os.getenv('TEST_CUSTOMER_ID', 'test-customer')
        cls.session_token = None

    def test_01_authentication(self):
        """Test API authentication flow"""
        try:
            response = requests.post(
                f'{self.api_base}/auth',
                headers={'X-API-Key': self.test_api_key},
                timeout=10
            )
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn('token', data)
            self.assertIn('customer_id', data)
            
            # Store token for subsequent tests
            self.__class__.session_token = data['token']
        except requests.exceptions.ConnectionError:
            self.skipTest('API server not available')

    def test_02_invalid_auth_token(self):
        """Test rejection of invalid tokens"""
        try:
            response = requests.get(
                f'{self.api_base}/invoices',
                headers={'Authorization': 'Bearer invalid-token'},
                params={'customer_id': self.test_customer_id},
                timeout=10
            )
            
            self.assertEqual(response.status_code, 401)
        except requests.exceptions.ConnectionError:
            self.skipTest('API server not available')


if __name__ == '__main__':
    unittest.main(verbosity=2)
