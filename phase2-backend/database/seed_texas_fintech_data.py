#!/usr/bin/env python3
"""
Seed script for Texas Fintech Compliance Test Data

This script generates sample data for testing the Texas fintech compliance collector.
It creates realistic transaction records, customer KYC data, and CTR/SAR filings.

Usage:
    python seed_texas_fintech_data.py --customer-id <UUID> --transactions 100
    
Environment Variables:
    DB_HOST - PostgreSQL host
    DB_PORT - PostgreSQL port (default: 5432)
    DB_NAME - Database name (default: securebase)
    DB_USER - Database user
    DB_PASSWORD - Database password
"""

import os
import sys
import uuid
import random
import argparse
from datetime import datetime, timedelta
from decimal import Decimal
import psycopg2
from psycopg2.extras import execute_values

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'securebase')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

# Sample data
FIRST_NAMES = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Mary']
LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
CITIES = ['Austin', 'Houston', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi']
TRANSACTION_TYPES = ['send', 'receive', 'exchange', 'deposit', 'withdrawal']
PAYMENT_METHODS = ['wire', 'ACH', 'check', 'card', 'cash', 'crypto']
ID_TYPES = ['Drivers License', 'Passport', 'State ID', 'Military ID']
RISK_RATINGS = ['low', 'medium', 'high']


def get_db_connection():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def generate_customer_details(customer_id, count=50):
    """Generate fintech customer details"""
    customers = []
    
    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        full_name = f"{first_name} {last_name}"
        city = random.choice(CITIES)
        
        # Some customers are high risk (10%)
        risk_rating = random.choices(RISK_RATINGS, weights=[70, 20, 10])[0]
        edd_required = risk_rating == 'high'
        
        # 90% have verified IDs
        has_verification = random.random() < 0.9
        
        customer = {
            'id': str(uuid.uuid4()),
            'customer_id': customer_id,
            'full_name': full_name,
            'date_of_birth': (datetime.now() - timedelta(days=random.randint(18*365, 80*365))).date(),
            'ssn_encrypted': f'ENC_{uuid.uuid4().hex[:12]}',
            'address_line1': f'{random.randint(100, 9999)} {random.choice(["Main", "Oak", "Elm", "Pine"])} St',
            'city': city,
            'state': 'TX',
            'zip': f'{random.randint(75000, 79999)}',
            'country': 'US',
            'id_type': random.choice(ID_TYPES) if has_verification else None,
            'id_number': f'TX{random.randint(10000000, 99999999)}' if has_verification else None,
            'id_issuer': 'Texas' if has_verification else None,
            'id_expiration_date': (datetime.now() + timedelta(days=random.randint(30, 1825))).date() if has_verification else None,
            'id_verification_date': (datetime.now() - timedelta(days=random.randint(1, 365))).date() if has_verification else None,
            'id_verification_method': random.choice(['electronic', 'manual', 'documentary']) if has_verification else None,
            'risk_rating': risk_rating,
            'cdd_completed': True,
            'cdd_completion_date': (datetime.now() - timedelta(days=random.randint(1, 365))).date(),
            'edd_required': edd_required,
            'edd_completion_date': (datetime.now() - timedelta(days=random.randint(1, 180))).date() if edd_required else None,
            'pep_screening_date': (datetime.now() - timedelta(days=random.randint(1, 365))).date(),
            'pep_status': False,
            'sanctions_screening_date': (datetime.now() - timedelta(days=random.randint(1, 365))).date(),
            'sanctions_match': False,
            'account_status': 'active',
            'account_created_date': (datetime.now() - timedelta(days=random.randint(30, 730))).date()
        }
        customers.append(customer)
    
    return customers


def generate_transactions(customer_id, customer_details, count=100):
    """Generate fintech transactions"""
    transactions = []
    
    # 95% of transactions are normal, 5% are suspicious
    for i in range(count):
        tx_type = random.choice(TRANSACTION_TYPES)
        
        # Determine transaction amount
        if random.random() < 0.05:
            # 5% chance of large transaction (CTR eligible)
            amount = Decimal(random.uniform(10001, 50000)).quantize(Decimal('0.01'))
        elif random.random() < 0.1:
            # 10% chance of just-under-threshold (structuring indicator)
            amount = Decimal(random.uniform(8000, 9999)).quantize(Decimal('0.01'))
        else:
            # Normal transaction
            amount = Decimal(random.uniform(100, 5000)).quantize(Decimal('0.01'))
        
        fee = (amount * Decimal('0.01')).quantize(Decimal('0.01'))  # 1% fee
        
        sender = random.choice(customer_details)
        recipient = random.choice(customer_details) if tx_type in ['send', 'exchange'] else None
        
        # 2% of transactions are flagged as suspicious
        suspicious = random.random() < 0.02
        structuring_score = random.randint(70, 90) if suspicious else random.randint(0, 20)
        
        transaction = {
            'transaction_id': str(uuid.uuid4()),
            'customer_id': customer_id,
            'transaction_timestamp': datetime.now() - timedelta(days=random.randint(0, 90), 
                                                                 hours=random.randint(0, 23),
                                                                 minutes=random.randint(0, 59),
                                                                 seconds=random.randint(0, 59)),
            'transaction_type': tx_type,
            'amount_usd': amount,
            'currency_code': 'USD',
            'fee_charged': fee,
            'method_of_payment': random.choice(PAYMENT_METHODS),
            'location_code': f'TX-{random.randint(1, 10):03d}',
            'sender_customer_id': sender['id'] if sender else None,
            'sender_name': sender['full_name'],
            'sender_address_line1': sender['address_line1'],
            'sender_city': sender['city'],
            'sender_state': sender['state'],
            'sender_zip': sender['zip'],
            'sender_ssn_encrypted': sender['ssn_encrypted'],
            'sender_id_type': sender['id_type'],
            'sender_id_number': sender['id_number'],
            'sender_id_issuer': sender['id_issuer'],
            'recipient_customer_id': recipient['id'] if recipient else None,
            'recipient_name': recipient['full_name'] if recipient else None,
            'recipient_address_line1': recipient['address_line1'] if recipient else None,
            'recipient_bank_name': f'{random.choice(["First", "Second", "Third"])} National Bank' if recipient else None,
            'recipient_account_number_encrypted': f'ENC_{uuid.uuid4().hex[:16]}' if recipient else None,
            'processed_by_employee_id': f'EMP-{random.randint(1, 20):03d}',
            'processed_by_employee_name': f'{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}',
            'receipt_number': f'RCP-{datetime.now().strftime("%Y%m%d")}-{random.randint(1000, 9999)}',
            'texas_nexus': True,
            'suspicious_activity_flagged': suspicious,
            'structuring_risk_score': structuring_score
        }
        transactions.append(transaction)
    
    return transactions


def generate_ctr_filings(transactions):
    """Generate CTR filings for eligible transactions"""
    ctr_filings = []
    
    for tx in transactions:
        if tx['amount_usd'] > 10000:
            # 90% of CTRs are filed on time
            filed_on_time = random.random() < 0.9
            
            if filed_on_time:
                days_to_file = random.randint(1, 15)
            else:
                days_to_file = random.randint(16, 30)
            
            ctr_file_date = tx['transaction_timestamp'].date() + timedelta(days=days_to_file)
            
            ctr = {
                'id': str(uuid.uuid4()),
                'customer_id': tx['customer_id'],
                'transaction_id': tx['transaction_id'],
                'ctr_filed': True,
                'ctr_file_date': ctr_file_date,
                'bsae_number': f'CTR-{random.randint(100000, 999999)}',
                'filing_status': 'accepted',
                'transaction_date': tx['transaction_timestamp'].date(),
                'transaction_amount': tx['amount_usd'],
                'customer_name': tx['sender_name'],
                'filing_deadline': tx['transaction_timestamp'].date() + timedelta(days=15),
                'days_to_file': days_to_file,
                'filed_on_time': days_to_file <= 15
            }
            ctr_filings.append(ctr)
    
    return ctr_filings


def generate_sar_filings(customer_id, transactions):
    """Generate SAR filings for suspicious transactions"""
    sar_filings = []
    suspicious_txs = [tx for tx in transactions if tx['suspicious_activity_flagged']]
    
    # Group suspicious transactions into SARs (1-5 transactions per SAR)
    while suspicious_txs:
        sar_tx_count = min(random.randint(1, 5), len(suspicious_txs))
        sar_transactions = suspicious_txs[:sar_tx_count]
        suspicious_txs = suspicious_txs[sar_tx_count:]
        
        detection_date = min(tx['transaction_timestamp'] for tx in sar_transactions).date()
        
        # 85% of SARs are filed on time
        filed_on_time = random.random() < 0.85
        if filed_on_time:
            days_to_file = random.randint(1, 30)
        else:
            days_to_file = random.randint(31, 60)
        
        filing_date = detection_date + timedelta(days=days_to_file)
        
        sar = {
            'sar_id': str(uuid.uuid4()),
            'customer_id': customer_id,
            'detection_date': detection_date,
            'filing_date': filing_date,
            'bsae_number': f'SAR-{random.randint(100000, 999999)}',
            'filing_status': 'accepted',
            'activity_type': random.choice(['structuring', 'money_laundering', 'fraud', 'unusual_pattern']),
            'narrative': f'Suspicious activity detected: {sar_tx_count} transactions totaling ${sum(tx["amount_usd"] for tx in sar_transactions):.2f}',
            'total_amount': sum(tx['amount_usd'] for tx in sar_transactions),
            'filing_deadline': detection_date + timedelta(days=30),
            'days_to_file': days_to_file,
            'filed_on_time': days_to_file <= 30,
            'transaction_ids': [tx['transaction_id'] for tx in sar_transactions]
        }
        sar_filings.append(sar)
    
    return sar_filings


def seed_database(customer_id, num_customers=50, num_transactions=100):
    """Seed database with test data"""
    print(f"🌱 Seeding Texas fintech test data...")
    print(f"   Customer ID: {customer_id}")
    print(f"   Customer Details: {num_customers}")
    print(f"   Transactions: {num_transactions}")
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Set RLS context as admin
        cur.execute(f"SET app.current_customer_id = '{customer_id}'")
        cur.execute("SET app.role = 'admin'")
        
        # Generate customer details
        print("📝 Generating customer details...")
        customer_details = generate_customer_details(customer_id, num_customers)
        
        customer_query = """
        INSERT INTO fintech_customer_details (
            id, customer_id, full_name, date_of_birth, ssn_encrypted,
            address_line1, city, state, zip, country,
            id_type, id_number, id_issuer, id_expiration_date,
            id_verification_date, id_verification_method,
            risk_rating, cdd_completed, cdd_completion_date,
            edd_required, edd_completion_date,
            pep_screening_date, pep_status,
            sanctions_screening_date, sanctions_match,
            account_status, account_created_date
        ) VALUES %s
        """
        
        customer_values = [
            (
                c['id'], c['customer_id'], c['full_name'], c['date_of_birth'], c['ssn_encrypted'],
                c['address_line1'], c['city'], c['state'], c['zip'], c['country'],
                c['id_type'], c['id_number'], c['id_issuer'], c['id_expiration_date'],
                c['id_verification_date'], c['id_verification_method'],
                c['risk_rating'], c['cdd_completed'], c['cdd_completion_date'],
                c['edd_required'], c['edd_completion_date'],
                c['pep_screening_date'], c['pep_status'],
                c['sanctions_screening_date'], c['sanctions_match'],
                c['account_status'], c['account_created_date']
            ) for c in customer_details
        ]
        
        execute_values(cur, customer_query, customer_values)
        print(f"   ✓ Created {len(customer_details)} customer records")
        
        # Generate transactions
        print("💸 Generating transactions...")
        transactions = generate_transactions(customer_id, customer_details, num_transactions)
        
        transaction_query = """
        INSERT INTO fintech_transactions (
            transaction_id, customer_id, transaction_timestamp, transaction_type,
            amount_usd, currency_code, fee_charged, method_of_payment, location_code,
            sender_customer_id, sender_name, sender_address_line1, sender_city, sender_state, sender_zip,
            sender_ssn_encrypted, sender_id_type, sender_id_number, sender_id_issuer,
            recipient_customer_id, recipient_name, recipient_address_line1,
            recipient_bank_name, recipient_account_number_encrypted,
            processed_by_employee_id, processed_by_employee_name, receipt_number,
            texas_nexus, suspicious_activity_flagged, structuring_risk_score
        ) VALUES %s
        """
        
        transaction_values = [
            (
                t['transaction_id'], t['customer_id'], t['transaction_timestamp'], t['transaction_type'],
                t['amount_usd'], t['currency_code'], t['fee_charged'], t['method_of_payment'], t['location_code'],
                t['sender_customer_id'], t['sender_name'], t['sender_address_line1'], t['sender_city'], 
                t['sender_state'], t['sender_zip'], t['sender_ssn_encrypted'], t['sender_id_type'], 
                t['sender_id_number'], t['sender_id_issuer'],
                t['recipient_customer_id'], t['recipient_name'], t['recipient_address_line1'],
                t['recipient_bank_name'], t['recipient_account_number_encrypted'],
                t['processed_by_employee_id'], t['processed_by_employee_name'], t['receipt_number'],
                t['texas_nexus'], t['suspicious_activity_flagged'], t['structuring_risk_score']
            ) for t in transactions
        ]
        
        execute_values(cur, transaction_query, transaction_values)
        ctr_eligible = len([t for t in transactions if t['amount_usd'] > 10000])
        suspicious = len([t for t in transactions if t['suspicious_activity_flagged']])
        print(f"   ✓ Created {len(transactions)} transactions")
        print(f"     - CTR eligible: {ctr_eligible}")
        print(f"     - Suspicious: {suspicious}")
        
        # Generate CTR filings
        print("📋 Generating CTR filings...")
        ctr_filings = generate_ctr_filings(transactions)
        
        if ctr_filings:
            ctr_query = """
            INSERT INTO ctr_filings (
                id, customer_id, transaction_id, ctr_filed, ctr_file_date,
                bsae_number, filing_status, transaction_date, transaction_amount,
                customer_name, filing_deadline, days_to_file, filed_on_time
            ) VALUES %s
            """
            
            ctr_values = [
                (
                    c['id'], c['customer_id'], c['transaction_id'], c['ctr_filed'], c['ctr_file_date'],
                    c['bsae_number'], c['filing_status'], c['transaction_date'], c['transaction_amount'],
                    c['customer_name'], c['filing_deadline'], c['days_to_file'], c['filed_on_time']
                ) for c in ctr_filings
            ]
            
            execute_values(cur, ctr_query, ctr_values)
            filed_on_time = len([c for c in ctr_filings if c['filed_on_time']])
            print(f"   ✓ Created {len(ctr_filings)} CTR filings")
            print(f"     - Filed on time: {filed_on_time}/{len(ctr_filings)}")
        
        # Generate SAR filings
        print("🚨 Generating SAR filings...")
        sar_filings = generate_sar_filings(customer_id, transactions)
        
        if sar_filings:
            sar_query = """
            INSERT INTO sar_filings (
                sar_id, customer_id, detection_date, filing_date,
                bsae_number, filing_status, activity_type, narrative,
                total_amount, filing_deadline, days_to_file, filed_on_time
            ) VALUES %s
            """
            
            sar_values = [
                (
                    s['sar_id'], s['customer_id'], s['detection_date'], s['filing_date'],
                    s['bsae_number'], s['filing_status'], s['activity_type'], s['narrative'],
                    s['total_amount'], s['filing_deadline'], s['days_to_file'], s['filed_on_time']
                ) for s in sar_filings
            ]
            
            execute_values(cur, sar_query, sar_values)
            
            # Link transactions to SARs
            sar_tx_query = """
            INSERT INTO sar_transactions (sar_id, transaction_id) VALUES %s
            """
            
            sar_tx_values = [
                (s['sar_id'], tx_id)
                for s in sar_filings
                for tx_id in s['transaction_ids']
            ]
            
            execute_values(cur, sar_tx_query, sar_tx_values)
            
            filed_on_time = len([s for s in sar_filings if s['filed_on_time']])
            print(f"   ✓ Created {len(sar_filings)} SAR filings")
            print(f"     - Filed on time: {filed_on_time}/{len(sar_filings)}")
        
        conn.commit()
        print("✅ Test data seeded successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error seeding data: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Seed Texas fintech compliance test data')
    parser.add_argument('--customer-id', required=True, help='Customer UUID')
    parser.add_argument('--customers', type=int, default=50, help='Number of customer details to generate')
    parser.add_argument('--transactions', type=int, default=100, help='Number of transactions to generate')
    
    args = parser.parse_args()
    
    seed_database(args.customer_id, args.customers, args.transactions)
