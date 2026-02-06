"""
SecureBase Demo Backend - Customers Lambda
Returns customer data from DynamoDB
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
    
    # In demo mode, we trust the token (production would verify JWT)
    # Extract customer_id from token if needed
    return True


def lambda_handler(event, context):
    """Handle customer data requests"""
    print(f"Customers request: {json.dumps(event)}")
    
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
        table_name = os.environ.get("CUSTOMERS_TABLE")
        table = dynamodb.Table(table_name)
        
        # Get path and method
        path = event.get("path", "")
        method = event.get("httpMethod", "GET")
        
        # GET /customers - List all customers
        if method == "GET" and path == "/customers":
            response = table.scan()
            customers = response.get("Items", [])
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps(customers, cls=DecimalEncoder)
            }
        
        # GET /customers/{id} - Get single customer
        elif method == "GET" and "/customers/" in path:
            customer_id = path.split("/")[-1]
            
            response = table.get_item(Key={"id": customer_id})
            customer = response.get("Item")
            
            if not customer:
                return {
                    "statusCode": 404,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Customer not found"})
                }
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps(customer, cls=DecimalEncoder)
            }
        
        else:
            return {
                "statusCode": 404,
                "headers": cors_headers(),
                "body": json.dumps({"error": "Not found"})
            }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers(),
            "body": json.dumps({"error": "Internal server error"})
        }
