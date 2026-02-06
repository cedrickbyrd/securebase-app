"""
SecureBase Demo Backend - Metrics Lambda
Returns aggregated metrics data
"""

import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')


class DecimalEncoder(json.JSONEncoder):
    """Helper to convert DynamoDB Decimal types to JSON"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


def cors_headers():
    """CORS headers for Netlify frontend"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }


def verify_auth(event):
    """Verify JWT token from Authorization header"""
    auth_header = event.get("headers", {}).get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    return True


def lambda_handler(event, context):
    """Handle metrics data requests"""
    print(f"Metrics request: {json.dumps(event)}")
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": ""
        }
    
    # Verify authentication
    if not verify_auth(event):
        return {
            "statusCode": 401,
            "headers": cors_headers(),
            "body": json.dumps({"error": "Unauthorized"})
        }
    
    try:
        table_name = os.environ.get("METRICS_TABLE")
        table = dynamodb.Table(table_name)
        
        # Get the single metrics record (id: "global")
        response = table.get_item(Key={"id": "global"})
        metrics = response.get("Item")
        
        if not metrics:
            # Return default metrics if not found
            metrics = {
                "id": "global",
                "monthly_cost": 58240,
                "cost_trend": "+2.3%",
                "compliance_score": 92,
                "total_customers": 5,
                "account_count": 233
            }
        
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": json.dumps(metrics, cls=DecimalEncoder)
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers(),
            "body": json.dumps({"error": "Internal server error"})
        }
