#!/usr/bin/env python3
"""
Load Testing Script for Phase 3B
Simulates realistic traffic patterns to validate performance optimizations
"""

import argparse
import asyncio
import aiohttp
import time
import json
import statistics
from datetime import datetime
from typing import List, Dict, Any
import random

# Test configuration
DEFAULT_BASE_URL = "https://api.securebase.dev"
DEFAULT_CONCURRENT_USERS = 10
DEFAULT_DURATION = 60  # seconds
DEFAULT_API_KEY = "test-api-key"


class LoadTester:
    """Load testing framework for Phase 3B APIs"""
    
    def __init__(self, base_url: str, api_key: str, concurrent_users: int):
        self.base_url = base_url
        self.api_key = api_key
        self.concurrent_users = concurrent_users
        self.results = []
        
    async def make_request(
        self, 
        session: aiohttp.ClientSession,
        method: str,
        endpoint: str,
        data: Dict = None
    ) -> Dict[str, Any]:
        """Make a single API request and measure performance"""
        
        headers = {
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            if method == 'GET':
                async with session.get(url, headers=headers) as response:
                    status = response.status
                    await response.read()
            elif method == 'POST':
                async with session.post(url, headers=headers, json=data) as response:
                    status = response.status
                    await response.read()
            elif method == 'PUT':
                async with session.put(url, headers=headers, json=data) as response:
                    status = response.status
                    await response.read()
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            duration = (time.time() - start_time) * 1000  # ms
            
            return {
                'endpoint': endpoint,
                'method': method,
                'status': status,
                'duration_ms': duration,
                'success': 200 <= status < 300,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            return {
                'endpoint': endpoint,
                'method': method,
                'status': 0,
                'duration_ms': duration,
                'success': False,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def simulate_user_session(self, session: aiohttp.ClientSession, duration: int):
        """Simulate a realistic user session"""
        
        end_time = time.time() + duration
        
        while time.time() < end_time:
            # Random user behavior - mix of operations
            action = random.choice([
                'list_tickets',
                'create_ticket',
                'view_ticket',
                'list_notifications',
                'mark_notification_read',
                'generate_forecast',
                'list_webhooks'
            ])
            
            result = None
            
            if action == 'list_tickets':
                result = await self.make_request(
                    session, 'GET', '/support/tickets?limit=50'
                )
                
            elif action == 'create_ticket':
                result = await self.make_request(
                    session, 'POST', '/support/tickets/create',
                    data={
                        'subject': f'Load test ticket {random.randint(1000, 9999)}',
                        'description': 'Automated load test',
                        'priority': random.choice(['low', 'medium', 'high', 'critical'])
                    }
                )
                
            elif action == 'view_ticket':
                ticket_id = f'test-ticket-{random.randint(1, 100)}'
                result = await self.make_request(
                    session, 'GET', f'/support/tickets/{ticket_id}'
                )
                
            elif action == 'list_notifications':
                result = await self.make_request(
                    session, 'GET', '/notifications?limit=20'
                )
                
            elif action == 'mark_notification_read':
                notif_id = f'test-notification-{random.randint(1, 100)}'
                result = await self.make_request(
                    session, 'PUT', f'/notifications/{notif_id}/read'
                )
                
            elif action == 'generate_forecast':
                months = random.choice([3, 6, 12])
                result = await self.make_request(
                    session, 'GET', f'/cost/forecast?months={months}'
                )
                
            elif action == 'list_webhooks':
                result = await self.make_request(
                    session, 'GET', '/webhooks'
                )
            
            if result:
                self.results.append(result)
            
            # Random delay between requests (0.5-3 seconds)
            await asyncio.sleep(random.uniform(0.5, 3.0))
    
    async def run_load_test(self, duration: int):
        """Run the load test with specified concurrent users"""
        
        print(f"\n{'='*60}")
        print(f"Starting Load Test")
        print(f"{'='*60}")
        print(f"Base URL: {self.base_url}")
        print(f"Concurrent Users: {self.concurrent_users}")
        print(f"Duration: {duration} seconds")
        print(f"{'='*60}\n")
        
        async with aiohttp.ClientSession() as session:
            # Create concurrent user sessions
            tasks = [
                self.simulate_user_session(session, duration)
                for _ in range(self.concurrent_users)
            ]
            
            # Run all sessions concurrently
            await asyncio.gather(*tasks)
    
    def analyze_results(self) -> Dict[str, Any]:
        """Analyze test results and generate statistics"""
        
        if not self.results:
            return {'error': 'No results to analyze'}
        
        # Overall statistics
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r['success'])
        failed_requests = total_requests - successful_requests
        
        # Latency statistics
        durations = [r['duration_ms'] for r in self.results]
        
        # Per-endpoint statistics
        by_endpoint = {}
        for result in self.results:
            endpoint = result['endpoint']
            if endpoint not in by_endpoint:
                by_endpoint[endpoint] = []
            by_endpoint[endpoint].append(result)
        
        endpoint_stats = {}
        for endpoint, results in by_endpoint.items():
            durations = [r['duration_ms'] for r in results]
            endpoint_stats[endpoint] = {
                'total_requests': len(results),
                'successful': sum(1 for r in results if r['success']),
                'failed': sum(1 for r in results if not r['success']),
                'avg_duration_ms': statistics.mean(durations),
                'min_duration_ms': min(durations),
                'max_duration_ms': max(durations),
                'p50_duration_ms': statistics.median(durations),
                'p95_duration_ms': sorted(durations)[int(len(durations) * 0.95)] if len(durations) > 1 else durations[0],
                'p99_duration_ms': sorted(durations)[int(len(durations) * 0.99)] if len(durations) > 1 else durations[0]
            }
        
        return {
            'summary': {
                'total_requests': total_requests,
                'successful_requests': successful_requests,
                'failed_requests': failed_requests,
                'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0,
                'avg_duration_ms': statistics.mean(durations),
                'min_duration_ms': min(durations),
                'max_duration_ms': max(durations),
                'p50_duration_ms': statistics.median(durations),
                'p95_duration_ms': sorted(durations)[min(int(len(durations) * 0.95), len(durations) - 1)] if len(durations) > 0 else 0,
                'p99_duration_ms': sorted(durations)[min(int(len(durations) * 0.99), len(durations) - 1)] if len(durations) > 0 else 0
            },
            'by_endpoint': endpoint_stats
        }
    
    def print_report(self, analysis: Dict[str, Any]):
        """Print a formatted test report"""
        
        print(f"\n{'='*60}")
        print("Load Test Results")
        print(f"{'='*60}\n")
        
        summary = analysis['summary']
        
        print("Overall Summary:")
        print(f"  Total Requests:      {summary['total_requests']}")
        print(f"  Successful:          {summary['successful_requests']}")
        print(f"  Failed:              {summary['failed_requests']}")
        print(f"  Success Rate:        {summary['success_rate']:.1f}%")
        print(f"\nLatency Statistics:")
        print(f"  Average:             {summary['avg_duration_ms']:.2f} ms")
        print(f"  Median (p50):        {summary['p50_duration_ms']:.2f} ms")
        print(f"  p95:                 {summary['p95_duration_ms']:.2f} ms")
        print(f"  p99:                 {summary['p99_duration_ms']:.2f} ms")
        print(f"  Min:                 {summary['min_duration_ms']:.2f} ms")
        print(f"  Max:                 {summary['max_duration_ms']:.2f} ms")
        
        print(f"\n{'='*60}")
        print("Per-Endpoint Performance")
        print(f"{'='*60}\n")
        
        for endpoint, stats in analysis['by_endpoint'].items():
            status_icon = "✅" if stats['p95_duration_ms'] < 500 else "⚠️" if stats['p95_duration_ms'] < 1000 else "❌"
            
            print(f"{status_icon} {endpoint}")
            print(f"  Requests:   {stats['total_requests']} ({stats['successful']} success, {stats['failed']} failed)")
            print(f"  Avg:        {stats['avg_duration_ms']:.2f} ms")
            print(f"  p95:        {stats['p95_duration_ms']:.2f} ms")
            print(f"  p99:        {stats['p99_duration_ms']:.2f} ms")
            print()
        
        print(f"{'='*60}")
        print("\nPerformance Assessment:")
        
        if summary['success_rate'] < 95:
            print("  ❌ Success rate below 95% - investigate errors")
        else:
            print("  ✅ Success rate acceptable (>95%)")
        
        if summary['p95_duration_ms'] > 1000:
            print("  ❌ p95 latency exceeds 1s - optimization needed")
        elif summary['p95_duration_ms'] > 500:
            print("  ⚠️  p95 latency exceeds 500ms - consider optimization")
        else:
            print("  ✅ p95 latency meets targets (<500ms)")
        
        print(f"\n{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Load test Phase 3B API endpoints'
    )
    parser.add_argument(
        '--base-url',
        default=DEFAULT_BASE_URL,
        help=f'API base URL (default: {DEFAULT_BASE_URL})'
    )
    parser.add_argument(
        '--api-key',
        default=DEFAULT_API_KEY,
        help='API key for authentication'
    )
    parser.add_argument(
        '--users',
        type=int,
        default=DEFAULT_CONCURRENT_USERS,
        help=f'Number of concurrent users (default: {DEFAULT_CONCURRENT_USERS})'
    )
    parser.add_argument(
        '--duration',
        type=int,
        default=DEFAULT_DURATION,
        help=f'Test duration in seconds (default: {DEFAULT_DURATION})'
    )
    parser.add_argument(
        '--output',
        help='Output file for detailed results (JSON format)'
    )
    
    args = parser.parse_args()
    
    # Create and run load tester
    tester = LoadTester(args.base_url, args.api_key, args.users)
    
    # Run async load test
    asyncio.run(tester.run_load_test(args.duration))
    
    # Analyze results
    analysis = tester.analyze_results()
    
    # Print report
    tester.print_report(analysis)
    
    # Save detailed results if output file specified
    if args.output:
        with open(args.output, 'w') as f:
            json.dump({
                'config': {
                    'base_url': args.base_url,
                    'concurrent_users': args.users,
                    'duration': args.duration
                },
                'analysis': analysis,
                'raw_results': tester.results
            }, f, indent=2)
        print(f"Detailed results saved to: {args.output}\n")


if __name__ == '__main__':
    main()
