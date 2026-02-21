import boto3
import json
from datetime import datetime

def collect_s3_evidence(pilot_account_id, bridge_role_name):
    # 1. Assume the Pilot's Bridge Role
    sts = boto3.client('sts')
    role_arn = f"arn:aws:iam::{pilot_account_id}:role/{bridge_role_name}"
    
    assumed_role = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="SecureBaseAuditSession"
    )
    
    # 2. Setup S3 client with Pilot's credentials
    creds = assumed_role['Credentials']
    s3 = boto3.client(
        's3',
        aws_access_key_id=creds['AccessKeyId'],
        aws_secret_access_key=creds['SecretAccessKey'],
        aws_session_token=creds['SessionToken']
    )
    
    # 3. Audit all buckets
    buckets = s3.list_buckets()['Buckets']
    evidence_items = []
    
    for b in buckets:
        name = b['Name']
        try:
            enc = s3.get_bucket_encryption(Bucket=name)
            status = "COMPLIANT"
            raw_proof = enc['ServerSideEncryptionConfiguration']
        except:
            status = "NON_COMPLIANT"
            raw_proof = "No encryption configuration found"

        # 4. Format Evidence for DynamoDB
        evidence_items.append({
            'PilotID': pilot_account_id,
            'Timestamp': datetime.utcnow().isoformat(),
            'ControlID': 'CC6.7', # SOC 2 Encryption Control
            'ResourceID': name,
            'Status': status,
            'RawProof': json.dumps(raw_proof)
        })
    
    return evidence_items

# Next: Send 'evidence_items' to your central DynamoDB
