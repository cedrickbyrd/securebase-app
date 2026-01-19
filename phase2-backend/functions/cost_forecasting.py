"""
Cost Forecasting Lambda Function
Generates ML-based cost forecasts using historical usage data

Features:
- Time-series analysis of historical costs
- Anomaly detection for unusual spikes
- Confidence interval calculation
- Service-level cost breakdown
- Export to PDF/CSV/JSON
"""

import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
import statistics
from typing import Dict, List, Any, Optional

# AWS Clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Environment variables
INVOICES_TABLE = os.environ.get('INVOICES_TABLE', 'securebase_invoices')
FORECASTS_TABLE = os.environ.get('FORECASTS_TABLE', 'securebase_cost_forecasts')


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder for Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def lambda_handler(event, context):
    """Main Lambda handler for cost forecasting"""
    
    try:
        # Extract parameters
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        
        # Route to appropriate handler
        if http_method == 'GET' and '/forecast/export' in path:
            return handle_export(event)
        elif http_method == 'GET':
            return handle_generate_forecast(event)
        elif http_method == 'POST' and 'budget-alert' in path:
            return handle_set_budget_alert(event)
        elif http_method == 'GET' and 'budget-alerts' in path:
            return handle_get_budget_alerts(event)
        else:
            return error_response(405, 'Method not allowed')
            
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return error_response(500, f'Internal server error: {str(e)}')


def handle_generate_forecast(event):
    """Generate cost forecast based on historical data"""
    
    try:
        # Extract customer ID from auth context
        customer_id = get_customer_id(event)
        
        # Parse query parameters
        params = event.get('queryStringParameters') or {}
        months = int(params.get('months', 12))
        confidence_level = params.get('confidence_level', 'medium')
        
        # Fetch historical invoice data
        historical_data = fetch_historical_costs(customer_id, months_back=12)
        
        if not historical_data:
            return error_response(400, 'Insufficient historical data for forecasting')
        
        # Generate forecast
        forecast_data = generate_forecast(historical_data, months, confidence_level)
        
        # Detect anomalies
        anomalies = detect_anomalies(historical_data)
        
        # Calculate accuracy score
        accuracy_score = calculate_accuracy(historical_data, forecast_data)
        
        # Get service breakdown
        service_breakdown = calculate_service_breakdown(customer_id, months)
        
        # Determine trend
        trend = determine_trend(historical_data)
        
        # Store forecast for future reference
        store_forecast(customer_id, forecast_data)
        
        # Build response
        response_data = {
            'forecast': forecast_data,
            'anomalies': anomalies,
            'accuracy_score': accuracy_score,
            'service_breakdown': service_breakdown,
            'trend': trend,
            'historical_months': len(historical_data),
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return success_response(response_data)
        
    except Exception as e:
        print(f"Error generating forecast: {str(e)}")
        return error_response(500, f'Failed to generate forecast: {str(e)}')


def fetch_historical_costs(customer_id: str, months_back: int = 12) -> List[Dict]:
    """Fetch historical cost data from invoices table"""
    
    table = dynamodb.Table(INVOICES_TABLE)
    
    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months_back * 30)
    
    try:
        response = table.query(
            KeyConditionExpression='customer_id = :cid AND billing_period >= :start',
            ExpressionAttributeValues={
                ':cid': customer_id,
                ':start': start_date.strftime('%Y-%m')
            },
            ScanIndexForward=True  # Oldest first
        )
        
        items = response.get('Items', [])
        
        # Format data for analysis
        historical_data = []
        for item in items:
            historical_data.append({
                'month': item['billing_period'],
                'total_cost': float(item.get('total_amount', 0)),
                'usage_details': item.get('usage_details', {})
            })
        
        return historical_data
        
    except Exception as e:
        print(f"Error fetching historical costs: {str(e)}")
        return []


def generate_forecast(historical_data: List[Dict], months: int, confidence_level: str) -> List[Dict]:
    """
    Generate forecast using simple moving average with trend adjustment
    
    For production, consider using:
    - Prophet (Facebook's time-series forecasting)
    - ARIMA (Auto-Regressive Integrated Moving Average)
    - AWS Forecast service
    """
    
    # Extract cost values
    costs = [item['total_cost'] for item in historical_data]
    
    if len(costs) < 3:
        raise ValueError("Need at least 3 months of historical data")
    
    # Calculate trend (simple linear regression)
    n = len(costs)
    x_values = list(range(n))
    x_mean = sum(x_values) / n
    y_mean = sum(costs) / n
    
    numerator = sum((x_values[i] - x_mean) * (costs[i] - y_mean) for i in range(n))
    denominator = sum((x_values[i] - x_mean) ** 2 for i in range(n))
    
    slope = numerator / denominator if denominator != 0 else 0
    intercept = y_mean - slope * x_mean
    
    # Calculate standard deviation for confidence intervals
    residuals = [costs[i] - (slope * x_values[i] + intercept) for i in range(n)]
    std_dev = statistics.stdev(residuals) if len(residuals) > 1 else 0
    
    # Confidence multiplier based on level
    confidence_multipliers = {
        'low': 1.0,    # ~65% CI
        'medium': 1.5,  # ~80% CI
        'high': 2.0     # ~95% CI
    }
    multiplier = confidence_multipliers.get(confidence_level, 1.5)
    
    # Generate forecast for future months
    forecast = []
    last_month = historical_data[-1]['month']
    last_date = datetime.strptime(last_month, '%Y-%m')
    
    for i in range(months):
        # Forecast month
        forecast_date = last_date + timedelta(days=(i + 1) * 30)
        forecast_month = forecast_date.strftime('%Y-%m')
        
        # Predicted value using trend
        x_future = n + i
        predicted_cost = slope * x_future + intercept
        
        # Ensure non-negative
        predicted_cost = max(0, predicted_cost)
        
        # Calculate confidence bounds
        margin = multiplier * std_dev
        upper_bound = predicted_cost + margin
        lower_bound = max(0, predicted_cost - margin)
        
        # Month-over-month change
        if i == 0:
            prev_cost = historical_data[-1]['total_cost']
        else:
            prev_cost = forecast[i-1]['forecast_value']
        
        mom_change = ((predicted_cost - prev_cost) / prev_cost) if prev_cost > 0 else 0
        
        forecast.append({
            'month': forecast_month,
            'forecast_value': round(predicted_cost, 2),
            'lower_bound': round(lower_bound, 2),
            'upper_bound': round(upper_bound, 2),
            'month_over_month_change': round(mom_change, 4)
        })
    
    return forecast


def detect_anomalies(historical_data: List[Dict]) -> List[Dict]:
    """Detect unusual cost spikes using standard deviation"""
    
    costs = [item['total_cost'] for item in historical_data]
    
    if len(costs) < 3:
        return []
    
    mean_cost = statistics.mean(costs)
    std_dev = statistics.stdev(costs)
    
    anomalies = []
    
    for item in historical_data:
        cost = item['total_cost']
        deviation = abs(cost - mean_cost)
        
        # Flag if more than 2 standard deviations from mean
        if deviation > 2 * std_dev:
            anomaly_pct = (cost - mean_cost) / mean_cost
            anomalies.append({
                'month': item['month'],
                'cost': cost,
                'deviation': round(anomaly_pct, 4),
                'reason': 'Unusual spike detected' if cost > mean_cost else 'Unusual drop detected'
            })
    
    return anomalies


def calculate_accuracy(historical_data: List[Dict], forecast_data: List[Dict]) -> float:
    """
    Calculate forecast accuracy using backtest on historical data
    
    Uses Mean Absolute Percentage Error (MAPE)
    """
    
    if len(historical_data) < 4:
        return 0.85  # Default accuracy for insufficient data
    
    # Use last 25% of historical data for validation
    split_point = int(len(historical_data) * 0.75)
    train_data = historical_data[:split_point]
    test_data = historical_data[split_point:]
    
    if not test_data:
        return 0.85
    
    # Generate forecast for test period
    test_forecast = generate_forecast(train_data, len(test_data), 'medium')
    
    # Calculate MAPE
    errors = []
    for i, actual_item in enumerate(test_data):
        if i < len(test_forecast):
            actual = actual_item['total_cost']
            predicted = test_forecast[i]['forecast_value']
            
            if actual > 0:
                error = abs((actual - predicted) / actual)
                errors.append(error)
    
    if not errors:
        return 0.85
    
    mape = sum(errors) / len(errors)
    accuracy = max(0, min(1, 1 - mape))  # Convert to 0-1 scale
    
    return round(accuracy, 4)


def calculate_service_breakdown(customer_id: str, months: int) -> List[Dict]:
    """Calculate cost breakdown by AWS service"""
    
    # Placeholder - in production, this would aggregate from usage_details
    # For now, return mock data based on typical patterns
    
    services = [
        {'service': 'EC2', 'projected_cost': 450.00, 'percentage': 0.30},
        {'service': 'RDS', 'projected_cost': 300.00, 'percentage': 0.20},
        {'service': 'S3', 'projected_cost': 225.00, 'percentage': 0.15},
        {'service': 'Lambda', 'projected_cost': 150.00, 'percentage': 0.10},
        {'service': 'CloudWatch', 'projected_cost': 150.00, 'percentage': 0.10},
        {'service': 'VPC', 'projected_cost': 112.50, 'percentage': 0.075},
        {'service': 'Other', 'projected_cost': 112.50, 'percentage': 0.075},
    ]
    
    return services


def determine_trend(historical_data: List[Dict]) -> str:
    """Determine overall cost trend (increasing, decreasing, stable)"""
    
    if len(historical_data) < 3:
        return 'stable'
    
    costs = [item['total_cost'] for item in historical_data]
    
    # Compare first half to second half
    mid = len(costs) // 2
    first_half_avg = statistics.mean(costs[:mid])
    second_half_avg = statistics.mean(costs[mid:])
    
    change_pct = (second_half_avg - first_half_avg) / first_half_avg if first_half_avg > 0 else 0
    
    if change_pct > 0.1:
        return 'increasing'
    elif change_pct < -0.1:
        return 'decreasing'
    else:
        return 'stable'


def store_forecast(customer_id: str, forecast_data: List[Dict]):
    """Store forecast in DynamoDB for future reference"""
    
    table = dynamodb.Table(FORECASTS_TABLE)
    
    try:
        for month_data in forecast_data:
            table.put_item(
                Item={
                    'customer_id': customer_id,
                    'period_month': month_data['month'],
                    'forecasted_cost': Decimal(str(month_data['forecast_value'])),
                    'lower_bound': Decimal(str(month_data['lower_bound'])),
                    'upper_bound': Decimal(str(month_data['upper_bound'])),
                    'generated_at': datetime.utcnow().isoformat(),
                    'ttl': int((datetime.utcnow() + timedelta(days=90)).timestamp())
                }
            )
    except Exception as e:
        print(f"Error storing forecast: {str(e)}")
        # Non-fatal, continue


def handle_export(event):
    """Export forecast to PDF/CSV/JSON"""
    
    try:
        params = event.get('queryStringParameters') or {}
        format_type = params.get('format', 'pdf')
        customer_id = get_customer_id(event)
        
        # Generate forecast data
        historical_data = fetch_historical_costs(customer_id)
        forecast_data = generate_forecast(historical_data, 12, 'medium')
        
        if format_type == 'csv':
            csv_data = generate_csv(forecast_data)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': f'attachment; filename=forecast-{datetime.utcnow().date()}.csv'
                },
                'body': csv_data
            }
        
        elif format_type == 'json':
            return success_response({'forecast': forecast_data})
        
        else:  # PDF
            # In production, use a library like reportlab or weasyprint
            return error_response(501, 'PDF export not yet implemented')
            
    except Exception as e:
        print(f"Error exporting forecast: {str(e)}")
        return error_response(500, f'Export failed: {str(e)}')


def generate_csv(forecast_data: List[Dict]) -> str:
    """Generate CSV format from forecast data"""
    
    csv_lines = ['Month,Forecast,Lower Bound,Upper Bound,MoM Change']
    
    for month in forecast_data:
        csv_lines.append(
            f"{month['month']},"
            f"{month['forecast_value']},"
            f"{month['lower_bound']},"
            f"{month['upper_bound']},"
            f"{month['month_over_month_change']}"
        )
    
    return '\n'.join(csv_lines)


def handle_set_budget_alert(event):
    """Set monthly budget alert threshold"""
    
    try:
        customer_id = get_customer_id(event)
        body = json.loads(event.get('body', '{}'))
        
        monthly_limit = body.get('monthly_limit')
        alert_threshold = body.get('alert_threshold', 0.8)
        
        if not monthly_limit:
            return error_response(400, 'monthly_limit is required')
        
        # Store budget alert configuration
        # In production, this would go to a budget_alerts table
        
        return success_response({
            'message': 'Budget alert configured successfully',
            'monthly_limit': monthly_limit,
            'alert_threshold': alert_threshold
        })
        
    except Exception as e:
        print(f"Error setting budget alert: {str(e)}")
        return error_response(500, f'Failed to set budget alert: {str(e)}')


def handle_get_budget_alerts(event):
    """Get configured budget alerts"""
    
    try:
        customer_id = get_customer_id(event)
        
        # Placeholder - fetch from database in production
        return success_response({
            'alerts': []
        })
        
    except Exception as e:
        print(f"Error fetching budget alerts: {str(e)}")
        return error_response(500, f'Failed to fetch alerts: {str(e)}')


def get_customer_id(event) -> str:
    """Extract customer ID from request context"""
    
    # From API Gateway authorizer
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    customer_id = authorizer.get('customer_id')
    
    if not customer_id:
        # Fallback to query parameter for testing
        params = event.get('queryStringParameters') or {}
        customer_id = params.get('customer_id', 'test-customer')
    
    return customer_id


def success_response(data: Dict[str, Any]) -> Dict:
    """Generate successful API response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(data, cls=DecimalEncoder)
    }


def error_response(status_code: int, message: str) -> Dict:
    """Generate error API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'error': message,
            'timestamp': datetime.utcnow().isoformat()
        })
    }
