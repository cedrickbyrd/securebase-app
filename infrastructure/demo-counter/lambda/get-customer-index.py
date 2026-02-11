"""
Demo Customer Index Lambda Function

Atomic counter for sequential demo customer assignment.
Returns customer index (0-4) based on visitor count.

Cost: ~$0.10/month for typical demo traffic
"""

import json
import boto3
import os
from decimal import Decimal

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb')
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'demo-visitor-counter')
COUNTER_KEY = 'visitor-counter'


def lambda_handler(event, context):
    """
    Lambda handler for demo customer index endpoint.
    
    Increments visitor counter atomically and returns customer index.
    
    Returns:
        {
            "customerIndex": 0-4,
            "visitorNumber": total_count
        }
    """
    
    try:
        # Atomic increment of counter
        response = dynamodb.update_item(
            TableName=TABLE_NAME,
            Key={
                'id': {'S': COUNTER_KEY}
            },
            UpdateExpression='ADD visitor_count :inc',
            ExpressionAttributeValues={
                ':inc': {'N': '1'}
            },
            ReturnValues='UPDATED_NEW'
        )
        
        # Extract new counter value
        visitor_count = int(response['Attributes']['visitor_count']['N'])
        
        # Calculate customer index (0-4)
        customer_index = visitor_count % 5
        
        # Return response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            'body': json.dumps({
                'customerIndex': customer_index,
                'visitorNumber': visitor_count
            })
        }
        
    except dynamodb.exceptions.ResourceNotFoundException:
        # Table doesn't exist
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Configuration error',
                'message': f'DynamoDB table {TABLE_NAME} not found'
            })
        }
        
    except Exception as e:
        # Log error for CloudWatch
        print(f"Error incrementing counter: {str(e)}")
        
        # Return error response
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': 'Failed to increment visitor counter'
            })
        }


def initialize_counter():
    """
    Initialize counter to 0 if it doesn't exist.
    Called during deployment or manually if needed.
    """
    try:
        dynamodb.put_item(
            TableName=TABLE_NAME,
            Item={
                'id': {'S': COUNTER_KEY},
                'visitor_count': {'N': '0'}
            },
            ConditionExpression='attribute_not_exists(id)'
        )
        print(f"Counter initialized in table {TABLE_NAME}")
        return True
    except dynamodb.exceptions.ConditionalCheckFailedException:
        # Counter already exists
        print("Counter already initialized")
        return False
    except Exception as e:
        print(f"Error initializing counter: {str(e)}")
        return False


# For local testing
if __name__ == '__main__':
    # Mock event and context for local testing
    test_event = {}
    test_context = {}
    
    # Test the function
    result = lambda_handler(test_event, test_context)
    print(json.dumps(result, indent=2))
