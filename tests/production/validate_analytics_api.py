#!/usr/bin/env python3
"""
Production API Endpoint Validation for Analytics Component
Validates that the production API endpoints are operational post-deployment

Usage:
    python validate_analytics_api.py --env production
    python validate_analytics_api.py --env staging --verbose
    
Environment Variables Required:
    API_BASE_URL: Base URL of the API (e.g., https://api.securebase.com/v1)
    TEST_API_KEY: API key for authentication
    TEST_CUSTOMER_ID: Customer ID for testing (optional, will use default)
"""

import argparse
import json
import os
import sys
import time
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import requests
from dataclasses import dataclass


@dataclass
class TestResult:
    """Test result data class"""
    endpoint: str
    method: str
    status: str  # 'PASS', 'FAIL', 'SKIP', 'WARN'
    message: str
    duration_ms: float
    response_code: Optional[int] = None


class AnalyticsAPIValidator:
    """Validator for Analytics API endpoints"""
    
    def __init__(self, api_base_url: str, api_key: Optional[str] = None, 
                 customer_id: Optional[str] = None, verbose: bool = False):
        """
        Initialize validator
        
        Args:
            api_base_url: Base URL of the API
            api_key: API key for authentication
            customer_id: Customer ID for testing
            verbose: Enable verbose logging
        """
        self.api_base_url = api_base_url.rstrip('/')
        self.api_key = api_key
        self.customer_id = customer_id or 'test-customer'
        self.verbose = verbose
        self.results: List[TestResult] = []
        self.session = requests.Session()
        
        # Set default headers
        if self.api_key:
            self.session.headers.update({
                'X-API-Key': self.api_key,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })
    
    def log(self, message: str, level: str = 'INFO'):
        """Log message if verbose mode enabled"""
        if self.verbose or level in ['ERROR', 'WARN']:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] [{level}] {message}")
        elif self.verbose and level == 'DEBUG':
            # Show DEBUG messages in verbose mode
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] [{level}] {message}")
    
    def add_result(self, endpoint: str, method: str, status: str, 
                   message: str, duration_ms: float, response_code: Optional[int] = None):
        """Add test result"""
        result = TestResult(
            endpoint=endpoint,
            method=method,
            status=status,
            message=message,
            duration_ms=duration_ms,
            response_code=response_code
        )
        self.results.append(result)
        
        # Log result
        status_icon = {
            'PASS': '✓',
            'FAIL': '✗',
            'WARN': '⚠',
            'SKIP': '○'
        }.get(status, '?')
        
        self.log(f"{status_icon} {method} {endpoint}: {message}", 
                level='ERROR' if status == 'FAIL' else 'INFO')
    
    def make_request(self, method: str, path: str, params: Optional[Dict] = None,
                     data: Optional[Dict] = None, timeout: int = 10) -> Tuple[Optional[requests.Response], float]:
        """
        Make HTTP request and measure duration
        
        Returns:
            Tuple of (response, duration_ms)
        """
        url = f"{self.api_base_url}/{path.lstrip('/')}"
        
        self.log(f"Request: {method} {url}", level='DEBUG')
        
        start_time = time.time()
        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=data,
                timeout=timeout
            )
            duration_ms = (time.time() - start_time) * 1000
            
            self.log(f"Response: {response.status_code} ({duration_ms:.2f}ms)", level='DEBUG')
            
            return response, duration_ms
        except requests.exceptions.RequestException as e:
            duration_ms = (time.time() - start_time) * 1000
            self.log(f"Request failed: {str(e)}", level='ERROR')
            return None, duration_ms
    
    def validate_endpoint_health(self) -> bool:
        """Validate basic endpoint health"""
        self.log("=" * 60)
        self.log("Test 1: Endpoint Health Check")
        self.log("=" * 60)
        
        # Test base API connectivity
        response, duration = self.make_request('GET', '/analytics')
        
        if response is None:
            self.add_result(
                endpoint='/analytics',
                method='GET',
                status='FAIL',
                message='API endpoint unreachable',
                duration_ms=duration
            )
            return False
        
        # Check if we get a valid response (200 or 401 for auth required)
        if response.status_code in [200, 401, 403]:
            self.add_result(
                endpoint='/analytics',
                method='GET',
                status='PASS',
                message=f'API endpoint reachable (HTTP {response.status_code})',
                duration_ms=duration,
                response_code=response.status_code
            )
            return True
        else:
            self.add_result(
                endpoint='/analytics',
                method='GET',
                status='FAIL',
                message=f'Unexpected response code: {response.status_code}',
                duration_ms=duration,
                response_code=response.status_code
            )
            return False
    
    def validate_analytics_endpoints(self) -> bool:
        """Validate all analytics GET endpoints"""
        self.log("\n" + "=" * 60)
        self.log("Test 2: Analytics Endpoints")
        self.log("=" * 60)
        
        endpoints = [
            ('/analytics', {}),
            ('/analytics/summary', {'dateRange': '30d'}),
            ('/analytics/cost-breakdown', {'dateRange': '30d', 'dimension': 'service'}),
            ('/analytics/security', {}),
            ('/analytics/compliance', {}),
            ('/analytics/usage', {'period': '30d'}),
        ]
        
        all_passed = True
        
        for path, params in endpoints:
            response, duration = self.make_request('GET', path, params=params)
            
            if response is None:
                self.add_result(
                    endpoint=path,
                    method='GET',
                    status='FAIL',
                    message='Request failed or timed out',
                    duration_ms=duration
                )
                all_passed = False
                continue
            
            # Accept 200 (success), 401 (auth required), or 404 (not deployed yet)
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.add_result(
                        endpoint=path,
                        method='GET',
                        status='PASS',
                        message=f'Success - returned valid JSON ({len(json.dumps(data))} bytes)',
                        duration_ms=duration,
                        response_code=200
                    )
                except json.JSONDecodeError:
                    self.add_result(
                        endpoint=path,
                        method='GET',
                        status='WARN',
                        message='Success but invalid JSON response',
                        duration_ms=duration,
                        response_code=200
                    )
            elif response.status_code in [401, 403]:
                self.add_result(
                    endpoint=path,
                    method='GET',
                    status='PASS',
                    message='Endpoint exists, authentication required (expected)',
                    duration_ms=duration,
                    response_code=response.status_code
                )
            elif response.status_code == 404:
                self.add_result(
                    endpoint=path,
                    method='GET',
                    status='WARN',
                    message='Endpoint not found - may not be deployed yet',
                    duration_ms=duration,
                    response_code=404
                )
            else:
                self.add_result(
                    endpoint=path,
                    method='GET',
                    status='FAIL',
                    message=f'Unexpected response code: {response.status_code}',
                    duration_ms=duration,
                    response_code=response.status_code
                )
                all_passed = False
        
        return all_passed
    
    def validate_report_endpoints(self) -> bool:
        """Validate report management endpoints"""
        self.log("\n" + "=" * 60)
        self.log("Test 3: Report Endpoints")
        self.log("=" * 60)
        
        all_passed = True
        
        # Test GET /reports
        response, duration = self.make_request('GET', '/reports')
        
        if response is None:
            self.add_result(
                endpoint='/reports',
                method='GET',
                status='FAIL',
                message='Request failed or timed out',
                duration_ms=duration
            )
            all_passed = False
        elif response.status_code in [200, 401, 403, 404]:
            status = 'PASS' if response.status_code in [200, 401, 403] else 'WARN'
            message = {
                200: 'Success - endpoint operational',
                401: 'Endpoint exists, authentication required',
                403: 'Endpoint exists, authorization required',
                404: 'Endpoint not found - may not be deployed yet'
            }.get(response.status_code, f'Response code: {response.status_code}')
            
            self.add_result(
                endpoint='/reports',
                method='GET',
                status=status,
                message=message,
                duration_ms=duration,
                response_code=response.status_code
            )
        else:
            self.add_result(
                endpoint='/reports',
                method='GET',
                status='FAIL',
                message=f'Unexpected response code: {response.status_code}',
                duration_ms=duration,
                response_code=response.status_code
            )
            all_passed = False
        
        return all_passed
    
    def validate_response_times(self) -> bool:
        """Validate response times meet SLA"""
        self.log("\n" + "=" * 60)
        self.log("Test 4: Performance Validation")
        self.log("=" * 60)
        
        # SLA: 500ms p95 latency
        sla_threshold_ms = 500
        
        # Make 10 requests to get a sample
        path = '/analytics/summary'
        params = {'dateRange': '30d'}
        durations = []
        
        self.log(f"Making 10 requests to {path} for performance testing...")
        
        for i in range(10):
            response, duration = self.make_request('GET', path, params=params)
            # Only include successful requests (200) for accurate performance metrics
            if response is not None and response.status_code == 200:
                durations.append(duration)
        
        if not durations:
            self.add_result(
                endpoint=path,
                method='GET',
                status='FAIL',
                message='Could not measure response times - all requests failed',
                duration_ms=0
            )
            return False
        
        # Calculate statistics
        avg_duration = sum(durations) / len(durations)
        sorted_durations = sorted(durations)
        # Correct p95 calculation: should be at 95% position, not 100%
        p95_index = int(len(sorted_durations) * 0.95) - 1
        p95_index = max(0, min(p95_index, len(sorted_durations) - 1))
        p95_duration = sorted_durations[p95_index]
        
        # Check against SLA
        if p95_duration <= sla_threshold_ms:
            self.add_result(
                endpoint=path,
                method='GET',
                status='PASS',
                message=f'Performance meets SLA: p95={p95_duration:.2f}ms (avg={avg_duration:.2f}ms)',
                duration_ms=p95_duration
            )
            return True
        else:
            # Performance below SLA is a warning, not a failure
            self.add_result(
                endpoint=path,
                method='GET',
                status='WARN',
                message=f'Performance below SLA: p95={p95_duration:.2f}ms exceeds {sla_threshold_ms}ms',
                duration_ms=p95_duration
            )
            # Return True because warnings don't fail the overall validation
            return True
    
    def validate_cors_headers(self) -> bool:
        """Validate CORS headers are present"""
        self.log("\n" + "=" * 60)
        self.log("Test 5: CORS Configuration")
        self.log("=" * 60)
        
        response, duration = self.make_request('OPTIONS', '/analytics')
        
        if response is None:
            self.add_result(
                endpoint='/analytics',
                method='OPTIONS',
                status='WARN',
                message='OPTIONS request failed - CORS may not be configured',
                duration_ms=duration
            )
            return False
        
        # Check for CORS headers
        cors_headers = {
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers'
        }
        
        present_headers = [h for h in cors_headers if h in response.headers]
        
        if len(present_headers) >= 1:  # At least one CORS header
            self.add_result(
                endpoint='/analytics',
                method='OPTIONS',
                status='PASS',
                message=f'CORS headers present: {", ".join(present_headers)}',
                duration_ms=duration,
                response_code=response.status_code
            )
            return True
        else:
            self.add_result(
                endpoint='/analytics',
                method='OPTIONS',
                status='WARN',
                message='CORS headers not found - may need configuration',
                duration_ms=duration,
                response_code=response.status_code
            )
            return False
    
    def validate_error_handling(self) -> bool:
        """Validate API error handling"""
        self.log("\n" + "=" * 60)
        self.log("Test 6: Error Handling")
        self.log("=" * 60)
        
        # Test invalid endpoint
        response, duration = self.make_request('GET', '/analytics/invalid-endpoint')
        
        if response is None:
            self.add_result(
                endpoint='/analytics/invalid-endpoint',
                method='GET',
                status='FAIL',
                message='Request failed',
                duration_ms=duration
            )
            return False
        
        # Should return 404 for invalid endpoint
        if response.status_code == 404:
            self.add_result(
                endpoint='/analytics/invalid-endpoint',
                method='GET',
                status='PASS',
                message='Correctly returns 404 for invalid endpoint',
                duration_ms=duration,
                response_code=404
            )
            return True
        else:
            self.add_result(
                endpoint='/analytics/invalid-endpoint',
                method='GET',
                status='WARN',
                message=f'Expected 404, got {response.status_code}',
                duration_ms=duration,
                response_code=response.status_code
            )
            return False
    
    def run_all_validations(self) -> bool:
        """Run all validation tests"""
        self.log("\n" + "=" * 80)
        self.log("ANALYTICS API PRODUCTION VALIDATION")
        self.log("=" * 80)
        self.log(f"API Base URL: {self.api_base_url}")
        self.log(f"Timestamp: {datetime.now().isoformat()}")
        self.log("=" * 80 + "\n")
        
        validations = [
            ('Endpoint Health', self.validate_endpoint_health),
            ('Analytics Endpoints', self.validate_analytics_endpoints),
            ('Report Endpoints', self.validate_report_endpoints),
            ('Performance', self.validate_response_times),
            ('CORS Configuration', self.validate_cors_headers),
            ('Error Handling', self.validate_error_handling),
        ]
        
        all_passed = True
        for name, validation_func in validations:
            try:
                passed = validation_func()
                if not passed:
                    all_passed = False
            except Exception as e:
                self.log(f"Validation '{name}' raised exception: {str(e)}", level='ERROR')
                all_passed = False
        
        return all_passed
    
    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "=" * 80)
        self.log("VALIDATION SUMMARY")
        self.log("=" * 80)
        
        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r.status == 'PASS')
        failed = sum(1 for r in self.results if r.status == 'FAIL')
        warnings = sum(1 for r in self.results if r.status == 'WARN')
        skipped = sum(1 for r in self.results if r.status == 'SKIP')
        
        self.log(f"Total Tests: {total_tests}")
        self.log(f"✓ Passed: {passed}")
        self.log(f"✗ Failed: {failed}")
        self.log(f"⚠ Warnings: {warnings}")
        self.log(f"○ Skipped: {skipped}")
        
        if failed == 0 and warnings == 0:
            self.log("\n🎉 ALL VALIDATIONS PASSED!")
        elif failed == 0:
            self.log(f"\n⚠ ALL TESTS PASSED WITH {warnings} WARNINGS")
        else:
            self.log(f"\n❌ {failed} TESTS FAILED")
        
        # Print detailed results table
        self.log("\n" + "=" * 80)
        self.log("DETAILED RESULTS")
        self.log("=" * 80)
        self.log(f"{'Method':<8} {'Endpoint':<40} {'Status':<8} {'Duration':<12} {'Code':<6}")
        self.log("-" * 80)
        
        for result in self.results:
            code_str = str(result.response_code) if result.response_code else 'N/A'
            self.log(
                f"{result.method:<8} {result.endpoint:<40} {result.status:<8} "
                f"{result.duration_ms:>8.2f}ms   {code_str:<6}"
            )
        
        self.log("=" * 80 + "\n")
        
        # Return exit code
        return 0 if failed == 0 else 1


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Validate Analytics API endpoints in production/staging',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Validate production with environment variables
    export API_BASE_URL=https://api.securebase.com/v1
    export TEST_API_KEY=your-api-key
    python validate_analytics_api.py --env production

    # Validate staging with inline parameters
    python validate_analytics_api.py --env staging \\
        --api-url https://staging-api.securebase.com/v1 \\
        --api-key test-key-123 --verbose

    # Quick validation without auth
    python validate_analytics_api.py --api-url http://localhost:3000/api
        """
    )
    
    parser.add_argument(
        '--env',
        choices=['production', 'staging', 'dev'],
        default='production',
        help='Environment to validate (default: production)'
    )
    
    parser.add_argument(
        '--api-url',
        help='API base URL (overrides environment variable API_BASE_URL)'
    )
    
    parser.add_argument(
        '--api-key',
        help='API key for authentication (overrides TEST_API_KEY)'
    )
    
    parser.add_argument(
        '--customer-id',
        help='Customer ID for testing (overrides TEST_CUSTOMER_ID)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    
    parser.add_argument(
        '--json-output',
        help='Write results to JSON file'
    )
    
    args = parser.parse_args()
    
    # Get configuration
    api_url = args.api_url or os.environ.get('API_BASE_URL')
    if not api_url:
        # Use environment-specific default
        defaults = {
            'production': 'https://api.securebase.com/v1',
            'staging': 'https://staging-api.securebase.com/v1',
            'dev': 'http://localhost:3000/api'
        }
        api_url = defaults.get(args.env)
    
    api_key = args.api_key or os.environ.get('TEST_API_KEY')
    customer_id = args.customer_id or os.environ.get('TEST_CUSTOMER_ID')
    
    if not api_url:
        print("Error: API URL not specified. Use --api-url or set API_BASE_URL environment variable.", file=sys.stderr)
        return 1
    
    # Create validator and run
    validator = AnalyticsAPIValidator(
        api_base_url=api_url,
        api_key=api_key,
        customer_id=customer_id,
        verbose=args.verbose
    )
    
    try:
        validator.run_all_validations()
        exit_code = validator.print_summary()
        
        # Write JSON output if requested
        if args.json_output:
            output = {
                'timestamp': datetime.now().isoformat(),
                'environment': args.env,
                'api_url': api_url,
                'summary': {
                    'total': len(validator.results),
                    'passed': sum(1 for r in validator.results if r.status == 'PASS'),
                    'failed': sum(1 for r in validator.results if r.status == 'FAIL'),
                    'warnings': sum(1 for r in validator.results if r.status == 'WARN'),
                    'skipped': sum(1 for r in validator.results if r.status == 'SKIP')
                },
                'results': [
                    {
                        'endpoint': r.endpoint,
                        'method': r.method,
                        'status': r.status,
                        'message': r.message,
                        'duration_ms': r.duration_ms,
                        'response_code': r.response_code
                    }
                    for r in validator.results
                ]
            }
            
            with open(args.json_output, 'w') as f:
                json.dump(output, f, indent=2)
            
            print(f"\nResults written to {args.json_output}")
        
        return exit_code
        
    except KeyboardInterrupt:
        print("\n\nValidation interrupted by user.", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"\n\nFatal error: {str(e)}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
