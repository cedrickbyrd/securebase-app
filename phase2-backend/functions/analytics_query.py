"""
Analytics Query Lambda - Phase 4
Provides API endpoints for querying analytics data
Handles real-time analytics queries with caching and RLS
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
import logging
from typing import Dict, List, Any, Optional
import hashlib

# Setup logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
METRICS_TABLE = os.environ.get('METRICS_TABLE', 'securebase-dev-metrics')
CACHE_TABLE = os.environ.get('CACHE_TABLE', 'securebase-dev-report-cache')
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL_SECONDS', '3600'))  # 1 hour default

# DynamoDB tables
metrics_table = dynamodb.Table(METRICS_TABLE)
cache_table = dynamodb.Table(CACHE_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Helper to convert Decimal to float/int for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        return super(DecimalEncoder, self).default(obj)


def lambda_handler(event, context):
    """
    Main Lambda handler - provides analytics query API
    Endpoints:
    - GET /analytics/usage - Usage metrics
    - GET /analytics/compliance - Compliance metrics
    - GET /analytics/costs - Cost breakdown
    - POST /analytics/reports - Generate custom reports
    """
    try:
        logger.info(f"Event: {json.dumps(event)}")
        
        # Parse request
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        query_params = event.get('queryStringParameters', {}) or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        # Get customer ID from authorizer (JWT)
        customer_id = event.get('requestContext', {}).get('authorizer', {}).get('customerId')
        if not customer_id:
            return error_response('Unauthorized - No customer ID', 401)
        
        logger.info(f"Request from customer {customer_id}: {http_method} {path}")
        
        # Route to appropriate handler
        if http_method == 'GET':
            if '/analytics/usage' in path:
                return handle_usage_query(customer_id, query_params)
            elif '/analytics/compliance' in path:
                return handle_compliance_query(customer_id, query_params)
            elif '/analytics/costs' in path:
                return handle_costs_query(customer_id, query_params)
            else:
                return error_response('Endpoint not found', 404)
        
        elif http_method == 'POST':
            if '/analytics/reports' in path:
                return handle_custom_report(customer_id, body)
            else:
                return error_response('Endpoint not found', 404)
        
        else:
            return error_response('Method not allowed', 405)
        
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        return error_response(str(e), 500)


def handle_usage_query(customer_id: str, params: Dict) -> Dict:
    """
    GET /analytics/usage
    Returns usage metrics (API calls, storage, compute, data transfer)
    Query params: period (default: 30d)
    """
    try:
        period = params.get('period', '30d')
        
        # Check cache first
        cache_key = generate_cache_key(customer_id, 'usage', period)
        cached = get_from_cache(cache_key)
        if cached:
            logger.info(f"Cache hit for {cache_key}")
            return success_response(cached)
        
        # Query metrics
        days = parse_period(period)
        metrics = query_metrics(customer_id, days)
        
        # Aggregate usage metrics
        usage_data = {
            'customer_id': customer_id,
            'period': period,
            'metrics': {
                'api_calls': sum_metric(metrics, 'api_calls'),
                'storage_gb': sum_metric(metrics, 'storage_gb'),
                'compute_hours': sum_metric(metrics, 'compute_hours'),
                'data_transfer_gb': sum_metric(metrics, 'data_transfer_gb')
            },
            'trends': {
                'api_calls_change': calculate_change(metrics, 'api_calls', days),
                'storage_change': calculate_change(metrics, 'storage_gb', days)
            },
            'generated_at': datetime.utcnow().isoformat()
        }
        
        # Cache result
        store_in_cache(cache_key, usage_data)
        
        return success_response(usage_data)
        
    except Exception as e:
        logger.error(f"Usage query failed: {str(e)}")
        return error_response(str(e), 500)


def handle_compliance_query(customer_id: str, params: Dict) -> Dict:
    """
    GET /analytics/compliance
    Returns compliance score and findings
    """
    try:
        # Check cache
        cache_key = generate_cache_key(customer_id, 'compliance', '')
        cached = get_from_cache(cache_key)
        if cached:
            logger.info(f"Cache hit for {cache_key}")
            return success_response(cached)
        
        # Query metrics
        metrics = query_metrics(customer_id, 30)  # Last 30 days
        
        # Get latest compliance metrics
        compliance_metrics = [m for m in metrics if m.get('metric_name') == 'compliance_score']
        security_metrics = [m for m in metrics if m.get('metric_name') == 'security_findings']
        
        latest_score = 0
        findings = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        if compliance_metrics:
            latest_score = float(compliance_metrics[-1].get('value', 0))
        
        if security_metrics:
            latest_security = security_metrics[-1]
            metadata = latest_security.get('metadata', {})
            findings = {
                'critical': metadata.get('critical', 0),
                'high': metadata.get('high', 0),
                'medium': metadata.get('medium', 0),
                'low': metadata.get('low', 0)
            }
        
        # Calculate trend
        if len(compliance_metrics) >= 2:
            previous_score = float(compliance_metrics[0].get('value', 0))
            score_change = latest_score - previous_score
            trend = f"+{score_change:.1f} from last month" if score_change > 0 else f"{score_change:.1f} from last month"
        else:
            trend = "Insufficient data"
        
        # Top issues (mocked - in production, query from Security Hub)
        top_issues = [
            "S3 bucket encryption not enabled",
            "CloudTrail logging gaps"
        ] if findings['high'] > 0 or findings['medium'] > 0 else []
        
        compliance_data = {
            'customer_id': customer_id,
            'current_score': int(latest_score),
            'trend': trend,
            'findings': findings,
            'top_issues': top_issues,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        # Cache result
        store_in_cache(cache_key, compliance_data)
        
        return success_response(compliance_data)
        
    except Exception as e:
        logger.error(f"Compliance query failed: {str(e)}")
        return error_response(str(e), 500)


def handle_costs_query(customer_id: str, params: Dict) -> Dict:
    """
    GET /analytics/costs
    Returns cost breakdown and forecast
    Query params: period (default: 30d), breakdown (default: service)
    """
    try:
        period = params.get('period', '30d')
        breakdown_by = params.get('breakdown', 'service')
        
        # Check cache
        cache_key = generate_cache_key(customer_id, f'costs_{breakdown_by}', period)
        cached = get_from_cache(cache_key)
        if cached:
            logger.info(f"Cache hit for {cache_key}")
            return success_response(cached)
        
        # Query metrics
        days = parse_period(period)
        metrics = query_metrics(customer_id, days)
        
        # Get cost metrics
        cost_metrics = [m for m in metrics if m.get('metric_name') == 'daily_cost']
        
        total_cost = sum(float(m.get('value', 0)) for m in cost_metrics)
        
        # Aggregate breakdown
        breakdown = {'compute': 0, 'storage': 0, 'networking': 0}
        for metric in cost_metrics:
            metadata = metric.get('metadata', {})
            breakdown_data = metadata.get('breakdown', {})
            for service, amount in breakdown_data.items():
                if service in breakdown:
                    breakdown[service] += amount
        
        # Calculate forecast (simple extrapolation)
        avg_daily_cost = total_cost / max(days, 1)
        forecast_next_month = avg_daily_cost * 30
        
        cost_data = {
            'customer_id': customer_id,
            'period': period,
            'total': round(total_cost, 2),
            'breakdown': {k: round(v, 2) for k, v in breakdown.items()},
            'forecast_next_month': round(forecast_next_month, 2),
            'generated_at': datetime.utcnow().isoformat()
        }
        
        # Cache result
        store_in_cache(cache_key, cost_data)
        
        return success_response(cost_data)
        
    except Exception as e:
        logger.error(f"Cost query failed: {str(e)}")
        return error_response(str(e), 500)


def handle_custom_report(customer_id: str, body: Dict) -> Dict:
    """
    POST /analytics/reports
    Generate custom report with specified parameters
    Body: { type: 'monthly', customer_id: 'xxx', fields: [], filters: {} }
    """
    try:
        report_type = body.get('type', 'custom')
        fields = body.get('fields', [])
        filters = body.get('filters', {})
        
        logger.info(f"Custom report request: type={report_type}, fields={fields}")
        
        # Query based on filters
        days = parse_period(filters.get('period', '30d'))
        metrics = query_metrics(customer_id, days)
        
        # Filter metrics by requested fields
        if fields:
            metrics = [m for m in metrics if m.get('metric_name') in fields]
        
        # Build custom report
        report_data = {
            'customer_id': customer_id,
            'type': report_type,
            'fields': fields,
            'filters': filters,
            'data': process_metrics(metrics),
            'summary': generate_summary(metrics),
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return success_response(report_data)
        
    except Exception as e:
        logger.error(f"Custom report failed: {str(e)}")
        return error_response(str(e), 500)


def query_metrics(customer_id: str, days: int) -> List[Dict]:
    """Query metrics from DynamoDB for specified period"""
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        response = metrics_table.query(
            KeyConditionExpression='customer_id = :cid AND #ts BETWEEN :start AND :end',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':cid': customer_id,
                ':start': start_time.isoformat(),
                ':end': end_time.isoformat()
            }
        )
        
        metrics = response.get('Items', [])
        logger.info(f"Queried {len(metrics)} metrics for customer {customer_id}")
        
        return metrics
        
    except Exception as e:
        logger.error(f"Metrics query failed: {str(e)}")
        return []


def sum_metric(metrics: List[Dict], metric_name: str) -> float:
    """Sum all values for a specific metric"""
    total = sum(
        float(m.get('value', 0))
        for m in metrics
        if m.get('metric_name') == metric_name
    )
    return round(total, 2)


def calculate_change(metrics: List[Dict], metric_name: str, days: int) -> str:
    """Calculate percentage change over period"""
    metric_values = [
        (m.get('timestamp'), float(m.get('value', 0)))
        for m in metrics
        if m.get('metric_name') == metric_name
    ]
    
    if len(metric_values) < 2:
        return 'N/A'
    
    # Sort by timestamp
    metric_values.sort(key=lambda x: x[0])
    
    # Compare first half vs second half
    mid_point = len(metric_values) // 2
    first_half_avg = sum(v[1] for v in metric_values[:mid_point]) / mid_point
    second_half_avg = sum(v[1] for v in metric_values[mid_point:]) / (len(metric_values) - mid_point)
    
    if first_half_avg == 0:
        return '+100%' if second_half_avg > 0 else 'N/A'
    
    change_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
    return f"+{change_pct:.0f}%" if change_pct > 0 else f"{change_pct:.0f}%"


def process_metrics(metrics: List[Dict]) -> List[Dict]:
    """Process metrics for report output"""
    processed = []
    
    for metric in metrics:
        processed.append({
            'name': metric.get('metric_name', 'unknown'),
            'value': float(metric.get('value', 0)),
            'unit': metric.get('unit', ''),
            'service': metric.get('service', ''),
            'timestamp': metric.get('timestamp', '')
        })
    
    return processed


def generate_summary(metrics: List[Dict]) -> Dict[str, Any]:
    """Generate summary statistics from metrics"""
    summary = {
        'total_metrics': len(metrics),
        'metric_types': len(set(m.get('metric_name') for m in metrics)),
        'date_range': {
            'start': min((m.get('timestamp') for m in metrics), default='N/A'),
            'end': max((m.get('timestamp') for m in metrics), default='N/A')
        }
    }
    
    return summary


def parse_period(period: str) -> int:
    """Parse period string into days"""
    period = period.lower().strip()
    
    if period.endswith('d'):
        return int(period[:-1])
    elif period.endswith('w'):
        return int(period[:-1]) * 7
    elif period.endswith('m'):
        return int(period[:-1]) * 30
    else:
        return 30


def generate_cache_key(customer_id: str, query_type: str, params: str) -> str:
    """Generate cache key for query"""
    key_string = f"{customer_id}:{query_type}:{params}"
    return hashlib.md5(key_string.encode()).hexdigest()


def get_from_cache(cache_key: str) -> Optional[Dict]:
    """Retrieve cached result if not expired"""
    try:
        response = cache_table.get_item(Key={'cache_key': cache_key})
        item = response.get('Item')
        
        if not item:
            return None
        
        # Check if expired
        expires_at = item.get('expires_at')
        if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
            logger.info(f"Cache expired for {cache_key}")
            return None
        
        return item.get('data')
        
    except Exception as e:
        logger.error(f"Cache retrieval failed: {str(e)}")
        return None


def store_in_cache(cache_key: str, data: Dict):
    """Store query result in cache"""
    try:
        expires_at = datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS)
        
        cache_table.put_item(
            Item={
                'cache_key': cache_key,
                'data': data,
                'created_at': datetime.utcnow().isoformat(),
                'expires_at': expires_at.isoformat()
            }
        )
        
        logger.info(f"Cached result for {cache_key}")
        
    except Exception as e:
        logger.error(f"Cache storage failed: {str(e)}")


def success_response(data: Dict) -> Dict:
    """Generate success response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps(data, cls=DecimalEncoder)
    }


def error_response(message: str, status_code: int = 400) -> Dict:
    """Generate error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': message})
    }
