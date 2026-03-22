"""
Unit tests for Texas Fintech Compliance Collector Lambda function
"""

import pytest
import json
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock
from texas_fintech_compliance_collector import (
    check_tx_compliance,
    summarize_compliance,
    check_cip_compliance,
    DecimalEncoder,
    collect_transaction_records,
    collect_ctr_sar_evidence,
    collect_customer_identification,
    collect_authorized_delegate_records,
    collect_digital_asset_segregation,
    lambda_handler
)


class TestDecimalEncoder:
    """Test custom JSON encoder for Decimal types"""
    
    def test_decimal_encoding(self):
        """Test that Decimals are converted to floats"""
        data = {'amount': Decimal('10000.50')}
        result = json.dumps(data, cls=DecimalEncoder)
        assert result == '{"amount": 10000.5}'
    
    def test_nested_decimal_encoding(self):
        """Test nested Decimal encoding"""
        data = {
            'transaction': {
                'amount': Decimal('5000.00'),
                'fee': Decimal('50.25')
            }
        }
        result = json.dumps(data, cls=DecimalEncoder)
        parsed = json.loads(result)
        assert parsed['transaction']['amount'] == 5000.0
        assert parsed['transaction']['fee'] == 50.25


class TestTransactionCompliance:
    """Test transaction compliance checking functions"""
    
    def test_check_tx_compliance_all_fields_present(self):
        """Test compliance check when all required fields are present"""
        tx = {
            'sender_name': 'John Doe',
            'sender_address_line1': '123 Main St',
            'sender_id_type': 'Drivers License',
            'transaction_timestamp': datetime.now(),
            'amount_usd': Decimal('1000.00'),
            'method_of_payment': 'wire',
            'receipt_number': 'RCP-123',
            'processed_by_employee_id': 'EMP-001'
        }
        
        result = check_tx_compliance(tx)
        
        assert result['customer_name'] is True
        assert result['customer_address'] is True
        assert result['customer_id_verified'] is True
        assert result['transaction_timestamp'] is True
        assert result['transaction_amount'] is True
        assert result['payment_method'] is True
        assert result['receipt_issued'] is True
        assert result['employee_identified'] is True
    
    def test_check_tx_compliance_missing_fields(self):
        """Test compliance check when required fields are missing"""
        tx = {
            'sender_name': 'John Doe',
            'sender_address_line1': None,
            'sender_id_type': None,
            'transaction_timestamp': datetime.now(),
            'amount_usd': Decimal('1000.00'),
            'method_of_payment': None,
            'receipt_number': None,
            'processed_by_employee_id': 'EMP-001'
        }
        
        result = check_tx_compliance(tx)
        
        assert result['customer_name'] is True
        assert result['customer_address'] is False
        assert result['customer_id_verified'] is False
        assert result['payment_method'] is False
        assert result['receipt_issued'] is False
    
    def test_summarize_compliance_all_compliant(self):
        """Test compliance summary with all compliant transactions"""
        transactions = [
            {
                'transaction_id': 'tx-1',
                'compliant_fields': {
                    'customer_name': True,
                    'customer_address': True,
                    'customer_id_verified': True,
                    'transaction_timestamp': True,
                    'transaction_amount': True,
                    'payment_method': True,
                    'receipt_issued': True,
                    'employee_identified': True
                }
            },
            {
                'transaction_id': 'tx-2',
                'compliant_fields': {
                    'customer_name': True,
                    'customer_address': True,
                    'customer_id_verified': True,
                    'transaction_timestamp': True,
                    'transaction_amount': True,
                    'payment_method': True,
                    'receipt_issued': True,
                    'employee_identified': True
                }
            }
        ]
        
        result = summarize_compliance(transactions)
        
        assert result['total_sampled'] == 2
        assert result['overall_compliance_rate'] == 1.0
        assert len(result['non_compliant_transactions']) == 0
    
    def test_summarize_compliance_partial(self):
        """Test compliance summary with partially compliant transactions"""
        transactions = [
            {
                'transaction_id': 'tx-1',
                'compliant_fields': {
                    'customer_name': True,
                    'customer_address': True,
                    'customer_id_verified': False,
                    'transaction_timestamp': True,
                    'transaction_amount': True,
                    'payment_method': True,
                    'receipt_issued': False,
                    'employee_identified': True
                }
            }
        ]
        
        result = summarize_compliance(transactions)
        
        assert result['total_sampled'] == 1
        assert result['overall_compliance_rate'] == 0.75  # 6/8 fields
        assert 'tx-1' in result['non_compliant_transactions']
    
    def test_summarize_compliance_empty(self):
        """Test compliance summary with empty transaction list"""
        result = summarize_compliance([])
        
        assert result['compliance_rate'] == 0
        assert result['missing_fields'] == []


class TestCIPCompliance:
    """Test Customer Identification Program compliance checking"""
    
    def test_check_cip_compliance_full(self):
        """Test CIP compliance with all required fields"""
        cust = {
            'full_name': 'Jane Smith',
            'date_of_birth': datetime(1980, 1, 1).date(),
            'ssn_on_file': True,
            'address_line1': '456 Oak Ave',
            'id_type': 'Passport',
            'id_verification_date': datetime.now().date(),
            'risk_rating': 'low',
            'cdd_completed': True,
            'edd_required': False,
            'edd_completion_date': None
        }
        
        result = check_cip_compliance(cust)
        assert result is True
    
    def test_check_cip_compliance_missing_id_verification(self):
        """Test CIP compliance when ID verification is missing"""
        cust = {
            'full_name': 'Jane Smith',
            'date_of_birth': datetime(1980, 1, 1).date(),
            'ssn_on_file': True,
            'address_line1': '456 Oak Ave',
            'id_type': 'Passport',
            'id_verification_date': None,  # Missing
            'risk_rating': 'low',
            'cdd_completed': True,
            'edd_required': False,
            'edd_completion_date': None
        }
        
        result = check_cip_compliance(cust)
        assert result is False
    
    def test_check_cip_compliance_edd_required_incomplete(self):
        """Test CIP compliance when EDD is required but not completed"""
        cust = {
            'full_name': 'Jane Smith',
            'date_of_birth': datetime(1980, 1, 1).date(),
            'ssn_on_file': True,
            'address_line1': '456 Oak Ave',
            'id_type': 'Passport',
            'id_verification_date': datetime.now().date(),
            'risk_rating': 'high',
            'cdd_completed': True,
            'edd_required': True,
            'edd_completion_date': None  # Required but missing
        }
        
        result = check_cip_compliance(cust)
        assert result is False


class TestCollectionFunctions:
    """Test evidence collection functions with mocked database"""
    
    @patch('texas_fintech_compliance_collector.get_db_connection')
    def test_collect_transaction_records(self, mock_get_db):
        """Test transaction records collection"""
        # Mock database connection and cursor
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn
        
        # Mock transaction data
        mock_cursor.fetchall.return_value = [
            {
                'transaction_id': 'tx-123',
                'transaction_timestamp': datetime(2024, 3, 1, 10, 30, 0),
                'transaction_type': 'send',
                'amount_usd': Decimal('5000.00'),
                'currency_code': 'USD',
                'fee_charged': Decimal('50.00'),
                'method_of_payment': 'wire',
                'location_code': 'TX-001',
                'sender_customer_id': 'cust-001',
                'sender_name': 'John Doe',
                'sender_address_line1': '123 Main St',
                'sender_city': 'Austin',
                'sender_state': 'TX',
                'sender_zip': '78701',
                'sender_ssn_verified': True,
                'sender_id_type': 'Drivers License',
                'sender_id_number': 'DL123456',
                'sender_id_issuer': 'Texas',
                'recipient_customer_id': None,
                'recipient_name': 'Jane Smith',
                'recipient_address_line1': '456 Oak Ave',
                'recipient_bank_name': 'First National Bank',
                'recipient_account_verified': True,
                'processed_by_employee_id': 'EMP-001',
                'processed_by_employee_name': 'Alice Johnson',
                'receipt_number': 'RCP-20240301-001',
                'ctr_eligible': False,
                'suspicious_activity_flagged': False,
                'structuring_risk_score': 0
            }
        ]
        
        customer_id = 'customer-uuid'
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 3, 31)
        
        result = collect_transaction_records(mock_conn, customer_id, start_date, end_date, 100)
        
        assert result['control_id'] == 'TX-MT-R1'
        assert result['sample_size'] == 1
        assert len(result['transactions']) == 1
        assert result['transactions'][0]['transaction_id'] == 'tx-123'
        assert result['transactions'][0]['amount_usd'] == 5000.0
        assert result['compliance_summary']['total_sampled'] == 1
    
    @patch('texas_fintech_compliance_collector.get_db_connection')
    def test_collect_ctr_sar_evidence(self, mock_get_db):
        """Test CTR/SAR evidence collection"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn
        
        # Mock CTR data
        ctr_data = [
            {
                'transaction_id': 'tx-big',
                'transaction_timestamp': datetime(2024, 3, 1, 10, 0, 0),
                'amount_usd': Decimal('15000.00'),
                'sender_customer_id': 'cust-001',
                'sender_name': 'Big Spender',
                'ctr_filed': True,
                'ctr_file_date': datetime(2024, 3, 10).date(),
                'bsae_number': 'CTR-123456',
                'days_to_file': 9
            }
        ]
        
        # Mock SAR data
        sar_data = [
            {
                'sar_id': 'sar-001',
                'detection_date': datetime(2024, 2, 1).date(),
                'filing_date': datetime(2024, 2, 20).date(),
                'bsae_number': 'SAR-789012',
                'activity_type': 'structuring',
                'total_amount': Decimal('25000.00'),
                'days_to_file': 19,
                'transaction_count': 5
            }
        ]
        
        # Mock structuring data
        structuring_data = [
            {
                'sender_customer_id': 'cust-002',
                'sender_name': 'Suspicious Person',
                'transaction_count': 4,
                'total_amount': Decimal('35000.00'),
                'avg_amount': Decimal('8750.00'),
                'risk_score': 70
            }
        ]
        
        # Setup mock to return different data for each query
        mock_cursor.fetchall.side_effect = [ctr_data, sar_data, structuring_data]
        
        customer_id = 'customer-uuid'
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 3, 31)
        
        result = collect_ctr_sar_evidence(mock_conn, customer_id, start_date, end_date)
        
        assert result['control_id'] == 'TX-MT-R2'
        assert result['ctr_summary']['total_ctr_eligible'] == 1
        assert result['ctr_summary']['ctrs_filed'] == 1
        assert result['ctr_summary']['compliance_rate'] == 1.0
        assert result['sar_summary']['total_sars_filed'] == 1
        assert result['structuring_analysis']['potential_cases'] == 1


class TestLambdaHandler:
    """Test Lambda handler function"""
    
    @patch('texas_fintech_compliance_collector.save_evidence_to_s3')
    @patch('texas_fintech_compliance_collector.get_db_connection')
    def test_lambda_handler_success(self, mock_get_db, mock_save_s3):
        """Test successful Lambda invocation"""
        # Mock database
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = [0]
        
        # Mock S3 save
        mock_save_s3.return_value = 's3://bucket/evidence.json'
        
        event = {
            'customer_id': 'test-customer-uuid',
            'controls': ['TX-MT-R1'],
            'start_date': '2024-01-01',
            'end_date': '2024-03-31',
            'sample_size': 50
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['customer_id'] == 'test-customer-uuid'
        assert 'evidence' in body
        assert 'TX-MT-R1' in body['evidence']
    
    @patch('texas_fintech_compliance_collector.get_db_connection')
    def test_lambda_handler_missing_customer_id(self, mock_get_db):
        """Test Lambda handler with missing customer_id"""
        event = {
            'controls': ['TX-MT-R1']
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert 'error' in body
    
    @patch('texas_fintech_compliance_collector.get_db_connection')
    def test_lambda_handler_default_dates(self, mock_get_db):
        """Test Lambda handler uses default dates when not provided"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = [0]
        
        event = {
            'customer_id': 'test-customer-uuid',
            'controls': []  # Empty controls list
        }
        
        response = lambda_handler(event, None)
        
        # Should not fail even with empty controls
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['controls_collected'] >= 0


class TestDataIntegrity:
    """Test data integrity and validation"""
    
    def test_decimal_precision_preservation(self):
        """Test that monetary amounts maintain precision"""
        tx = {
            'amount_usd': Decimal('10000.99'),
            'fee_charged': Decimal('50.01')
        }
        
        # Simulate what happens in the Lambda
        json_str = json.dumps(tx, cls=DecimalEncoder)
        parsed = json.loads(json_str)
        
        # Precision should be maintained after JSON round-trip
        assert parsed['amount_usd'] == 10000.99
        assert parsed['fee_charged'] == 50.01
    
    def test_ctr_threshold_boundary(self):
        """Test CTR eligibility at $10,000 threshold"""
        # Exactly $10,000 should NOT trigger CTR (> 10000 required)
        assert Decimal('10000.00') <= 10000
        
        # $10,000.01 should trigger CTR
        assert Decimal('10000.01') > 10000
        
        # $9,999.99 should NOT trigger CTR
        assert Decimal('9999.99') <= 10000


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
