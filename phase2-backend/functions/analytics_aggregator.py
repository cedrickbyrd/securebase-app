"""
Analytics Aggregator Lambda - Phase 4
Aggregates customer usage metrics from various AWS services
Triggered by CloudWatch Events (cron schedule)
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
import logging
from typing import Dict, List, Any

# Setup logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# AWS clients
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')
ce_client = boto3.client('ce')  # Cost Explorer
securityhub = boto3.client('securityhub')

# Environment variables
METRICS_TABLE = os.environ.get('METRICS_TABLE', 'securebase-dev-metrics')
CUSTOMERS_TABLE = os.environ.get('CUSTOMERS_TABLE', 'securebase-dev-customers')
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')

# DynamoDB tables
metrics_table = dynamodb.Table(METRICS_TABLE)
customers_table = dynamodb.Table(CUSTOMERS_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Helper to convert Decimal to float/int for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)


def lambda_handler(event, context):
    """
    Main Lambda handler - aggregates metrics for all customers
    Triggered by EventBridge rule (runs every hour)
    """
    try:
        logger.info(f"Starting metrics aggregation for environment: {ENVIRONMENT}")
        
        # Get all customers
        customers = get_all_customers()
        logger.info(f"Found {len(customers)} customers to process")
        
        # Track results
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'customers_processed': 0,
            'metrics_stored': 0,
            'errors': []
        }
        
        # Process each customer
        for customer in customers:
            try:
                customer_id = customer['id']
                logger.info(f"Processing customer: {customer_id}")
                
                # Aggregate metrics
                metrics = aggregate_customer_metrics(customer_id, customer)
                
                # Store in DynamoDB
                store_metrics(customer_id, metrics)
                
                results['customers_processed'] += 1
                results['metrics_stored'] += len(metrics)
                
            except Exception as e:
                error_msg = f"Error processing customer {customer.get('id', 'unknown')}: {str(e)}"
                logger.error(error_msg)
                results['errors'].append(error_msg)
        
        logger.info(f"Aggregation complete: {json.dumps(results, cls=DecimalEncoder)}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(results, cls=DecimalEncoder)
        }
        
    except Exception as e:
        logger.error(f"Aggregation failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def get_all_customers() -> List[Dict[str, Any]]:
    """Retrieve all active customers from DynamoDB"""
    try:
        response = customers_table.scan(
            FilterExpression='attribute_exists(id) AND #status = :active',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':active': 'active'}
        )
        return response.get('Items', [])
    except Exception as e:
        logger.error(f"Error fetching customers: {str(e)}")
        return []


def aggregate_customer_metrics(customer_id: str, customer: Dict) -> List[Dict[str, Any]]:
    """
    Aggregate all metrics for a single customer
    Returns list of metric records to store
    """
    metrics = []
    timestamp = datetime.utcnow()
    
    # 1. API Call Metrics (from CloudWatch)
    api_metrics = get_api_call_metrics(customer_id)
    if api_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'api_calls',
            'value': Decimal(str(api_metrics['total_calls'])),
            'unit': 'Count',
            'service': 'API Gateway',
            'metadata': {
                'success_rate': api_metrics.get('success_rate', 0),
                'avg_latency_ms': api_metrics.get('avg_latency', 0)
            }
        })
    
    # 2. Storage Metrics (S3)
    storage_metrics = get_storage_metrics(customer_id)
    if storage_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'storage_gb',
            'value': Decimal(str(storage_metrics['total_gb'])),
            'unit': 'Gigabytes',
            'service': 'S3',
            'metadata': {
                'object_count': storage_metrics.get('object_count', 0),
                'buckets': storage_metrics.get('buckets', [])
            }
        })
    
    # 3. Compute Metrics (Lambda, EC2 if applicable)
    compute_metrics = get_compute_metrics(customer_id)
    if compute_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'compute_hours',
            'value': Decimal(str(compute_metrics['total_hours'])),
            'unit': 'Hours',
            'service': 'Lambda',
            'metadata': {
                'invocations': compute_metrics.get('invocations', 0),
                'duration_ms': compute_metrics.get('duration_ms', 0)
            }
        })
    
    # 4. Data Transfer Metrics
    transfer_metrics = get_data_transfer_metrics(customer_id)
    if transfer_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'data_transfer_gb',
            'value': Decimal(str(transfer_metrics['total_gb'])),
            'unit': 'Gigabytes',
            'service': 'CloudFront',
            'metadata': {
                'inbound_gb': transfer_metrics.get('inbound', 0),
                'outbound_gb': transfer_metrics.get('outbound', 0)
            }
        })
    
    # 5. Cost Metrics (from Cost Explorer)
    cost_metrics = get_cost_metrics(customer_id, customer)
    if cost_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'daily_cost',
            'value': Decimal(str(cost_metrics['amount'])),
            'unit': 'USD',
            'service': 'CostExplorer',
            'metadata': {
                'breakdown': cost_metrics.get('breakdown', {}),
                'forecast': cost_metrics.get('forecast', 0)
            }
        })
    
    # 6. Security Metrics (from Security Hub)
    security_metrics = get_security_metrics(customer_id, customer)
    if security_metrics:
        metrics.append({
            'customer_id': customer_id,
            'timestamp': timestamp.isoformat(),
            'metric_name': 'security_findings',
            'value': Decimal(str(security_metrics['total_findings'])),
            'unit': 'Count',
            'service': 'SecurityHub',
            'metadata': {
                'critical': security_metrics.get('critical', 0),
                'high': security_metrics.get('high', 0),
                'medium': security_metrics.get('medium', 0),
                'low': security_metrics.get('low', 0)
            }
        })
    
    # 7. Compliance Score
    compliance_score = calculate_compliance_score(security_metrics)
    metrics.append({
        'customer_id': customer_id,
        'timestamp': timestamp.isoformat(),
        'metric_name': 'compliance_score',
        'value': Decimal(str(compliance_score)),
        'unit': 'Percentage',
        'service': 'SecurityHub',
        'metadata': {
            'framework': customer.get('tier', {}).get('framework', 'CIS'),
            'passed_checks': security_metrics.get('passed', 0) if security_metrics else 0,
            'total_checks': security_metrics.get('total', 0) if security_metrics else 0
        }
    })
    
    logger.info(f"Aggregated {len(metrics)} metrics for customer {customer_id}")
    return metrics


def get_api_call_metrics(customer_id: str) -> Dict[str, Any]:
    """Get API Gateway metrics from CloudWatch"""
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        # Query CloudWatch for API Gateway metrics
        # In production, this would query actual API Gateway metrics
        # For now, return simulated data
        return {
            'total_calls': 150,
            'success_rate': 99.5,
            'avg_latency': 250
        }
    except Exception as e:
        logger.error(f"Error getting API metrics: {str(e)}")
        return None


def get_storage_metrics(customer_id: str) -> Dict[str, Any]:
    """Get S3 storage metrics"""
    try:
        # In production, query S3 for customer buckets
        return {
            'total_gb': 25.5,
            'object_count': 1250,
            'buckets': ['reports', 'exports', 'backups']
        }
    except Exception as e:
        logger.error(f"Error getting storage metrics: {str(e)}")
        return None


def get_compute_metrics(customer_id: str) -> Dict[str, Any]:
    """Get Lambda compute metrics"""
    try:
        # In production, query CloudWatch for Lambda metrics
        return {
            'total_hours': 12.3,
            'invocations': 5000,
            'duration_ms': 8800000
        }
    except Exception as e:
        logger.error(f"Error getting compute metrics: {str(e)}")
        return None


def get_data_transfer_metrics(customer_id: str) -> Dict[str, Any]:
    """Get data transfer metrics"""
    try:
        # In production, query CloudWatch for data transfer
        return {
            'total_gb': 89.2,
            'inbound': 20.5,
            'outbound': 68.7
        }
    except Exception as e:
        logger.error(f"Error getting transfer metrics: {str(e)}")
        return None


def get_cost_metrics(customer_id: str, customer: Dict) -> Dict[str, Any]:
    """Get cost metrics from Cost Explorer"""
    try:
        # In production, query AWS Cost Explorer API
        # For now, return simulated data
        return {
            'amount': 245.75,
            'breakdown': {
                'compute': 120.00,
                'storage': 85.50,
                'network': 40.25
            },
            'forecast': 258.00
        }
    except Exception as e:
        logger.error(f"Error getting cost metrics: {str(e)}")
        return None


def get_security_metrics(customer_id: str, customer: Dict) -> Dict[str, Any]:
    """Get security findings from Security Hub"""
    try:
        # In production, query Security Hub
        return {
            'total_findings': 25,
            'critical': 0,
            'high': 2,
            'medium': 8,
            'low': 15,
            'passed': 187,
            'total': 212
        }
    except Exception as e:
        logger.error(f"Error getting security metrics: {str(e)}")
        return None


def calculate_compliance_score(security_metrics: Dict) -> float:
    """Calculate compliance score from security metrics"""
    if not security_metrics:
        return 0.0
    
    passed = security_metrics.get('passed', 0)
    total = security_metrics.get('total', 1)
    
    if total == 0:
        return 0.0
    
    return round((passed / total) * 100, 2)


def store_metrics(customer_id: str, metrics: List[Dict[str, Any]]):
    """Store metrics in DynamoDB"""
    try:
        # Batch write metrics
        with metrics_table.batch_writer() as batch:
            for metric in metrics:
                # Add region for GSI
                metric['region'] = os.environ.get('AWS_REGION', 'us-east-1')
                batch.put_item(Item=metric)
        
        logger.info(f"Stored {len(metrics)} metrics for customer {customer_id}")
    except Exception as e:
        logger.error(f"Error storing metrics: {str(e)}")
        raise
