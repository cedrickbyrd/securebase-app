"""
API client helpers for integration tests
Phase 4: Integration Testing Infrastructure
"""

import requests
import json
from typing import Dict, Optional, Any
import jwt
from datetime import datetime, timedelta


class APIClient:
    """Helper class for making API requests in tests"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize API client
        
        Args:
            base_url: Base URL for API
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.token = None
    
    def set_token(self, token: str):
        """Set authentication token"""
        self.token = token
    
    def _get_headers(self, custom_headers: Optional[Dict] = None) -> Dict:
        """Get request headers"""
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        if self.api_key:
            headers['X-API-Key'] = self.api_key
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if custom_headers:
            headers.update(custom_headers)
        
        return headers
    
    def get(self, path: str, params: Optional[Dict] = None, 
            headers: Optional[Dict] = None, timeout: int = 10) -> requests.Response:
        """Make GET request"""
        url = f'{self.base_url}/{path.lstrip("/")}'
        return self.session.get(
            url,
            params=params,
            headers=self._get_headers(headers),
            timeout=timeout
        )
    
    def post(self, path: str, data: Optional[Dict] = None,
             headers: Optional[Dict] = None, timeout: int = 10) -> requests.Response:
        """Make POST request"""
        url = f'{self.base_url}/{path.lstrip("/")}'
        return self.session.post(
            url,
            json=data,
            headers=self._get_headers(headers),
            timeout=timeout
        )
    
    def put(self, path: str, data: Optional[Dict] = None,
            headers: Optional[Dict] = None, timeout: int = 10) -> requests.Response:
        """Make PUT request"""
        url = f'{self.base_url}/{path.lstrip("/")}'
        return self.session.put(
            url,
            json=data,
            headers=self._get_headers(headers),
            timeout=timeout
        )
    
    def delete(self, path: str, headers: Optional[Dict] = None,
               timeout: int = 10) -> requests.Response:
        """Make DELETE request"""
        url = f'{self.base_url}/{path.lstrip("/")}'
        return self.session.delete(
            url,
            headers=self._get_headers(headers),
            timeout=timeout
        )
    
    def authenticate(self, email: str, password: str) -> Dict:
        """Authenticate and get token"""
        response = self.post('/auth/login', {
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            data = response.json()
            self.set_token(data.get('token'))
            return data
        else:
            raise Exception(f'Authentication failed: {response.status_code}')


class MockAPIClient:
    """Mock API client for testing without live API"""
    
    def __init__(self):
        self.requests = []
        self.responses = {}
    
    def set_response(self, method: str, path: str, response: Dict):
        """Set mock response for a request"""
        key = f'{method}:{path}'
        self.responses[key] = response
    
    def get(self, path: str, **kwargs) -> Dict:
        """Mock GET request"""
        self.requests.append({'method': 'GET', 'path': path, 'kwargs': kwargs})
        key = f'GET:{path}'
        return self.responses.get(key, {'status_code': 404, 'data': {}})
    
    def post(self, path: str, data: Dict = None, **kwargs) -> Dict:
        """Mock POST request"""
        self.requests.append({'method': 'POST', 'path': path, 'data': data, 'kwargs': kwargs})
        key = f'POST:{path}'
        return self.responses.get(key, {'status_code': 404, 'data': {}})


def generate_test_jwt(user_id: str, customer_id: str, role: str,
                     expiration_hours: int = 8) -> str:
    """
    Generate test JWT token
    
    Args:
        user_id: User ID
        customer_id: Customer ID  
        role: User role
        expiration_hours: Token expiration in hours
    
    Returns:
        JWT token string
    """
    payload = {
        'user_id': user_id,
        'customer_id': customer_id,
        'role': role,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=expiration_hours)
    }
    
    # Use test secret key
    secret = 'test-secret-key-do-not-use-in-production'
    return jwt.encode(payload, secret, algorithm='HS256')


def wait_for_async_operation(check_fn, timeout: int = 30, interval: float = 0.5) -> bool:
    """
    Wait for an asynchronous operation to complete
    
    Args:
        check_fn: Function that returns True when operation is complete
        timeout: Maximum time to wait in seconds
        interval: Check interval in seconds
    
    Returns:
        True if operation completed, False if timeout
    """
    import time
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        if check_fn():
            return True
        time.sleep(interval)
    
    return False
