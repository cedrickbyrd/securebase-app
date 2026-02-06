"""
SecureBase Demo Backend - Health Check Lambda
Returns API health status
"""

import json
import os
import time
import boto3

dynamodb = boto3.resource('dynamodb')


def cors_headers():
    """CORS headers for Netlify frontend"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    }


def check_dynamodb_health():
    """Check if DynamoDB tables are accessible"""
    try:
        customers_table = os.environ.get("CUSTOMERS_TABLE")
        table = dynamodb.Table(customers_table)
        # Try to describe the table
        table.load()
        return True
    except Exception as e:
        print(f"DynamoDB health check failed: {e}")
        return False


def lambda_handler(event, context):
    """Handle health check requests"""
    print(f"Health check request: {json.dumps(event)}")
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": ""
        }
    
    try:
        # Check DynamoDB connectivity
        db_healthy = check_dynamodb_health()
        
        status = "healthy" if db_healthy else "degraded"
        status_code = 200 if db_healthy else 503
        
        response_body = {
            "status": status,
            "timestamp": int(time.time()),
            "version": "1.0.0",
            "service": "SecureBase Demo Backend",
            "components": {
                "api": "healthy",
                "database": "healthy" if db_healthy else "unhealthy",
                "auth": "healthy"
            },
            "region": os.environ.get("AWS_REGION", "us-east-1")
        }
        
        return {
            "statusCode": status_code,
            "headers": cors_headers(),
            "body": json.dumps(response_body)
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers(),
            "body": json.dumps({
                "status": "error",
                "error": "Health check failed"
            })
        }
