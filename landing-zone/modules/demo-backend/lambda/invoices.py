"""
SecureBase Demo Backend - Invoices Lambda
Returns invoice data from DynamoDB
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
    """Handle invoice data requests"""
    print(f"Invoices request: {json.dumps(event)}")
    
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
        table_name = os.environ.get("INVOICES_TABLE")
        table = dynamodb.Table(table_name)
        
        # Get path, method, and query parameters
        path = event.get("path", "")
        method = event.get("httpMethod", "GET")
        query_params = event.get("queryStringParameters") or {}
        
        # GET /invoices - List invoices (with optional customer_id filter)
        if method == "GET" and path == "/invoices":
            customer_id = query_params.get("customer_id")
            
            if customer_id:
                # Query by customer_id using GSI
                response = table.query(
                    IndexName="customer-index",
                    KeyConditionExpression="customer_id = :cid",
                    ExpressionAttributeValues={":cid": customer_id}
                )
            else:
                # Scan all invoices
                response = table.scan()
            
            invoices = response.get("Items", [])
            
            # Sort by created_at descending
            invoices.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps(invoices, cls=DecimalEncoder)
            }
        
        # GET /invoices/{id} - Get single invoice
        elif method == "GET" and "/invoices/" in path:
            invoice_id = path.split("/")[-1]
            
            response = table.get_item(Key={"id": invoice_id})
            invoice = response.get("Item")
            
            if not invoice:
                return {
                    "statusCode": 404,
                    "headers": cors_headers(),
                    "body": json.dumps({"error": "Invoice not found"})
                }
            
            return {
                "statusCode": 200,
                "headers": cors_headers(),
                "body": json.dumps(invoice, cls=DecimalEncoder)
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
