import json, logging, os
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError
import db

logger=logging.getLogger(); logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); cognito=boto3.client("cognito-idp"); lambda_=boto3.client("lambda")
PORTAL_URL=os.environ.get("PORTAL_URL","https://securebase.tximhotep.com")

def get_param(n): return ssm.get_parameter(Name=n,WithDecryption=True)["Parameter"]["Value"]
def resp(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com")},"body":json.dumps(body)}

def lambda_handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return resp(204,{})
    method=event.get("httpMethod","POST")
    if method=="GET":
        params=event.get("queryStringParameters") or {}; job_id=params.get("token","").strip(); email=params.get("email","").strip().lower()
    else:
        try: body=json.loads(event.get("body") or "{}"); job_id=body.get("token","").strip(); email=body.get("email","").strip().lower()
        except: return resp(400,{"error":"Invalid JSON."})
    if not job_id or not email: return resp(400,{"error":"token and email are required."})
    try:
        pool_id=get_param("/securebase/cognito/user_pool_id"); provisioner=get_param("/securebase/provisioner/function")
    except ClientError: return resp(500,{"error":"Configuration error."})
    try:
        rows=db.execute("SELECT j.id,j.customer_id,c.email,c.first_name,c.org_name,c.aws_region,c.mfa_enabled,c.guardrails_level FROM onboarding_jobs j JOIN customers c ON c.id=j.customer_id WHERE j.id=$1 AND LOWER(c.email)=$2 LIMIT 1",[job_id,email])
    except Exception as e: logger.error("DB: %s",e); return resp(500,{"error":"Database error."})
    if not rows: return resp(404,{"error":"Token not found or email mismatch."})
    r=rows[0]; customer_id=r[1]; db_email=r[2]; org_name=r[4]; aws_region=r[5]; mfa_enabled=r[6]; guardrails=r[7]
    try:
        cognito.admin_update_user_attributes(UserPoolId=pool_id,Username=db_email,UserAttributes=[{"Name":"email_verified","Value":"true"}])
    except ClientError as e: logger.error("Cognito: %s",e); return resp(500,{"error":"Failed to verify email."})
    now=datetime.now(timezone.utc).isoformat()
    try: db.execute_write("UPDATE customers SET email_verified=TRUE,email_verified_at=$1 WHERE id=$2",[now,customer_id])
    except Exception as e: logger.error("DB update: %s",e)
    try: lambda_.invoke(FunctionName=provisioner,InvocationType="Event",Payload=json.dumps({"jobId":job_id,"customerId":customer_id,"email":db_email,"orgName":org_name,"awsRegion":aws_region,"mfaEnabled":mfa_enabled,"guardrailsLevel":guardrails}))
    except Exception as e: logger.warning("Provisioner (non-fatal): %s",e)
    if method=="GET":
        return{"statusCode":302,"headers":{"Location":f"{PORTAL_URL}/onboarding?jobId={job_id}&email={db_email}","Access-Control-Allow-Origin":"*"},"body":""}
    return resp(200,{"message":"Email verified. Provisioning will begin shortly.","jobId":job_id})