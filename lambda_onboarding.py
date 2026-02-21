import boto3
import email
from email import policy
import time

# Initialize outside handler for "warm start" performance
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('SecureBase_Inbound_Logs')

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    ses_mail = event['Records'][0]['ses']['mail']
    message_id = ses_mail['messageId']
    bucket_name = 'ses-inbound-tximhotep-731184206915'

    try:
        # Fetch and parse as we did before
        response = s3.get_object(Bucket=bucket_name, Key=message_id)
        msg = email.message_from_bytes(response['Body'].read(), policy=policy.default)
        
        subject = msg.get('subject', '(No Subject)')
        sender = msg.get('from', '(Unknown Sender)')
        
        # Log to Database
        table.put_item(
            Item={
                'MessageId': message_id,
                'Sender': sender,
                'Subject': subject,
                'Timestamp': int(time.time()),
                'Status': 'UNREAD',
                'S3Path': f"s3://{bucket_name}/{message_id}"
            }
        )
        print(f"Successfully logged {message_id} to DynamoDB")
        
    except Exception as e:
        print(f"DB Logging Error: {str(e)}")
        raise e
