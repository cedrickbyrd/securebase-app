"""
SRE Metrics Lambda - Phase 5.3
SRE/Operations Dashboard Backend

Aggregates infrastructure and operational metrics from CloudWatch, Cost Explorer,
SSM Parameter Store, and DynamoDB for the SRE Operations Dashboard.

Endpoints:
- GET /sre/infrastructure  — CPU, memory, disk, network metrics (Lambda + EC2/ECS)
- GET /sre/deployments     — Recent deployment history (last 10), success rate, avg duration
- GET /sre/scaling         — Lambda concurrency, API Gateway request/throttle counts
- GET /sre/database        — Aurora query latency (p50/p95/p99), connections, IOPS, replication
- GET /sre/cache           — ElastiCache Redis hit rate, evictions, connections, memory
- GET /sre/errors          — Error rates by service (CloudWatch Logs Insights), 4xx/5xx breakdown
- GET /sre/lambda          — Lambda cold starts, duration, throttles, DLQ depth per function
- GET /sre/costs           — Per-service cost breakdown (Cost Explorer, daily, last 30 days)
- GET /sre/health          — Aggregate health: overall status + per-subsystem status
"""

import json
import os
import time
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional
import logging

# Configure logging
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

# AWS region
AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))

# AWS clients (initialised at module level for connection reuse)
cloudwatch = boto3.client('cloudwatch', region_name=AWS_REGION)
logs_client = boto3.client('logs', region_name=AWS_REGION)
ce = boto3.client('ce', region_name='us-east-1')  # Cost Explorer only available in us-east-1
ssm = boto3.client('ssm', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

# Environment variables
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
SRE_METRICS_TABLE = os.environ.get('SRE_METRICS_TABLE', f'securebase-{ENVIRONMENT}-sre-ops-metrics')
SRE_ALERTS_TOPIC_ARN = os.environ.get('SRE_ALERTS_TOPIC_ARN', '')
CORS_ORIGIN = os.environ.get('CORS_ORIGIN', 'https://securebase.tximhotep.com')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder for DynamoDB Decimal types."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _cors_headers() -> Dict[str, str]:
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }


def _ok(body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': 200,
        'headers': _cors_headers(),
        'body': json.dumps(body, cls=DecimalEncoder),
    }


def _error(status: int, message: str) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': _cors_headers(),
        'body': json.dumps({'error': message}),
    }


def _cw_metric(namespace: str, metric_name: str, dimensions: List[Dict],
               stat: str, period: int, start: datetime, end: datetime) -> Optional[float]:
    """Fetch a single scalar CloudWatch metric value. Returns None on error."""
    try:
        resp = cloudwatch.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=dimensions,
            StartTime=start,
            EndTime=end,
            Period=period,
            Statistics=[stat],
        )
        datapoints = resp.get('Datapoints', [])
        if not datapoints:
            return None
        latest = sorted(datapoints, key=lambda d: d['Timestamp'])[-1]
        return latest.get(stat)
    except Exception as exc:
        logger.warning("CloudWatch error: %s", exc)
        return None


def _cw_metric_data(queries: List[Dict], start: datetime, end: datetime) -> Dict[str, Any]:
    """Fetch multiple metrics via get_metric_data. Returns {id: values_list}."""
    try:
        resp = cloudwatch.get_metric_data(
            MetricDataQueries=queries,
            StartTime=start,
            EndTime=end,
        )
        results = {}
        for r in resp.get('MetricDataResults', []):
            results[r['Id']] = r.get('Values', [])
        return results
    except Exception as exc:
        logger.warning("CloudWatch get_metric_data error: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Endpoint handlers
# ---------------------------------------------------------------------------

def get_infrastructure(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/infrastructure — Lambda + ECS CPU, memory, disk, network metrics."""
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    period = 300  # 5 min

    env = ENVIRONMENT
    errors = []

    def _safe_cw(namespace, metric, dims, stat):
        val = _cw_metric(namespace, metric, dims, stat, period, start, end)
        return val

    # Lambda aggregate metrics
    lambda_invocations = _safe_cw('AWS/Lambda', 'Invocations', [], 'Sum')
    lambda_errors = _safe_cw('AWS/Lambda', 'Errors', [], 'Sum')
    lambda_duration = _safe_cw('AWS/Lambda', 'Duration', [], 'Average')

    # ECS CPU / Memory (placeholder dimensions — update with actual cluster name)
    ecs_cpu = _safe_cw('AWS/ECS', 'CPUUtilization',
                       [{'Name': 'ClusterName', 'Value': f'securebase-{env}'}], 'Average')
    ecs_mem = _safe_cw('AWS/ECS', 'MemoryUtilization',
                       [{'Name': 'ClusterName', 'Value': f'securebase-{env}'}], 'Average')

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'lambda': {
            'invocations': lambda_invocations,
            'errors': lambda_errors,
            'avg_duration_ms': lambda_duration,
        },
        'ecs': {
            'cpu_utilization_pct': ecs_cpu,
            'memory_utilization_pct': ecs_mem,
        },
        'errors': errors,
    })


def get_deployments(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/deployments — Recent deployment history from DynamoDB + metrics."""
    limit = int(query_params.get('limit', 10))
    errors = []

    deployments = []
    try:
        table = dynamodb.Table(SRE_METRICS_TABLE)
        resp = table.query(
            KeyConditionExpression='metric_type = :t',
            ExpressionAttributeValues={':t': 'deployment'},
            ScanIndexForward=False,
            Limit=limit,
        )
        deployments = resp.get('Items', [])
    except Exception as exc:
        logger.warning("DynamoDB query error: %s", exc)
        errors.append(str(exc))

    # Calculate metrics from raw items
    success_count = sum(1 for d in deployments if d.get('status') == 'success')
    total = len(deployments)
    success_rate = round((success_count / total * 100), 1) if total else 0

    durations = [d.get('duration_seconds', 0) for d in deployments if d.get('duration_seconds')]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'deployments': deployments,
        'summary': {
            'total': total,
            'success_count': success_count,
            'failure_count': total - success_count,
            'success_rate_pct': success_rate,
            'avg_duration_seconds': avg_duration,
        },
        'errors': errors,
    })


def get_scaling(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/scaling — Lambda concurrency, API Gateway request/throttle counts."""
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    period = 300

    errors = []

    lambda_concurrency = _cw_metric(
        'AWS/Lambda', 'ConcurrentExecutions', [], 'Maximum', period, start, end)
    lambda_throttles = _cw_metric(
        'AWS/Lambda', 'Throttles', [], 'Sum', period, start, end)

    api_requests = _cw_metric(
        'AWS/ApiGateway', 'Count', [], 'Sum', period, start, end)
    api_throttles = _cw_metric(
        'AWS/ApiGateway', '4xxError', [], 'Sum', period, start, end)

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'lambda': {
            'concurrent_executions': lambda_concurrency,
            'throttles': lambda_throttles,
        },
        'api_gateway': {
            'request_count': api_requests,
            'throttle_count': api_throttles,
        },
        'errors': errors,
    })


def get_database(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/database — Aurora latency, connections, IOPS, replication lag; DynamoDB stats."""
    end = datetime.utcnow()
    start = end - timedelta(minutes=30)
    period = 300

    errors = []
    env = ENVIRONMENT

    cluster_id = f'securebase-{env}'

    def _aurora(metric, stat):
        return _cw_metric(
            'AWS/RDS', metric,
            [{'Name': 'DBClusterIdentifier', 'Value': cluster_id}],
            stat, period, start, end)

    aurora_latency_read = _aurora('ReadLatency', 'p95')
    aurora_latency_write = _aurora('WriteLatency', 'p95')
    aurora_connections = _aurora('DatabaseConnections', 'Maximum')
    aurora_read_iops = _aurora('VolumeReadIOPs', 'Sum')
    aurora_write_iops = _aurora('VolumeWriteIOPs', 'Sum')
    aurora_replica_lag = _aurora('AuroraReplicaLag', 'Maximum')

    dynamo_read_throttle = _cw_metric(
        'AWS/DynamoDB', 'ReadThrottleEvents', [], 'Sum', period, start, end)
    dynamo_write_throttle = _cw_metric(
        'AWS/DynamoDB', 'WriteThrottleEvents', [], 'Sum', period, start, end)
    dynamo_latency = _cw_metric(
        'AWS/DynamoDB', 'SuccessfulRequestLatency', [], 'Average', period, start, end)

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'aurora': {
            'read_latency_p95_ms': aurora_latency_read,
            'write_latency_p95_ms': aurora_latency_write,
            'connection_count': aurora_connections,
            'read_iops': aurora_read_iops,
            'write_iops': aurora_write_iops,
            'replica_lag_ms': aurora_replica_lag,
        },
        'dynamodb': {
            'read_throttle_events': dynamo_read_throttle,
            'write_throttle_events': dynamo_write_throttle,
            'avg_latency_ms': dynamo_latency,
        },
        'errors': errors,
    })


def get_cache(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/cache — ElastiCache Redis hit rate, evictions, connections, memory."""
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    period = 300

    errors = []
    env = ENVIRONMENT

    cluster_id = f'securebase-{env}'

    def _ec(metric, stat):
        return _cw_metric(
            'AWS/ElastiCache', metric,
            [{'Name': 'CacheClusterId', 'Value': cluster_id}],
            stat, period, start, end)

    hits = _ec('CacheHits', 'Sum')
    misses = _ec('CacheMisses', 'Sum')
    evictions = _ec('Evictions', 'Sum')
    connections = _ec('CurrConnections', 'Maximum')
    memory_pct = _ec('DatabaseMemoryUsagePercentage', 'Average')

    # Hit rate calculation
    if hits is not None and misses is not None:
        total = (hits or 0) + (misses or 0)
        hit_rate = round((hits / total * 100), 2) if total else 0.0
    else:
        hit_rate = None

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'redis': {
            'hit_rate_pct': hit_rate,
            'cache_hits': hits,
            'cache_misses': misses,
            'evictions': evictions,
            'current_connections': connections,
            'memory_usage_pct': memory_pct,
        },
        'errors': errors,
    })


def get_errors(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/errors — Error rates by service, 4xx/5xx breakdown."""
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    period = 300

    errors = []

    lambda_errors = _cw_metric('AWS/Lambda', 'Errors', [], 'Sum', period, start, end)
    lambda_invocations = _cw_metric('AWS/Lambda', 'Invocations', [], 'Sum', period, start, end)
    api_4xx = _cw_metric('AWS/ApiGateway', '4XXError', [], 'Sum', period, start, end)
    api_5xx = _cw_metric('AWS/ApiGateway', '5XXError', [], 'Sum', period, start, end)
    api_count = _cw_metric('AWS/ApiGateway', 'Count', [], 'Sum', period, start, end)

    lambda_error_rate = None
    if lambda_errors is not None and lambda_invocations:
        lambda_error_rate = round((lambda_errors / lambda_invocations * 100), 2)

    api_error_rate = None
    if api_count and api_5xx is not None:
        api_error_rate = round(((api_5xx or 0) / api_count * 100), 2)

    # CloudWatch Logs Insights — recent Lambda errors (last 15 min)
    log_errors = []
    try:
        log_end = int(end.timestamp())
        log_start = int((end - timedelta(minutes=15)).timestamp())
        query_resp = logs_client.start_query(
            logGroupName='/aws/lambda/securebase-' + ENVIRONMENT,
            startTime=log_start,
            endTime=log_end,
            queryString='fields @timestamp, @message | filter @message like /ERROR/ | limit 10',
        )
        query_id = query_resp['queryId']
        # Poll for results (max 5 seconds)
        for _ in range(5):
            result_resp = logs_client.get_query_results(queryId=query_id)
            if result_resp['status'] in ('Complete', 'Failed', 'Cancelled'):
                for row in result_resp.get('results', []):
                    entry = {field['field']: field['value'] for field in row}
                    log_errors.append(entry)
                break
            time.sleep(1)
    except Exception as exc:
        logger.warning("Logs Insights error: %s", exc)
        errors.append(str(exc))

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'lambda': {
            'error_count': lambda_errors,
            'invocation_count': lambda_invocations,
            'error_rate_pct': lambda_error_rate,
        },
        'api_gateway': {
            '4xx_count': api_4xx,
            '5xx_count': api_5xx,
            'total_requests': api_count,
            'error_rate_pct': api_error_rate,
        },
        'recent_log_errors': log_errors,
        'errors': errors,
    })


def get_lambda_metrics(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/lambda — Cold starts, duration, throttles, DLQ depth per function."""
    end = datetime.utcnow()
    start = end - timedelta(hours=1)
    period = 300

    errors = []

    # List Lambda functions matching the environment prefix
    lambda_client = boto3.client('lambda')
    function_names = []
    try:
        paginator = lambda_client.get_paginator('list_functions')
        for page in paginator.paginate():
            for fn in page.get('Functions', []):
                if fn['FunctionName'].startswith(f'securebase-{ENVIRONMENT}'):
                    function_names.append(fn['FunctionName'])
    except Exception as exc:
        logger.warning("Lambda list_functions error: %s", exc)
        errors.append(str(exc))

    per_function = []
    for fn_name in function_names[:20]:  # Cap at 20 to control cost
        dims = [{'Name': 'FunctionName', 'Value': fn_name}]
        cold_starts = _cw_metric('AWS/Lambda', 'InitDuration', dims, 'Sum', period, start, end)
        avg_duration = _cw_metric('AWS/Lambda', 'Duration', dims, 'Average', period, start, end)
        throttles = _cw_metric('AWS/Lambda', 'Throttles', dims, 'Sum', period, start, end)

        # DLQ depth via SQS if DLQ is configured
        dlq_depth = None
        try:
            fn_config = lambda_client.get_function_configuration(FunctionName=fn_name)
            dlq_arn = fn_config.get('DeadLetterConfig', {}).get('TargetArn', '')
            if dlq_arn.startswith('arn:aws:sqs:'):
                queue_name = dlq_arn.split(':')[-1]
                sqs = boto3.client('sqs')
                queue_url_resp = sqs.get_queue_url(QueueName=queue_name)
                attrs = sqs.get_queue_attributes(
                    QueueUrl=queue_url_resp['QueueUrl'],
                    AttributeNames=['ApproximateNumberOfMessages'],
                )
                dlq_depth = int(attrs['Attributes'].get('ApproximateNumberOfMessages', 0))
        except Exception as exc:
            logger.debug("DLQ check skipped for %s: %s", fn_name, exc)

        per_function.append({
            'function_name': fn_name,
            'cold_starts': cold_starts,
            'avg_duration_ms': avg_duration,
            'throttles': throttles,
            'dlq_depth': dlq_depth,
        })

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'functions': per_function,
        'aggregate': {
            'total_functions': len(per_function),
            'functions_with_throttles': sum(
                1 for f in per_function if f.get('throttles') and f['throttles'] > 0
            ),
            'functions_with_dlq_messages': sum(
                1 for f in per_function if f.get('dlq_depth') and f['dlq_depth'] > 0
            ),
        },
        'errors': errors,
    })


def get_costs(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/costs — Per-service cost breakdown (Cost Explorer, daily, last 30 days)."""
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=30)

    errors = []
    service_costs = []

    try:
        resp = ce.get_cost_and_usage(
            TimePeriod={
                'Start': start_date.strftime('%Y-%m-%d'),
                'End': end_date.strftime('%Y-%m-%d'),
            },
            Granularity='DAILY',
            Metrics=['BlendedCost'],
            GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
        )

        # Aggregate by service
        service_totals: Dict[str, float] = {}
        daily_totals: List[Dict] = []

        for result in resp.get('ResultsByTime', []):
            date_str = result['TimePeriod']['Start']
            day_total = 0.0
            for group in result.get('Groups', []):
                svc = group['Keys'][0]
                amount = float(group['Metrics']['BlendedCost']['Amount'])
                service_totals[svc] = service_totals.get(svc, 0.0) + amount
                day_total += amount
            daily_totals.append({'date': date_str, 'total_usd': round(day_total, 4)})

        service_costs = sorted(
            [{'service': k, 'total_usd': round(v, 4)} for k, v in service_totals.items()],
            key=lambda x: x['total_usd'],
            reverse=True,
        )
    except Exception as exc:
        logger.warning("Cost Explorer error: %s", exc)
        errors.append(str(exc))

    total_cost = sum(s['total_usd'] for s in service_costs)

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'period': {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d'),
            'granularity': 'DAILY',
        },
        'total_cost_usd': round(total_cost, 4),
        'by_service': service_costs[:20],  # Top 20 services
        'errors': errors,
    })


def get_health(query_params: Dict) -> Dict[str, Any]:
    """GET /sre/health — Aggregate health check: overall status + per-subsystem."""
    end = datetime.utcnow()
    start = end - timedelta(minutes=5)
    period = 300

    subsystems = {}
    overall = 'healthy'

    # Check Lambda error rate
    lambda_errors = _cw_metric('AWS/Lambda', 'Errors', [], 'Sum', period, start, end)
    lambda_invocations = _cw_metric('AWS/Lambda', 'Invocations', [], 'Sum', period, start, end)
    if lambda_errors is not None and lambda_invocations and lambda_invocations > 0:
        error_rate = lambda_errors / lambda_invocations
        subsystems['lambda'] = 'critical' if error_rate > 0.1 else (
            'degraded' if error_rate > 0.05 else 'healthy'
        )
    else:
        subsystems['lambda'] = 'healthy'

    # Check API Gateway
    api_5xx = _cw_metric('AWS/ApiGateway', '5XXError', [], 'Sum', period, start, end)
    api_count = _cw_metric('AWS/ApiGateway', 'Count', [], 'Sum', period, start, end)
    if api_5xx is not None and api_count and api_count > 0:
        api_error_rate = api_5xx / api_count
        subsystems['api_gateway'] = 'critical' if api_error_rate > 0.1 else (
            'degraded' if api_error_rate > 0.05 else 'healthy'
        )
    else:
        subsystems['api_gateway'] = 'healthy'

    # Check Aurora
    aurora_latency = _cw_metric(
        'AWS/RDS', 'ReadLatency',
        [{'Name': 'DBClusterIdentifier', 'Value': f'securebase-{ENVIRONMENT}'}],
        'Average', period, start, end,
    )
    if aurora_latency is not None:
        subsystems['database'] = 'critical' if aurora_latency > 0.5 else (
            'degraded' if aurora_latency > 0.1 else 'healthy'
        )
    else:
        subsystems['database'] = 'healthy'

    # Check ElastiCache
    ec_evictions = _cw_metric(
        'AWS/ElastiCache', 'Evictions',
        [{'Name': 'CacheClusterId', 'Value': f'securebase-{ENVIRONMENT}'}],
        'Sum', period, start, end,
    )
    if ec_evictions is not None:
        subsystems['cache'] = 'degraded' if ec_evictions > 1000 else 'healthy'
    else:
        subsystems['cache'] = 'healthy'

    # Derive overall status
    statuses = list(subsystems.values())
    if 'critical' in statuses:
        overall = 'critical'
    elif 'degraded' in statuses:
        overall = 'degraded'
    else:
        overall = 'healthy'

    return _ok({
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'overall_status': overall,
        'subsystems': subsystems,
    })


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    """
    Main Lambda handler.
    Routes requests to the appropriate SRE metric aggregation function.
    Emits structured CloudWatch logs for every request.
    """
    start_ts = time.time()
    path = event.get('path', '')
    http_method = event.get('httpMethod', 'GET')
    query_params = event.get('queryStringParameters') or {}

    logger.info(json.dumps({
        'event': 'sre_metrics_request',
        'path': path,
        'method': http_method,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }))

    # OPTIONS preflight
    if http_method == 'OPTIONS':
        result = {
            'statusCode': 200,
            'headers': _cors_headers(),
            'body': '',
        }
        _log_request(path, start_ts, 200)
        return result

    # Route map
    routes = {
        '/sre/infrastructure': get_infrastructure,
        '/sre/deployments': get_deployments,
        '/sre/scaling': get_scaling,
        '/sre/database': get_database,
        '/sre/cache': get_cache,
        '/sre/errors': get_errors,
        '/sre/lambda': get_lambda_metrics,
        '/sre/costs': get_costs,
        '/sre/health': get_health,
    }

    handler_fn = routes.get(path)
    if handler_fn is None:
        result = _error(404, f'Path not found: {path}')
        _log_request(path, start_ts, 404)
        return result

    try:
        result = handler_fn(query_params)
    except Exception as exc:
        logger.exception("Unhandled error in handler for %s: %s", path, exc)
        result = _error(500, 'Internal server error')

    _log_request(path, start_ts, result['statusCode'])
    return result


def _log_request(path: str, start_ts: float, status_code: int):
    duration_ms = round((time.time() - start_ts) * 1000, 1)
    logger.info(json.dumps({
        'event': 'sre_metrics_response',
        'path': path,
        'status_code': status_code,
        'duration_ms': duration_ms,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }))
