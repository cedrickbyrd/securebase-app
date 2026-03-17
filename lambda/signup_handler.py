import json, logging, os, re, uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); ses=boto3.client("ses",region_name=os.environ.get("AWS_REGION","us-east-1"))
cognito=boto3.client("cognito-idp"); lambda_=boto3.client("lambda"); rds=boto3.client("rds-data")

def get_param(name,decrypt=True): return ssm.get_parameter(Name=name,WithDecryption=decrypt)["Parameter"]["Value"]
def cors_response(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com"),"Access-Control-Allow-Methods":"POST,GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"},"body":json.dumps(body)}
def validate_payload(body):
    errors=[]
    for f in ["firstName","lastName","email","password","orgName","orgSize","industry","awsRegion"]:
        if not body.get(f,"").strip(): errors.append(f"{f} is required.")
    if body.get("email") and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$",body["email"]): errors.append("Invalid email.")
    if len(body.get("password",""))<12: errors.append("Password must be at least 12 characters.")
    if body.get("awsRegion") not in ["us-east-1","us-west-2","eu-west-1","ap-southeast-1","ap-northeast-1"]: errors.append("Invalid AWS region.")
    return errors

def invoke_provisioner(provisioner_fn, job_id, customer_id, email, org_name, aws_region, mfa_enabled, guardrails_level):
    """Asynchronously invoke the account provisioner Lambda."""
    lambda_.invoke(FunctionName=provisioner_fn,InvocationType="Event",Payload=json.dumps({"jobId":job_id,"customerId":customer_id,"email":email,"orgName":org_name,"awsRegion":aws_region,"mfaEnabled":mfa_enabled,"guardrailsLevel":guardrails_level}))

def verify_email_handler(event,provisioner_fn):
    """Handle email verification link. Validates token ownership, marks verified, re-triggers provisioner."""
    params=event.get("queryStringParameters") or {}
    job_id=params.get("token","").strip(); email=params.get("email","").strip().lower()
    if not job_id or not email: return cors_response(400,{"message":"token and email are required."})
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",job_id): return cors_response(400,{"message":"Invalid token."})
    try:
        user_pool_id=get_param("/securebase/cognito/user_pool_id")
        db_resource_arn=get_param("/securebase/db/resource_arn"); db_secret_arn=get_param("/securebase/db/secret_arn"); db_name=get_param("/securebase/db/name")
    except ClientError: return cors_response(500,{"message":"Configuration error."})
    try:
        # Validate the job belongs to this email and is still active before doing anything.
        # Use LOWER() on sr.email for consistent case-insensitive matching (matches the index).
        rows=rds.execute_statement(
        rows=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT id,name,aws_region,mfa_enabled,guardrails_level FROM customers WHERE billing_email=:e LIMIT 1",parameters=[{"name":"e","value":{"stringValue":email}}])["records"]
            sql=("SELECT sr.id, sr.org_name, sr.aws_region, sr.mfa_enabled, sr.guardrails_level "
        # Column order matches SELECT: id, name (org_name), aws_region, mfa_enabled, guardrails_level
                 "JOIN signup_requests sr ON sr.id = oj.customer_id "
                 "WHERE oj.id = :job_id AND LOWER(sr.email) = :email "
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="UPDATE customers SET email_verified=TRUE,email_verified_at=NOW() WHERE billing_email=:e",parameters=[{"name":"e","value":{"stringValue":email}}])
            parameters=[{"name":"job_id","value":{"stringValue":job_id}},{"name":"email","value":{"stringValue":email}}]
        )["records"]
    except ClientError as e: return cors_response(500,{"message":"Database error."})
    if not rows: return cors_response(404,{"message":"Verification token not found or already processed."})
    # Column order matches SELECT: id, org_name, aws_region, mfa_enabled, guardrails_level
    customer_id=rows[0][0]["stringValue"]; org_name=rows[0][1]["stringValue"]; aws_region=rows[0][2]["stringValue"]
    mfa_enabled=rows[0][3]["booleanValue"]; guardrails_level=rows[0][4]["stringValue"]
    try:
        cognito.admin_update_user_attributes(UserPoolId=user_pool_id,Username=email,UserAttributes=[{"Name":"email_verified","Value":"true"}])
    except ClientError as e: logger.error("Cognito verify error: %s",e); return cors_response(500,{"message":"Failed to verify email."})
    try:
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,
                              sql="UPDATE signup_requests SET email_verified=TRUE,email_verified_at=NOW() WHERE id=:cid",
                              parameters=[{"name":"cid","value":{"stringValue":customer_id}}])
    except ClientError as e: return cors_response(500,{"message":"Database error."})
    try: invoke_provisioner(provisioner_fn,job_id,customer_id,email,org_name,aws_region,mfa_enabled,guardrails_level)
    except ClientError as e: logger.error("Provisioner re-invoke error: %s",e)
    logger.info("Email verified, provisioner re-triggered: customer=%s job=%s",customer_id,job_id)
    return cors_response(200,{"message":"Email verified. Provisioning will begin shortly.","jobId":job_id})

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors_response(200,{})
    path=event.get("path","")
    # Verify-email route: GET /signup/verify-email?token=...&email=...
    if event.get("httpMethod")=="GET" and "/verify-email" in path:
        try: provisioner_fn=get_param("/securebase/provisioner/function")
        except ClientError: return cors_response(500,{"message":"Configuration error."})
        return verify_email_handler(event,provisioner_fn)
    try: body=json.loads(event.get("body") or "{}")
    except json.JSONDecodeError: return cors_response(400,{"message":"Invalid JSON."})
    errors=validate_payload(body)
    if errors: return cors_response(400,{"message":errors[0],"errors":errors})
    email=body["email"].strip().lower(); job_id=str(uuid.uuid4()); customer_id=str(uuid.uuid4()); now=datetime.now(timezone.utc).isoformat()
    try:
        db_resource_arn=get_param("/securebase/db/resource_arn"); db_secret_arn=get_param("/securebase/db/secret_arn")
        db_name=get_param("/securebase/db/name"); ses_sender=get_param("/securebase/ses/from_address")
        user_pool_id=get_param("/securebase/cognito/user_pool_id"); provisioner_fn=get_param("/securebase/provisioner/function")
    except ClientError as e: logger.error("SSM error: %s",e); return cors_response(500,{"message":"Configuration error."})
    try:
        dup=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT id FROM signup_requests WHERE LOWER(email)=:email LIMIT 1",parameters=[{"name":"email","value":{"stringValue":email}}])
        if dup["records"]: return cors_response(409,{"message":"An account with this email already exists."})
    except ClientError as e: return cors_response(500,{"message":"Database error."})
    try:
        cognito.admin_create_user(UserPoolId=user_pool_id,Username=email,UserAttributes=[{"Name":"email","Value":email},{"Name":"given_name","Value":body["firstName"]},{"Name":"family_name","Value":body["lastName"]},{"Name":"custom:org_name","Value":body["orgName"]},{"Name":"custom:job_id","Value":job_id}],TemporaryPassword=body["password"],MessageAction="SUPPRESS")
    except cognito.exceptions.UsernameExistsException: return cors_response(409,{"message":"An account with this email already exists."})
    except ClientError as e: return cors_response(500,{"message":"Failed to create account."})
    try:
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="INSERT INTO signup_requests(id,email,first_name,last_name,org_name,org_size,industry,aws_region,mfa_enabled,guardrails_level,onboarding_status,created_at) VALUES(:id,:email,:fn,:ln,:org,:sz,:ind,:reg,:mfa,:gl,'pending',:ca)",parameters=[{"name":"id","value":{"stringValue":customer_id}},{"name":"email","value":{"stringValue":email}},{"name":"fn","value":{"stringValue":body["firstName"]}},{"name":"ln","value":{"stringValue":body["lastName"]}},{"name":"org","value":{"stringValue":body["orgName"]}},{"name":"sz","value":{"stringValue":body["orgSize"]}},{"name":"ind","value":{"stringValue":body["industry"]}},{"name":"reg","value":{"stringValue":body["awsRegion"]}},{"name":"mfa","value":{"booleanValue":bool(body.get("mfaEnabled",True))}},{"name":"gl","value":{"stringValue":body.get("guardrailsLevel","standard")}},{"name":"ca","value":{"stringValue":now}}])
        rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="INSERT INTO onboarding_jobs(id,customer_id,overall_status,created_at,updated_at) VALUES(:id,:cid,'pending',:ca,:ca)",parameters=[{"name":"id","value":{"stringValue":job_id}},{"name":"cid","value":{"stringValue":customer_id}},{"name":"ca","value":{"stringValue":now}}])
    except ClientError as e:
        try: cognito.admin_delete_user(UserPoolId=user_pool_id,Username=email)
        except ClientError: pass
        return cors_response(500,{"message":"Failed to save account data."})
    verify_url=f"https://securebase.tximhotep.com/verify-email?token={job_id}&email={email}"
    try: ses.send_email(Source=ses_sender,Destination={"ToAddresses":[email]},Message={"Subject":{"Data":"Verify your SecureBase account"},"Body":{"Text":{"Data":f"Hi {body['firstName']},\n\nVerify your email: {verify_url}\n\n— SecureBase"}}})
    except ClientError as e: logger.error("SES error: %s",e)
    try: invoke_provisioner(provisioner_fn,job_id,customer_id,email,body["orgName"],body["awsRegion"],bool(body.get("mfaEnabled",True)),body.get("guardrailsLevel","standard"))
    except ClientError as e: logger.error("Provisioner invoke error: %s",e)
    logger.info("Signup: customer=%s job=%s",customer_id,job_id)
    return cors_response(201,{"message":"Account created. Please verify your email.","jobId":job_id})
