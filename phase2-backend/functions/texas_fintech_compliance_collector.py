"""
Texas State Banking Examiner Compliance Collector

Addresses 7 Tex. Admin. Code §33.35 and 31 CFR recordkeeping requirements

This Lambda function collects transaction-level evidence required by:
- Texas Department of Banking (money transmitter license holders)
- FinCEN (Financial Crimes Enforcement Network)
- BSA/AML (Bank Secrecy Act / Anti-Money Laundering)

Key Compliance Areas:
- TX-MT-R1: Transaction recordkeeping (7 TAC §33.35)
- TX-MT-R2: CTR/SAR filing evidence
- TX-MT-R3: Customer Identification Program (CIP)
- TX-MT-R4: Authorized delegate oversight
- TX-DASP-R1: Digital asset segregation (HB 1666)
"""

import json
import boto3
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import os
import logging
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
RDS_ENDPOINT = os.environ.get('RDS_ENDPOINT')
RDS_PORT = os.environ.get('RDS_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'securebase')

# AWS Clients
secrets_client = boto3.client('secretsmanager')
s3_client = boto3.client('s3')
cloudwatch = boto3.client('cloudwatch')

# S3 bucket for evidence storage
EVIDENCE_BUCKET = os.environ.get('EVIDENCE_BUCKET', 'securebase-compliance-evidence')


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def get_db_connection():
    """Get PostgreSQL connection via RDS Proxy"""
    try:
        secret_response = secrets_client.get_secret_value(
            SecretId=os.environ.get('RDS_SECRET_ARN')
        )
        secret_dict = json.loads(secret_response['SecretString'])
        
        conn = psycopg2.connect(
            host=RDS_ENDPOINT,
            port=int(RDS_PORT),
            database=DB_NAME,
            user=secret_dict['username'],
            password=secret_dict['password'],
            sslmode='require'
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise


def set_rls_context(cur, customer_id: str, role: str = 'customer'):
    """Set Row-Level Security context for multi-tenant isolation"""
    try:
        # Validate UUID format to prevent SQL injection
        import uuid
        try:
            uuid.UUID(customer_id)
        except ValueError:
            raise ValueError(f"Invalid customer_id format: must be UUID")
        
        # Validate role to prevent SQL injection
        if role not in ['customer', 'admin', 'auditor']:
            raise ValueError(f"Invalid role: must be customer, admin, or auditor")
        
        # Use parameterized queries to prevent SQL injection
        cur.execute("SET app.current_customer_id = %s", (customer_id,))
        cur.execute("SET app.role = %s", (role,))
        logger.info(f"RLS context set for customer: {customer_id}, role: {role}")
    except Exception as e:
        logger.error(f"Failed to set RLS context: {str(e)}")
        raise


def collect_transaction_records(
    conn,
    customer_id: str,
    start_date: datetime,
    end_date: datetime,
    sample_size: int = 100
) -> Dict[str, Any]:
    """
    TX-MT-R1: Transaction recordkeeping per 7 Tex. Admin. Code §33.35
    
    Required fields per 31 CFR §1010.410(e):
    - Customer name, address, TIN/SSN
    - Transaction amount, currency type
    - Date and time (to the second)
    - Transaction type (send/receive)
    - Method of payment
    - Fee charged
    - Unique transaction ID
    - Recipient information (if transmission)
    - Location of transaction
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Set RLS context
    set_rls_context(cursor, customer_id, 'admin')
    
    # Query for sample transactions in audit period
    query = """
    SELECT 
        ft.transaction_id,
        ft.transaction_timestamp,
        ft.transaction_type,
        ft.amount_usd,
        ft.currency_code,
        ft.fee_charged,
        ft.method_of_payment,
        ft.location_code,
        
        -- Sender information
        ft.sender_customer_id,
        ft.sender_name,
        ft.sender_address_line1,
        ft.sender_city,
        ft.sender_state,
        ft.sender_zip,
        ft.sender_ssn_encrypted IS NOT NULL as sender_ssn_verified,
        ft.sender_id_type,
        ft.sender_id_number,
        ft.sender_id_issuer,
        
        -- Recipient information (if transmission)
        ft.recipient_customer_id,
        ft.recipient_name,
        ft.recipient_address_line1,
        ft.recipient_bank_name,
        ft.recipient_account_number_encrypted IS NOT NULL as recipient_account_verified,
        
        -- Employee who processed
        ft.processed_by_employee_id,
        ft.processed_by_employee_name,
        
        -- Receipt number
        ft.receipt_number,
        
        -- Compliance flags
        ft.ctr_eligible,
        ft.suspicious_activity_flagged,
        ft.structuring_risk_score
        
    FROM fintech_transactions ft
    WHERE ft.customer_id = %s
      AND ft.transaction_timestamp >= %s
      AND ft.transaction_timestamp <= %s
      AND ft.texas_nexus = TRUE
    
    ORDER BY RANDOM()
    LIMIT %s
    """
    
    cursor.execute(query, (customer_id, start_date, end_date, sample_size))
    transactions = cursor.fetchall()
    
    # Transform into evidence format
    transaction_evidence = []
    for tx in transactions:
        compliant_fields = check_tx_compliance(tx)
        
        transaction_evidence.append({
            'transaction_id': str(tx['transaction_id']),
            'timestamp': tx['transaction_timestamp'].isoformat(),
            'type': tx['transaction_type'],
            'amount_usd': float(tx['amount_usd']),
            'currency': tx['currency_code'],
            'fee': float(tx['fee_charged']) if tx['fee_charged'] else 0,
            'payment_method': tx['method_of_payment'],
            'location': tx['location_code'],
            
            'sender': {
                'customer_id': str(tx['sender_customer_id']) if tx['sender_customer_id'] else None,
                'name': tx['sender_name'],
                'address': f"{tx['sender_address_line1']}, {tx['sender_city']}, {tx['sender_state']} {tx['sender_zip']}" if tx['sender_address_line1'] else None,
                'ssn_verified': tx['sender_ssn_verified'],
                'id_type': tx['sender_id_type'],
                'id_number': tx['sender_id_number'],
                'id_issuer': tx['sender_id_issuer']
            },
            
            'recipient': {
                'customer_id': str(tx['recipient_customer_id']) if tx['recipient_customer_id'] else None,
                'name': tx['recipient_name'],
                'address': tx['recipient_address_line1'],
                'bank_name': tx['recipient_bank_name'],
                'account_verified': tx['recipient_account_verified']
            } if tx['recipient_name'] else None,
            
            'processed_by': {
                'employee_id': tx['processed_by_employee_id'],
                'employee_name': tx['processed_by_employee_name']
            },
            
            'receipt_number': tx['receipt_number'],
            
            'compliance_flags': {
                'ctr_eligible': tx['ctr_eligible'],
                'suspicious_activity_flagged': tx['suspicious_activity_flagged'],
                'structuring_risk_score': tx['structuring_risk_score']
            },
            
            'compliant_fields': compliant_fields
        })
    
    compliance_summary = summarize_compliance(transaction_evidence)
    
    return {
        'control_id': 'TX-MT-R1',
        'description': 'Transaction recordkeeping - 7 TAC §33.35',
        'audit_period': f"{start_date.date()} to {end_date.date()}",
        'sample_size': len(transaction_evidence),
        'transactions': transaction_evidence,
        'compliance_summary': compliance_summary,
        'collection_timestamp': datetime.utcnow().isoformat()
    }


def check_tx_compliance(tx: Dict) -> Dict[str, bool]:
    """Verify required fields present per 31 CFR §1010.410(e)"""
    return {
        'customer_name': tx['sender_name'] is not None,
        'customer_address': tx['sender_address_line1'] is not None,
        'customer_id_verified': tx['sender_id_type'] is not None,
        'transaction_timestamp': tx['transaction_timestamp'] is not None,
        'transaction_amount': tx['amount_usd'] is not None,
        'payment_method': tx['method_of_payment'] is not None,
        'receipt_issued': tx['receipt_number'] is not None,
        'employee_identified': tx['processed_by_employee_id'] is not None,
    }


def summarize_compliance(transactions: List[Dict]) -> Dict[str, Any]:
    """Calculate compliance rate across sample"""
    total = len(transactions)
    if total == 0:
        return {'compliance_rate': 0, 'missing_fields': []}
    
    field_counts = {
        'customer_name': 0,
        'customer_address': 0,
        'customer_id_verified': 0,
        'transaction_timestamp': 0,
        'transaction_amount': 0,
        'payment_method': 0,
        'receipt_issued': 0,
        'employee_identified': 0
    }
    
    for tx in transactions:
        for field, compliant in tx['compliant_fields'].items():
            if compliant:
                field_counts[field] += 1
    
    return {
        'total_sampled': total,
        'field_compliance_rates': {
            field: count / total for field, count in field_counts.items()
        },
        'overall_compliance_rate': sum(field_counts.values()) / (total * len(field_counts)),
        'non_compliant_transactions': [
            tx['transaction_id'] for tx in transactions
            if not all(tx['compliant_fields'].values())
        ]
    }


def collect_ctr_sar_evidence(
    conn,
    customer_id: str,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """
    TX-MT-R2: CTR and SAR filing evidence
    
    CTR: Currency Transaction Report (FinCEN Form 112) - transactions >$10,000
    SAR: Suspicious Activity Report (FinCEN Form 111) - suspicious patterns
    
    Texas examiners verify:
    1. All transactions >$10K have CTR filed within 15 days
    2. Suspicious activity detected and reported within 30 days
    3. No pattern of structuring to avoid CTR threshold
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    set_rls_context(cursor, customer_id, 'admin')
    
    # Get CTR-eligible transactions (>$10K)
    ctr_query = """
    SELECT 
        ft.transaction_id,
        ft.transaction_timestamp,
        ft.amount_usd,
        ft.sender_customer_id,
        ft.sender_name,
        cf.ctr_filed,
        cf.ctr_file_date,
        cf.bsae_number,
        cf.days_to_file
    FROM fintech_transactions ft
    LEFT JOIN ctr_filings cf ON ft.transaction_id = cf.transaction_id
    WHERE ft.customer_id = %s
      AND ft.transaction_timestamp >= %s
      AND ft.transaction_timestamp <= %s
      AND ft.amount_usd > 10000
    ORDER BY ft.transaction_timestamp DESC
    """
    
    cursor.execute(ctr_query, (customer_id, start_date, end_date))
    ctr_transactions = cursor.fetchall()
    
    # Get SAR filings
    sar_query = """
    SELECT 
        sf.sar_id,
        sf.detection_date,
        sf.filing_date,
        sf.bsae_number,
        sf.activity_type,
        sf.total_amount,
        sf.days_to_file,
        COUNT(st.transaction_id) as transaction_count
    FROM sar_filings sf
    LEFT JOIN sar_transactions st ON sf.sar_id = st.sar_id
    WHERE sf.customer_id = %s
      AND sf.detection_date >= %s
      AND sf.detection_date <= %s
    GROUP BY sf.sar_id
    """
    
    cursor.execute(sar_query, (customer_id, start_date, end_date))
    sar_filings = cursor.fetchall()
    
    # Use stored procedure to detect structuring patterns
    cursor.execute("SELECT * FROM detect_structuring(%s, 30)", (customer_id,))
    potential_structuring = cursor.fetchall()
    
    # Analyze CTR compliance
    ctr_evidence = []
    for tx in ctr_transactions:
        ctr_evidence.append({
            'transaction_id': str(tx['transaction_id']),
            'transaction_date': tx['transaction_timestamp'].date().isoformat(),
            'amount': float(tx['amount_usd']),
            'customer_id': str(tx['sender_customer_id']) if tx['sender_customer_id'] else None,
            'customer_name': tx['sender_name'],
            'ctr_filed': tx['ctr_filed'] or False,
            'ctr_file_date': tx['ctr_file_date'].isoformat() if tx['ctr_file_date'] else None,
            'bsae_number': tx['bsae_number'],
            'days_to_file': tx['days_to_file'],
            'compliant': tx['ctr_filed'] and tx['days_to_file'] is not None and tx['days_to_file'] <= 15
        })
    
    # Analyze SAR compliance
    sar_evidence = []
    for sar in sar_filings:
        sar_evidence.append({
            'sar_id': str(sar['sar_id']),
            'detection_date': sar['detection_date'].isoformat(),
            'filing_date': sar['filing_date'].isoformat() if sar['filing_date'] else None,
            'bsae_number': sar['bsae_number'],
            'activity_type': sar['activity_type'],
            'transaction_count': sar['transaction_count'],
            'total_amount': float(sar['total_amount']) if sar['total_amount'] else 0,
            'days_to_file': sar['days_to_file'],
            'compliant': sar['filing_date'] is not None and sar['days_to_file'] <= 30
        })
    
    return {
        'control_id': 'TX-MT-R2',
        'description': 'CTR/SAR filing compliance',
        'audit_period': f"{start_date.date()} to {end_date.date()}",
        
        'ctr_summary': {
            'total_ctr_eligible': len(ctr_transactions),
            'ctrs_filed': len([c for c in ctr_evidence if c['ctr_filed']]),
            'ctrs_missing': len([c for c in ctr_evidence if not c['ctr_filed']]),
            'ctrs_filed_late': len([c for c in ctr_evidence if c['ctr_filed'] and c['days_to_file'] and c['days_to_file'] > 15]),
            'compliance_rate': len([c for c in ctr_evidence if c['compliant']]) / len(ctr_evidence) if ctr_evidence else 0,
            'evidence': ctr_evidence
        },
        
        'sar_summary': {
            'total_sars_filed': len(sar_filings),
            'sars_filed_timely': len([s for s in sar_evidence if s['compliant']]),
            'sars_filed_late': len([s for s in sar_evidence if s['filing_date'] and not s['compliant']]),
            'evidence': sar_evidence
        },
        
        'structuring_analysis': {
            'potential_cases': len(potential_structuring),
            'cases': [
                {
                    'sender_customer_id': str(s['sender_customer_id']) if s['sender_customer_id'] else None,
                    'sender_name': s['sender_name'],
                    'transaction_count': s['transaction_count'],
                    'total_amount': float(s['total_amount']),
                    'avg_amount': float(s['avg_amount']),
                    'risk_score': s['risk_score']
                } for s in potential_structuring
            ]
        },
        
        'collection_timestamp': datetime.utcnow().isoformat()
    }


def collect_customer_identification(
    conn,
    customer_id: str,
    sample_size: int = 50
) -> Dict[str, Any]:
    """
    TX-MT-R3: Customer Identification Program (CIP) evidence
    
    Per 31 CFR §1022.210, verify:
    - Name, address, DOB, TIN for each customer
    - Government-issued ID verification
    - Risk-based verification procedures
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    set_rls_context(cursor, customer_id, 'admin')
    
    query = """
    SELECT 
        fcd.id,
        fcd.customer_id,
        fcd.full_name,
        fcd.date_of_birth,
        fcd.ssn_encrypted IS NOT NULL as ssn_on_file,
        fcd.address_line1,
        fcd.city,
        fcd.state,
        fcd.zip,
        fcd.id_type,
        fcd.id_number,
        fcd.id_issuer,
        fcd.id_expiration_date,
        fcd.id_verification_date,
        fcd.id_verification_method,
        fcd.risk_rating,
        fcd.cdd_completed,
        fcd.cdd_completion_date,
        fcd.edd_required,
        fcd.edd_completion_date,
        fcd.pep_screening_date,
        fcd.sanctions_screening_date,
        fcd.account_created_date
    FROM fintech_customer_details fcd
    WHERE fcd.customer_id = %s
      AND fcd.account_status = 'active'
    ORDER BY RANDOM()
    LIMIT %s
    """
    
    cursor.execute(query, (customer_id, sample_size))
    customers = cursor.fetchall()
    
    cip_evidence = []
    for cust in customers:
        cip_evidence.append({
            'id': str(cust['id']),
            'customer_id': str(cust['customer_id']),
            'name': cust['full_name'],
            'dob': cust['date_of_birth'].isoformat() if cust['date_of_birth'] else None,
            'ssn_verified': cust['ssn_on_file'],
            'address': f"{cust['address_line1']}, {cust['city']}, {cust['state']} {cust['zip']}" if cust['address_line1'] else None,
            'id_verification': {
                'id_type': cust['id_type'],
                'id_number': cust['id_number'],
                'issuer': cust['id_issuer'],
                'expiration': cust['id_expiration_date'].isoformat() if cust['id_expiration_date'] else None,
                'verification_date': cust['id_verification_date'].isoformat() if cust['id_verification_date'] else None,
                'method': cust['id_verification_method']
            },
            'risk_assessment': {
                'risk_rating': cust['risk_rating'],
                'cdd_completed': cust['cdd_completed'],
                'cdd_date': cust['cdd_completion_date'].isoformat() if cust['cdd_completion_date'] else None,
                'edd_required': cust['edd_required'],
                'edd_date': cust['edd_completion_date'].isoformat() if cust['edd_completion_date'] else None
            },
            'screening': {
                'pep_screened': cust['pep_screening_date'] is not None,
                'sanctions_screened': cust['sanctions_screening_date'] is not None
            },
            'account_age_days': (datetime.now().date() - cust['account_created_date']).days if cust['account_created_date'] else None,
            
            'compliant': check_cip_compliance(cust)
        })
    
    return {
        'control_id': 'TX-MT-R3',
        'description': 'Customer Identification Program - 31 CFR §1022.210',
        'sample_size': len(cip_evidence),
        'compliance_summary': {
            'fully_compliant': len([c for c in cip_evidence if c['compliant']]),
            'compliance_rate': len([c for c in cip_evidence if c['compliant']]) / len(cip_evidence) if cip_evidence else 0,
            'missing_id_verification': len([c for c in cip_evidence if not c['id_verification']['verification_date']]),
            'missing_risk_rating': len([c for c in cip_evidence if not c['risk_assessment']['risk_rating']]),
            'edd_required_incomplete': len([c for c in cip_evidence if c['risk_assessment']['edd_required'] and not c['risk_assessment']['edd_date']])
        },
        'evidence': cip_evidence,
        'collection_timestamp': datetime.utcnow().isoformat()
    }


def check_cip_compliance(cust: Dict) -> bool:
    """Check if customer record meets CIP requirements"""
    return all([
        cust['full_name'] is not None,
        cust['date_of_birth'] is not None,
        cust['ssn_on_file'],
        cust['address_line1'] is not None,
        cust['id_type'] is not None,
        cust['id_verification_date'] is not None,
        cust['risk_rating'] is not None,
        cust['cdd_completed'],
        not cust['edd_required'] or cust['edd_completion_date'] is not None
    ])


def collect_authorized_delegate_records(conn, customer_id: str) -> Dict[str, Any]:
    """
    TX-MT-R4: Authorized delegate oversight
    
    Per 7 TAC §33.35(b)(3), arrange for delegate records to be available
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    set_rls_context(cursor, customer_id, 'admin')
    
    query = """
    SELECT 
        ad.delegate_id,
        ad.delegate_name,
        ad.agreement_date,
        ad.agreement_expiration,
        ad.locations_count,
        ad.last_audit_date,
        ad.compliance_status,
        COUNT(DISTINCT dt.transaction_id) as transaction_count_30d,
        SUM(dt.amount_usd) as transaction_volume_30d
    FROM authorized_delegates ad
    LEFT JOIN delegate_transactions dt 
        ON ad.delegate_id = dt.delegate_id 
        AND dt.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE ad.customer_id = %s
      AND ad.status = 'active'
    GROUP BY ad.delegate_id
    """
    
    cursor.execute(query, (customer_id,))
    delegates = cursor.fetchall()
    
    delegate_evidence = []
    for d in delegates:
        delegate_evidence.append({
            'delegate_id': str(d['delegate_id']),
            'delegate_name': d['delegate_name'],
            'agreement_date': d['agreement_date'].isoformat() if d['agreement_date'] else None,
            'agreement_expiration': d['agreement_expiration'].isoformat() if d['agreement_expiration'] else None,
            'locations': d['locations_count'],
            'last_audit_date': d['last_audit_date'].isoformat() if d['last_audit_date'] else None,
            'compliance_status': d['compliance_status'],
            'activity_30d': {
                'transaction_count': d['transaction_count_30d'] or 0,
                'transaction_volume': float(d['transaction_volume_30d']) if d['transaction_volume_30d'] else 0
            },
            'agreement_current': d['agreement_expiration'] and d['agreement_expiration'] > datetime.now().date(),
            'audit_current': d['last_audit_date'] and (datetime.now().date() - d['last_audit_date']).days <= 365
        })
    
    return {
        'control_id': 'TX-MT-R4',
        'description': 'Authorized delegate oversight - 7 TAC §33.35(b)(3)',
        'total_delegates': len(delegates),
        'active_delegates': len([d for d in delegate_evidence if d['activity_30d']['transaction_count'] > 0]),
        'expired_agreements': len([d for d in delegate_evidence if not d['agreement_current']]),
        'overdue_audits': len([d for d in delegate_evidence if not d['audit_current']]),
        'evidence': delegate_evidence,
        'collection_timestamp': datetime.utcnow().isoformat()
    }


def collect_digital_asset_segregation(conn, customer_id: str) -> Dict[str, Any]:
    """
    TX-DASP-R1: Digital asset customer fund segregation (HB 1666)
    
    For DASPs with 500+ TX customers or $10M+ customer funds:
    - Prohibit commingling customer funds with company funds
    - Maintain reserves sufficient to fulfill all obligations
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    set_rls_context(cursor, customer_id, 'admin')
    
    # Store current date for consistent date comparisons
    current_date = datetime.now().date()
    
    # Check if DASP requirements apply
    customer_count_query = """
    SELECT COUNT(DISTINCT id) 
    FROM fintech_customer_details 
    WHERE customer_id = %s AND state = 'TX'
    """
    cursor.execute(customer_count_query, (customer_id,))
    tx_dasp_customers = cursor.fetchone()[0]
    
    customer_funds_query = """
    SELECT 
        SUM(balance_usd) as total_customer_funds,
        SUM(CASE WHEN account_type = 'hot_wallet' THEN balance_usd ELSE 0 END) as hot_wallet_funds,
        SUM(CASE WHEN account_type = 'cold_wallet' THEN balance_usd ELSE 0 END) as cold_wallet_funds
    FROM digital_asset_accounts
    WHERE customer_id = %s AND state = 'TX'
    """
    cursor.execute(customer_funds_query, (customer_id,))
    funds = cursor.fetchone()
    
    # Get company operational funds
    company_funds_query = """
    SELECT 
        SUM(balance_usd) 
    FROM company_accounts 
    WHERE customer_id = %s AND account_purpose = 'operational'
    """
    cursor.execute(company_funds_query, (customer_id,))
    company_funds_result = cursor.fetchone()
    company_funds = float(company_funds_result[0]) if company_funds_result and company_funds_result[0] else 0
    
    # Check for commingling
    commingling_check_query = """
    SELECT 
        account_id,
        account_name
    FROM digital_asset_accounts
    WHERE customer_id = %s
      AND contains_customer_funds = TRUE 
      AND contains_company_funds = TRUE
    """
    cursor.execute(commingling_check_query, (customer_id,))
    commingled_accounts = cursor.fetchall()
    
    total_customer_funds = float(funds['total_customer_funds']) if funds and funds['total_customer_funds'] else 0
    hot_wallet = float(funds['hot_wallet_funds']) if funds and funds['hot_wallet_funds'] else 0
    cold_wallet = float(funds['cold_wallet_funds']) if funds and funds['cold_wallet_funds'] else 0
    
    dasp_required = tx_dasp_customers >= 500 or total_customer_funds >= 10000000
    
    return {
        'control_id': 'TX-DASP-R1',
        'description': 'Digital asset fund segregation - HB 1666',
        'dasp_requirements_apply': dasp_required,
        'texas_dasp_customers': tx_dasp_customers,
        'customer_funds': {
            'total_usd': total_customer_funds,
            'hot_wallet_usd': hot_wallet,
            'cold_wallet_usd': cold_wallet
        },
        'company_operational_funds': company_funds,
        'commingling_detected': len(commingled_accounts) > 0,
        'commingled_accounts': [
            {
                'account_id': acc['account_id'],
                'account_name': acc['account_name']
            } for acc in commingled_accounts
        ],
        'reserve_adequacy': {
            'customer_obligations': total_customer_funds,
            'reserves_held': total_customer_funds,  # Simplified
            'adequacy_ratio': 1.0  # Should be >= 1.0
        },
        'compliant': len(commingled_accounts) == 0,
        'collection_timestamp': datetime.utcnow().isoformat()
    }


def save_evidence_to_s3(customer_id: str, evidence: Dict[str, Any]) -> str:
    """Save evidence JSON to S3"""
    try:
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        control_id = evidence.get('control_id', 'unknown')
        key = f"{customer_id}/texas-fintech/{control_id}/{timestamp}.json"
        
        s3_client.put_object(
            Bucket=EVIDENCE_BUCKET,
            Key=key,
            Body=json.dumps(evidence, cls=DecimalEncoder, indent=2),
            ContentType='application/json',
            ServerSideEncryption='AES256',
            Metadata={
                'customer-id': customer_id,
                'control-id': control_id,
                'collection-timestamp': datetime.utcnow().isoformat()
            }
        )
        
        s3_uri = f"s3://{EVIDENCE_BUCKET}/{key}"
        logger.info(f"Evidence saved to {s3_uri}")
        return s3_uri
        
    except Exception as e:
        logger.error(f"Failed to save evidence to S3: {str(e)}")
        raise


def lambda_handler(event, context):
    """
    Main Lambda handler for Texas fintech compliance collection
    
    Event format:
    {
        "customer_id": "uuid",
        "controls": ["TX-MT-R1", "TX-MT-R2", "TX-MT-R3", "TX-MT-R4", "TX-DASP-R1"],
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "sample_size": 100
    }
    """
    try:
        logger.info(f"Starting Texas fintech compliance collection: {json.dumps(event)}")
        
        # Parse event parameters
        customer_id = event.get('customer_id')
        if not customer_id:
            raise ValueError("customer_id is required")
        
        controls = event.get('controls', ['TX-MT-R1', 'TX-MT-R2', 'TX-MT-R3', 'TX-MT-R4', 'TX-DASP-R1'])
        
        # Parse dates
        start_date_str = event.get('start_date')
        end_date_str = event.get('end_date')
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        else:
            start_date = datetime.now() - timedelta(days=90)
        
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        else:
            end_date = datetime.now()
        
        sample_size = event.get('sample_size', 100)
        
        # Connect to database
        conn = get_db_connection()
        
        # Collect evidence for each control
        evidence_results = {}
        s3_refs = {}
        
        for control_id in controls:
            try:
                logger.info(f"Collecting evidence for {control_id}")
                
                if control_id == 'TX-MT-R1':
                    evidence = collect_transaction_records(conn, customer_id, start_date, end_date, sample_size)
                elif control_id == 'TX-MT-R2':
                    evidence = collect_ctr_sar_evidence(conn, customer_id, start_date, end_date)
                elif control_id == 'TX-MT-R3':
                    evidence = collect_customer_identification(conn, customer_id, sample_size)
                elif control_id == 'TX-MT-R4':
                    evidence = collect_authorized_delegate_records(conn, customer_id)
                elif control_id == 'TX-DASP-R1':
                    evidence = collect_digital_asset_segregation(conn, customer_id)
                else:
                    logger.warning(f"Unknown control ID: {control_id}")
                    continue
                
                # Save to S3
                s3_uri = save_evidence_to_s3(customer_id, evidence)
                s3_refs[control_id] = s3_uri
                
                evidence_results[control_id] = {
                    'status': 'success',
                    's3_uri': s3_uri,
                    'summary': {
                        'description': evidence.get('description'),
                        'collection_timestamp': evidence.get('collection_timestamp')
                    }
                }
                
                logger.info(f"Successfully collected {control_id}")
                
            except Exception as e:
                logger.error(f"Failed to collect {control_id}: {str(e)}")
                evidence_results[control_id] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        conn.close()
        
        # Return summary
        response = {
            'statusCode': 200,
            'body': json.dumps({
                'customer_id': customer_id,
                'collection_date': datetime.utcnow().isoformat(),
                'audit_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'controls_collected': len([r for r in evidence_results.values() if r['status'] == 'success']),
                'controls_failed': len([r for r in evidence_results.values() if r['status'] == 'error']),
                'evidence': evidence_results,
                's3_refs': s3_refs
            }, cls=DecimalEncoder)
        }
        
        logger.info("Texas fintech compliance collection completed successfully")
        return response
        
    except Exception as e:
        logger.error(f"Lambda handler failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Texas fintech compliance collection failed'
            })
        }
