"""
Performance and load tests for SecureBase API
Phase 4: Testing & Quality Assurance
"""

import unittest
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import os


class TestPerformance(unittest.TestCase):
    """Performance test suite"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.api_base = os.getenv('API_BASE_URL', 'http://localhost:3000')
        cls.test_api_key = os.getenv('TEST_API_KEY', 'test-key-123')

    def _make_request(self, endpoint, headers=None):
        """Helper to make a single request and measure time"""
        start = time.time()
        try:
            response = requests.get(f'{self.api_base}{endpoint}', headers=headers, timeout=10)
            duration = time.time() - start
            return {
                'status': response.status_code,
                'duration': duration,
                'success': response.status_code < 400
            }
        except Exception as e:
            return {
                'status': 0,
                'duration': time.time() - start,
                'success': False,
                'error': str(e)
            }

    def test_api_response_time_p50(self):
        """Test that p50 response time is under 200ms"""
        results = []
        headers = {'X-API-Key': self.test_api_key}
        
        # Make 100 requests
        for _ in range(100):
            result = self._make_request('/invoices', headers)
            if result['success']:
                results.append(result['duration'])
        
        if results:
            p50 = statistics.median(results) * 1000  # Convert to ms
            print(f"P50 response time: {p50:.2f}ms")
            self.assertLess(p50, 200, f"P50 ({p50:.2f}ms) exceeds 200ms threshold")

    def test_api_response_time_p95(self):
        """Test that p95 response time is under 1000ms"""
        results = []
        headers = {'X-API-Key': self.test_api_key}
        
        # Make 100 requests
        for _ in range(100):
            result = self._make_request('/invoices', headers)
            if result['success']:
                results.append(result['duration'])
        
        if results:
            results.sort()
            p95_index = int(len(results) * 0.95)
            p95 = results[p95_index] * 1000
            print(f"P95 response time: {p95:.2f}ms")
            self.assertLess(p95, 1000, f"P95 ({p95:.2f}ms) exceeds 1000ms threshold")

    def test_concurrent_requests(self):
        """Test system under concurrent load"""
        num_concurrent = 50
        headers = {'X-API-Key': self.test_api_key}
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
            futures = [
                executor.submit(self._make_request, '/invoices', headers)
                for _ in range(num_concurrent)
            ]
            
            results = [f.result() for f in as_completed(futures)]
        
        total_time = time.time() - start_time
        successful = sum(1 for r in results if r['success'])
        
        print(f"Concurrent requests: {num_concurrent}")
        print(f"Successful: {successful}/{num_concurrent}")
        print(f"Total time: {total_time:.2f}s")
        print(f"Requests/sec: {num_concurrent/total_time:.2f}")
        
        # At least 80% should succeed
        success_rate = successful / num_concurrent
        self.assertGreaterEqual(success_rate, 0.8, 
                               f"Success rate ({success_rate:.1%}) below 80%")

    def test_database_query_performance(self):
        """Test database query performance"""
        # This would require direct database access
        # Placeholder for now
        self.skipTest("Requires direct database access")

    def test_lambda_cold_start(self):
        """Test Lambda cold start performance"""
        # This requires invoking Lambda directly
        # Placeholder for now
        self.skipTest("Requires AWS Lambda access")


if __name__ == '__main__':
    unittest.main(verbosity=2)
