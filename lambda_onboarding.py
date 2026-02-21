import boto3
import email
from email import policy

def lambda_handler(event, context):
    print("SecureBase Onboarding Triggered!")
    s3 = boto3.client('s3')
    
    # 1. Get the SES metadata from the event
    ses_mail = event['Records'][0]['ses']['mail']
    message_id = ses_mail['messageId']
    
    # 2. Fetch the raw email from your specific S3 bucket
    bucket_name = 'ses-inbound-tximhotep-731184206915'
    
    try:
        response = s3.get_object(Bucket=bucket_name, Key=message_id)
        raw_email = response['Body'].read()
        
        # 3. Parse the email using Python's built-in email library
        msg = email.message_from_bytes(raw_email, policy=policy.default)
        
        subject = msg['subject']
        sender = msg['from']
        body = msg.get_body(preferencelist=('plain')).get_content()

        print(f"SecureBase Onboarding: New email from {sender}")
        print(f"Subject: {subject}")
        print(f"Content: {body[:100]}...") # Log the first 100 chars
        
        # TODO: Add logic to save this to your database for your React frontend
        
    except Exception as e:
        print(f"Error processing email {message_id}: {str(e)}")
        raise e
