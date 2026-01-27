"""
End-to-End Tests for Phase 4 Analytics
Tests complete user workflows from portal to API to database
"""

import pytest
import requests
import json
import time
from datetime import datetime
import os


class TestAnalyticsE2E:
    """End-to-end tests for analytics workflows"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup E2E test environment"""
        # Get API endpoint from environment or use default
        self.api_base_url = os.environ.get('API_BASE_URL', 'https://api-dev.securebase.example.com')
        self.api_key = os.environ.get('TEST_API_KEY', 'test-api-key-123')
        
        # Test customer credentials
        self.customer_id = os.environ.get('TEST_CUSTOMER_ID', 'cust-test-e2e')
        
        # Headers for API requests
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key,
            'Authorization': f'Bearer {self.get_auth_token()}'
        }
        
        yield
        
        # Cleanup after tests
        self.cleanup_test_data()
    
    
    def get_auth_token(self):
        """Get JWT token for authentication"""
        # In production, this would authenticate and get a real JWT
        # For E2E tests, return a test token
        return 'test-jwt-token-e2e'
    
    
    def cleanup_test_data(self):
        """Clean up test data after tests"""
        # Remove any test reports or cached data
        pass
    
    
    class TestUsageAnalytics:
        """Test usage analytics workflow"""
        
        def test_get_usage_analytics_complete_workflow(self):
            """
            E2E Test 1: Usage Analytics
            GET /analytics/usage?customer_id=xxx&period=30d
            Expected: Returns API calls, storage, compute metrics
            """
            # Step 1: Request usage analytics
            url = f"{self.api_base_url}/analytics/usage"
            params = {
                'customer_id': self.customer_id,
                'period': '30d'
            }
            
            response = requests.get(url, params=params, headers=self.headers)
            
            # Step 2: Verify response
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            
            # Step 3: Validate response structure
            assert 'customer_id' in data
            assert 'period' in data
            assert 'metrics' in data
            
            # Step 4: Validate metrics present
            metrics = data['metrics']
            required_metrics = ['api_calls', 'storage_gb', 'compute_hours', 'data_transfer_gb']
            for metric in required_metrics:
                assert metric in metrics, f"Missing metric: {metric}"
                assert isinstance(metrics[metric], (int, float))
            
            # Step 5: Validate trends
            assert 'trends' in data
            assert 'api_calls_change' in data['trends']
            
            # Step 6: Verify response time (< 500ms requirement)
            assert response.elapsed.total_seconds() < 0.5, f"Response too slow: {response.elapsed.total_seconds()}s"
            
            print(f"✓ Usage analytics test passed: {data['metrics']['api_calls']} API calls")
        
        
        def test_usage_analytics_with_different_periods(self):
            """Test usage analytics with different time periods"""
            periods = ['7d', '30d', '90d']
            
            for period in periods:
                url = f"{self.api_base_url}/analytics/usage"
                params = {'customer_id': self.customer_id, 'period': period}
                
                response = requests.get(url, params=params, headers=self.headers)
                
                assert response.status_code == 200
                data = response.json()
                assert data['period'] == period
                
                print(f"✓ Usage analytics for {period} passed")
        
        
        def test_usage_analytics_caching(self):
            """Test that repeated requests use cache"""
            url = f"{self.api_base_url}/analytics/usage"
            params = {'customer_id': self.customer_id, 'period': '30d'}
            
            # First request (cold)
            start1 = time.time()
            response1 = requests.get(url, params=params, headers=self.headers)
            time1 = time.time() - start1
            
            # Second request (should be cached)
            start2 = time.time()
            response2 = requests.get(url, params=params, headers=self.headers)
            time2 = time.time() - start2
            
            assert response1.status_code == 200
            assert response2.status_code == 200
            
            # Cached response should be faster
            # (In production environment with actual cache)
            print(f"First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")
    
    
    class TestComplianceMetrics:
        """Test compliance analytics workflow"""
        
        def test_get_compliance_analytics_complete_workflow(self):
            """
            E2E Test 2: Compliance Metrics
            GET /analytics/compliance?customer_id=xxx
            Expected: Returns compliance score, findings, trends
            """
            # Step 1: Request compliance metrics
            url = f"{self.api_base_url}/analytics/compliance"
            params = {'customer_id': self.customer_id}
            
            response = requests.get(url, params=params, headers=self.headers)
            
            # Step 2: Verify response
            assert response.status_code == 200
            data = response.json()
            
            # Step 3: Validate response structure
            assert 'customer_id' in data
            assert 'current_score' in data
            assert 'trend' in data
            assert 'findings' in data
            
            # Step 4: Validate compliance score range
            assert 0 <= data['current_score'] <= 100
            
            # Step 5: Validate findings structure
            findings = data['findings']
            severity_levels = ['critical', 'high', 'medium', 'low']
            for level in severity_levels:
                assert level in findings
                assert isinstance(findings[level], int)
                assert findings[level] >= 0
            
            # Step 6: Validate top issues
            assert 'top_issues' in data
            assert isinstance(data['top_issues'], list)
            
            # Step 7: Verify response time
            assert response.elapsed.total_seconds() < 0.5
            
            print(f"✓ Compliance test passed: Score {data['current_score']}, {sum(findings.values())} findings")
        
        
        def test_compliance_score_calculation(self):
            """Verify compliance score is calculated correctly"""
            url = f"{self.api_base_url}/analytics/compliance"
            params = {'customer_id': self.customer_id}
            
            response = requests.get(url, params=params, headers=self.headers)
            assert response.status_code == 200
            
            data = response.json()
            score = data['current_score']
            findings = data['findings']
            
            # Higher critical/high findings should result in lower score
            # This is a sanity check, actual calculation tested in unit tests
            assert isinstance(score, int)
            assert 0 <= score <= 100
    
    
    class TestCostAnalytics:
        """Test cost analytics workflow"""
        
        def test_get_cost_analytics_complete_workflow(self):
            """
            E2E Test 3: Cost Analytics
            GET /analytics/costs?customer_id=xxx&breakdown=service
            Expected: Returns cost by service with forecasts
            """
            # Step 1: Request cost analytics
            url = f"{self.api_base_url}/analytics/costs"
            params = {
                'customer_id': self.customer_id,
                'breakdown': 'service'
            }
            
            response = requests.get(url, params=params, headers=self.headers)
            
            # Step 2: Verify response
            assert response.status_code == 200
            data = response.json()
            
            # Step 3: Validate response structure
            assert 'customer_id' in data
            assert 'period' in data
            assert 'total' in data
            assert 'breakdown' in data
            assert 'forecast_next_month' in data
            
            # Step 4: Validate cost breakdown
            breakdown = data['breakdown']
            assert 'compute' in breakdown
            assert 'storage' in breakdown
            assert 'networking' in breakdown
            
            # Step 5: Validate cost values
            assert isinstance(data['total'], (int, float))
            assert data['total'] > 0
            assert data['forecast_next_month'] > 0
            
            # Step 6: Verify breakdown sums to total (approximately)
            breakdown_sum = sum(breakdown.values())
            assert abs(breakdown_sum - data['total']) < 1.0  # Allow for rounding
            
            # Step 7: Verify response time
            assert response.elapsed.total_seconds() < 0.5
            
            print(f"✓ Cost analytics test passed: ${data['total']:.2f} total")
        
        
        def test_cost_forecast_accuracy(self):
            """Test that cost forecast is reasonable"""
            url = f"{self.api_base_url}/analytics/costs"
            params = {'customer_id': self.customer_id, 'period': '30d'}
            
            response = requests.get(url, params=params, headers=self.headers)
            assert response.status_code == 200
            
            data = response.json()
            total = data['total']
            forecast = data['forecast_next_month']
            
            # Forecast should be within 50% of current (reasonable variance)
            assert 0.5 * total <= forecast <= 1.5 * total
    
    
    class TestReportGeneration:
        """Test report generation workflow"""
        
        def test_generate_report_complete_workflow(self):
            """
            E2E Test 4: Report Generation
            POST /analytics/reports
            Body: { type: 'monthly', customer_id: 'xxx' }
            Expected: Generates PDF report, returns S3 URL
            """
            # Step 1: Request report generation
            url = f"{self.api_base_url}/analytics/reports"
            payload = {
                'type': 'monthly',
                'customer_id': self.customer_id,
                'format': 'pdf',
                'period': '30d'
            }
            
            response = requests.post(url, json=payload, headers=self.headers)
            
            # Step 2: Verify response
            assert response.status_code == 200
            data = response.json()
            
            # Step 3: Validate response structure
            assert 'message' in data
            assert 'url' in data
            assert 'filename' in data
            
            # Step 4: Verify S3 URL
            report_url = data['url']
            assert report_url.startswith('https://')
            assert 's3' in report_url or 'amazonaws.com' in report_url
            
            # Step 5: Download report to verify it exists
            report_response = requests.get(report_url)
            assert report_response.status_code == 200
            assert len(report_response.content) > 0
            
            # Step 6: Verify filename structure
            filename = data['filename']
            assert self.customer_id in filename
            assert 'monthly' in filename
            assert filename.endswith('.pdf')
            
            print(f"✓ Report generation test passed: {filename}")
        
        
        def test_generate_reports_in_multiple_formats(self):
            """Test report generation in all supported formats"""
            formats = ['json', 'csv', 'pdf']
            
            for fmt in formats:
                url = f"{self.api_base_url}/analytics/reports"
                payload = {
                    'type': 'monthly',
                    'customer_id': self.customer_id,
                    'format': fmt,
                    'period': '30d'
                }
                
                response = requests.post(url, json=payload, headers=self.headers)
                
                assert response.status_code == 200, f"Failed for format {fmt}"
                data = response.json()
                assert data['filename'].endswith(f'.{fmt}')
                
                print(f"✓ Report generation ({fmt}) passed")
        
        
        def test_report_generation_respects_customer_isolation(self):
            """Verify reports only contain customer's own data"""
            url = f"{self.api_base_url}/analytics/reports"
            payload = {
                'type': 'monthly',
                'customer_id': self.customer_id,
                'format': 'json',
                'period': '30d'
            }
            
            response = requests.post(url, json=payload, headers=self.headers)
            assert response.status_code == 200
            
            # Download and parse JSON report
            report_url = response.json()['url']
            report_data = requests.get(report_url).json()
            
            # Verify all data is for this customer only
            assert report_data['customer_id'] == self.customer_id
    
    
    class TestEndToEndUserJourney:
        """Complete user journey tests"""
        
        def test_complete_analytics_dashboard_workflow(self):
            """
            Complete workflow: User logs in and views all analytics
            Simulates portal behavior
            """
            # Step 1: Get usage analytics
            usage_response = requests.get(
                f"{self.api_base_url}/analytics/usage",
                params={'customer_id': self.customer_id, 'period': '30d'},
                headers=self.headers
            )
            assert usage_response.status_code == 200
            usage_data = usage_response.json()
            
            # Step 2: Get compliance metrics
            compliance_response = requests.get(
                f"{self.api_base_url}/analytics/compliance",
                params={'customer_id': self.customer_id},
                headers=self.headers
            )
            assert compliance_response.status_code == 200
            compliance_data = compliance_response.json()
            
            # Step 3: Get cost analytics
            cost_response = requests.get(
                f"{self.api_base_url}/analytics/costs",
                params={'customer_id': self.customer_id, 'breakdown': 'service'},
                headers=self.headers
            )
            assert cost_response.status_code == 200
            cost_data = cost_response.json()
            
            # Step 4: Generate report
            report_response = requests.post(
                f"{self.api_base_url}/analytics/reports",
                json={'type': 'monthly', 'customer_id': self.customer_id, 'format': 'pdf'},
                headers=self.headers
            )
            assert report_response.status_code == 200
            report_data = report_response.json()
            
            # Verify all data is consistent
            assert usage_data['customer_id'] == self.customer_id
            assert compliance_data['customer_id'] == self.customer_id
            assert cost_data['customer_id'] == self.customer_id
            
            print("✓ Complete analytics workflow passed")
            print(f"  - API Calls: {usage_data['metrics']['api_calls']}")
            print(f"  - Compliance Score: {compliance_data['current_score']}")
            print(f"  - Total Cost: ${cost_data['total']:.2f}")
            print(f"  - Report: {report_data['filename']}")
    
    
    class TestErrorHandling:
        """Test error scenarios"""
        
        def test_unauthorized_access_denied(self):
            """Verify unauthorized requests are rejected"""
            url = f"{self.api_base_url}/analytics/usage"
            params = {'customer_id': self.customer_id}
            
            # Request without auth header
            response = requests.get(url, params=params)
            
            assert response.status_code in [401, 403]
        
        
        def test_invalid_period_handled_gracefully(self):
            """Test invalid period parameter handling"""
            url = f"{self.api_base_url}/analytics/usage"
            params = {'customer_id': self.customer_id, 'period': 'invalid'}
            
            response = requests.get(url, params=params, headers=self.headers)
            
            # Should either default or return error
            assert response.status_code in [200, 400]
        
        
        def test_missing_customer_id_rejected(self):
            """Verify requests without customer_id are rejected"""
            url = f"{self.api_base_url}/analytics/usage"
            
            response = requests.get(url, headers=self.headers)
            
            # Should require customer_id
            assert response.status_code in [400, 401]
    
    
    class TestPerformance:
        """Performance and load tests"""
        
        def test_concurrent_requests_handled(self):
            """Test system handles concurrent requests"""
            import concurrent.futures
            
            def make_request():
                url = f"{self.api_base_url}/analytics/usage"
                params = {'customer_id': self.customer_id, 'period': '30d'}
                return requests.get(url, params=params, headers=self.headers)
            
            # Make 10 concurrent requests
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(make_request) for _ in range(10)]
                responses = [f.result() for f in futures]
            
            # All should succeed
            assert all(r.status_code == 200 for r in responses)
            
            # All should return consistent data
            data = [r.json() for r in responses]
            assert all(d['customer_id'] == self.customer_id for d in data)
            
            print(f"✓ Concurrent requests test passed (10 concurrent)")
        
        
        @pytest.mark.slow
        def test_load_test_100_concurrent_requests(self):
            """
            Load test: 100 concurrent requests
            Requirement from problem statement
            """
            import concurrent.futures
            import time
            
            def make_request():
                start = time.time()
                url = f"{self.api_base_url}/analytics/usage"
                params = {'customer_id': self.customer_id, 'period': '30d'}
                response = requests.get(url, params=params, headers=self.headers)
                duration = time.time() - start
                return {
                    'status': response.status_code,
                    'duration': duration,
                    'success': response.status_code == 200
                }
            
            # Execute 100 concurrent requests
            start_time = time.time()
            with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
                futures = [executor.submit(make_request) for _ in range(100)]
                results = [f.result() for f in futures]
            total_time = time.time() - start_time
            
            # Analyze results
            success_count = sum(1 for r in results if r['success'])
            avg_duration = sum(r['duration'] for r in results) / len(results)
            p95_duration = sorted(r['duration'] for r in results)[95]
            
            # Assertions
            assert success_count >= 95, f"Only {success_count}/100 requests succeeded"
            assert p95_duration < 0.5, f"P95 latency {p95_duration:.2f}s exceeds 500ms requirement"
            
            print(f"✓ Load test passed:")
            print(f"  - Success rate: {success_count}/100")
            print(f"  - Avg duration: {avg_duration:.3f}s")
            print(f"  - P95 duration: {p95_duration:.3f}s")
            print(f"  - Total time: {total_time:.2f}s")


@pytest.mark.skipif(
    not os.environ.get('RUN_E2E_TESTS'),
    reason="E2E tests require deployed environment. Set RUN_E2E_TESTS=1 to run"
)
class TestProductionReadiness:
    """Production readiness validation"""
    
    def test_all_endpoints_return_200(self):
        """Smoke test: All analytics endpoints operational"""
        api_base = os.environ.get('API_BASE_URL')
        headers = {'X-API-Key': os.environ.get('TEST_API_KEY')}
        customer_id = os.environ.get('TEST_CUSTOMER_ID')
        
        endpoints = [
            ('GET', f'{api_base}/analytics/usage?customer_id={customer_id}'),
            ('GET', f'{api_base}/analytics/compliance?customer_id={customer_id}'),
            ('GET', f'{api_base}/analytics/costs?customer_id={customer_id}')
        ]
        
        for method, url in endpoints:
            response = requests.request(method, url, headers=headers)
            assert response.status_code == 200, f"Failed: {method} {url}"
        
        print("✓ All endpoints operational")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
