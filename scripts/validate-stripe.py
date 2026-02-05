#!/usr/bin/env python3
"""
SecureBase Stripe Readiness Inspector
Custom-built configuration verification for payment infrastructure
"""

import os
import sys
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from base64 import b64encode


class StripeReadinessInspector:
    """Inspects Stripe configuration for deployment readiness"""
    
    def __init__(self):
        self.api_credential = os.getenv('STRIPE_SECRET_KEY', '')
        self.stripe_endpoint = 'https://api.stripe.com/v1'
        self.inspection_log = {'passed': [], 'failed': [], 'warnings': []}
        
    def _create_authenticated_request(self, resource_uri, verb='GET'):
        """Build authenticated HTTP request for Stripe API"""
        target_url = f"{self.stripe_endpoint}/{resource_uri}"
        http_request = Request(target_url, method=verb)
        
        # Encode credentials as Basic Auth
        auth_string = f"{self.api_credential}:".encode('utf-8')
        auth_encoded = b64encode(auth_string).decode('ascii')
        http_request.add_header('Authorization', f"Basic {auth_encoded}")
        
        try:
            with urlopen(http_request, timeout=10) as http_response:
                response_data = http_response.read().decode('utf-8')
                return json.loads(response_data)
        except HTTPError as http_err:
            error_details = http_err.read().decode('utf-8')
            print(f"API Error [{http_err.code}]: {error_details}")
            return None
        except URLError as net_err:
            print(f"Network failure: {net_err.reason}")
            return None
    
    def inspect_api_authentication(self):
        """Inspection: Validate API credentials work correctly"""
        print("\n🔐 Inspecting API Authentication...")
        
        if not self.api_credential or len(self.api_credential) < 15:
            print("   FAILED: API credential missing or malformed")
            self.inspection_log['failed'].append('authentication')
            return False
        
        # Determine mode from key prefix
        operation_mode = 'TEST' if 'test' in self.api_credential else 'LIVE'
        print(f"   Mode: {operation_mode}")
        
        account_data = self._create_authenticated_request('account')
        
        if not account_data:
            print("   FAILED: Cannot authenticate with Stripe API")
            self.inspection_log['failed'].append('authentication')
            return False
        
        account_identifier = account_data.get('id', 'unknown')
        business_details = account_data.get('business_profile', {})
        business_label = business_details.get('name', 'Not configured')
        charging_enabled = account_data.get('charges_enabled', False)
        
        print(f"   Account ID: {account_identifier}")
        print(f"   Business: {business_label}")
        print(f"   Charging: {'Enabled' if charging_enabled else 'Disabled'}")
        print("   PASSED: Authentication successful")
        
        self.inspection_log['passed'].append('authentication')
        return True
    
    def inspect_product_inventory(self):
        """Inspection: Check product inventory for required tiers"""
        print("\n📦 Inspecting Product Inventory...")
        
        required_tier_list = ['healthcare', 'fintech', 'government', 'standard']
        discovered_tier_list = []
        
        inventory_response = self._create_authenticated_request('products?active=true&limit=100')
        
        if not inventory_response:
            print("   FAILED: Cannot retrieve product inventory")
            self.inspection_log['failed'].append('products')
            return False
        
        product_collection = inventory_response.get('data', [])
        
        for product_item in product_collection:
            tier_metadata = product_item.get('metadata', {})
            tier_designation = tier_metadata.get('tier', '').lower()
            
            if tier_designation in required_tier_list:
                product_label = product_item.get('name', 'Unnamed')
                discovered_tier_list.append(tier_designation)
                print(f"   Found: {product_label} (tier={tier_designation})")
        
        missing_tier_list = [t for t in required_tier_list if t not in discovered_tier_list]
        
        if missing_tier_list:
            print(f"   FAILED: Missing tiers: {', '.join(missing_tier_list)}")
            self.inspection_log['failed'].append('products')
            return False
        
        print(f"   PASSED: All {len(required_tier_list)} tiers present")
        self.inspection_log['passed'].append('products')
        return True
    
    def inspect_pricing_configuration(self):
        """Inspection: Validate price point configuration"""
        print("\n💵 Inspecting Pricing Configuration...")
        
        tier_environment_map = {
            'STRIPE_PRICE_HEALTHCARE': 'Healthcare',
            'STRIPE_PRICE_FINTECH': 'Fintech',
            'STRIPE_PRICE_GOVERNMENT': 'Government',
            'STRIPE_PRICE_STANDARD': 'Standard'
        }
        
        configuration_valid = True
        
        for env_variable, tier_label in tier_environment_map.items():
            price_identifier = os.getenv(env_variable, '')
            
            if not price_identifier:
                print(f"   {tier_label}: Missing env var {env_variable}")
                configuration_valid = False
                continue
            
            price_data = self._create_authenticated_request(f'prices/{price_identifier}')
            
            if not price_data:
                print(f"   {tier_label}: Invalid price ID {price_identifier}")
                configuration_valid = False
                continue
            
            amount_in_cents = price_data.get('unit_amount', 0)
            amount_in_dollars = amount_in_cents / 100.0
            billing_cycle = price_data.get('recurring', {}).get('interval', 'one-time')
            
            print(f"   {tier_label}: ${amount_in_dollars:,.2f} per {billing_cycle}")
        
        if configuration_valid:
            print("   PASSED: Pricing properly configured")
            self.inspection_log['passed'].append('pricing')
        else:
            print("   FAILED: Pricing configuration incomplete")
            self.inspection_log['failed'].append('pricing')
        
        return configuration_valid
    
    def inspect_webhook_availability(self):
        """Inspection: Test webhook endpoint availability"""
        print("\n🔗 Inspecting Webhook Endpoint...")
        
        webhook_location = os.getenv('WEBHOOK_URL', '')
        
        if not webhook_location:
            print("   SKIPPED: WEBHOOK_URL not configured")
            self.inspection_log['warnings'].append('webhook_not_configured')
            return True
        
        try:
            probe_request = Request(webhook_location, method='HEAD')
            probe_request.add_header('User-Agent', 'SecureBase/Inspector-1.0')
            
            with urlopen(probe_request, timeout=10) as probe_response:
                response_code = probe_response.status
            
            if response_code < 500:
                print(f"   Endpoint: {webhook_location}")
                print(f"   Response: HTTP {response_code}")
                print("   PASSED: Webhook endpoint accessible")
                self.inspection_log['passed'].append('webhook')
                return True
            else:
                print(f"   FAILED: Endpoint error {response_code}")
                self.inspection_log['failed'].append('webhook')
                return False
                
        except URLError as connectivity_error:
            print(f"   FAILED: Cannot reach endpoint - {connectivity_error.reason}")
            self.inspection_log['failed'].append('webhook')
            return False
    
    def generate_inspection_summary(self):
        """Generate and display final inspection results"""
        print("\n" + "="*70)
        print("INSPECTION SUMMARY")
        print("="*70)
        
        total_passed = len(self.inspection_log['passed'])
        total_failed = len(self.inspection_log['failed'])
        total_warnings = len(self.inspection_log['warnings'])
        total_inspections = total_passed + total_failed
        
        if total_inspections == 0:
            print("\nNo inspections were performed")
            return 1
        
        print(f"\nPassed: {total_passed}")
        print(f"Failed: {total_failed}")
        print(f"Warnings: {total_warnings}")
        
        if self.inspection_log['failed']:
            print(f"\nFailed inspections: {', '.join(self.inspection_log['failed'])}")
            print("\n❌ INSPECTION INCOMPLETE - Issues require attention")
            return 1
        else:
            print("\n✅ INSPECTION COMPLETE - All checks passed")
            return 0


def run_inspection_suite(cli_args):
    """Execute inspection suite based on CLI arguments"""
    inspector = StripeReadinessInspector()
    
    if cli_args.all or cli_args.test_connection:
        inspector.inspect_api_authentication()
    
    if cli_args.all or cli_args.check_products:
        inspector.inspect_product_inventory()
    
    if cli_args.all or cli_args.verify_prices:
        inspector.inspect_pricing_configuration()
    
    if cli_args.all or cli_args.test_webhook:
        inspector.inspect_webhook_availability()
    
    return inspector.generate_inspection_summary()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        prog='validate-stripe',
        description='SecureBase Stripe Configuration Inspector'
    )
    
    parser.add_argument('--test-connection', action='store_true',
                       help='Inspect API authentication')
    parser.add_argument('--check-products', action='store_true',
                       help='Inspect product inventory')
    parser.add_argument('--verify-prices', action='store_true',
                       help='Inspect pricing configuration')
    parser.add_argument('--test-webhook', action='store_true',
                       help='Inspect webhook endpoint')
    parser.add_argument('--all', action='store_true',
                       help='Run complete inspection suite')
    
    cli_args = parser.parse_args()
    
    if not any([cli_args.test_connection, cli_args.check_products,
                cli_args.verify_prices, cli_args.test_webhook, cli_args.all]):
        parser.print_help()
        sys.exit(1)
    
    exit_status = run_inspection_suite(cli_args)
    sys.exit(exit_status)
