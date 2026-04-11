import json, logging, os, re, uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError
import db

logger = logging.getLogger()
logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); ses=boto3.client("ses",region_name=os.environ.get("AWS_REGION","us-east-1"))
cognito=boto3.client("cognito-idp"); lambda_=boto3.client("lambda")

def get_param(n): return ssm.get_parameter(Name=n,WithDecryption=True)["Parameter"]["Value"]
def cors(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com")},"body":json.dumps(body)}

def validate(body):
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
    if not job_id or not email: return cors(400,{"message":"token and email are required."})
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",job_id): return cors(400,{"message":"Invalid token."})
    try:
        user_pool_id=get_param("/securebase/cognito/user_pool_id")
    except ClientError: return cors(500,{"message":"Configuration error."})
    try:
        # Validate the job belongs to this email and is still active before doing anything.
        # Use LOWER() on sr.email for consistent case-insensitive matching (matches the index).
        rows=db.execute(
            "SELECT sr.id, sr.org_name, sr.aws_region, sr.mfa_enabled, sr.guardrails_level "
            "FROM onboarding_jobs oj "
            "JOIN signup_requests sr ON sr.id = oj.customer_id "
            "WHERE oj.id = :job_id AND LOWER(sr.email) = :email "
            "AND oj.overall_status IN ('pending','in_progress') LIMIT 1",
            {"job_id": job_id, "email": email}
        )
    except ClientError as e: return cors(500,{"message":"Database error."})
    if not rows: return cors(404,{"message":"Verification token not found or already processed."})
    # Column order matches SELECT: id, org_name, aws_region, mfa_enabled, guardrails_level
    customer_id=rows[0][0]; org_name=rows[0][1]; aws_region=rows[0][2]
    mfa_enabled=rows[0][3]; guardrails_level=rows[0][4]
    try:
        cognito.admin_update_user_attributes(UserPoolId=user_pool_id,Username=email,UserAttributes=[{"Name":"email_verified","Value":"true"}])
    except ClientError as e: logger.error("Cognito verify error: %s",e); return cors(500,{"message":"Failed to verify email."})
    try:
        db.execute_write(
            "UPDATE signup_requests SET email_verified=TRUE, email_verified_at=NOW() WHERE id=:cid",
            {"cid": customer_id}
        )
    except ClientError as e: return cors(500,{"message":"Database error."})
    try: invoke_provisioner(provisioner_fn,job_id,customer_id,email,org_name,aws_region,mfa_enabled,guardrails_level)
    except ClientError as e: logger.error("Provisioner re-invoke error: %s",e)
    logger.info("Email verified, provisioner re-triggered: customer=%s job=%s",customer_id,job_id)
    return cors(200,{"message":"Email verified. Provisioning will begin shortly.","jobId":job_id})

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors(200,{})
    try: body=json.loads(event.get("body") or "{}")
    except: return cors(400,{"message":"Invalid JSON."})
    errors=validate(body)
    if errors: return cors(400,{"message":errors[0],"errors":errors})
    email=body["email"].strip().lower(); now=datetime.now(timezone.utc).isoformat()
    try:
        ses_sender=get_param("/securebase/ses/from_address")
        user_pool_id=get_param("/securebase/cognito/user_pool_id")
        provisioner_fn=get_param("/securebase/provisioner/function")
    except ClientError as e: logger.error("SSM: %s",e); return cors(500,{"message":"Configuration error."})
    try:
        rows=db.execute("SELECT id FROM customers WHERE email=:email LIMIT 1",{"email":email})
        if rows: return cors(409,{"message":"An account with this email already exists."})
    except Exception as e: logger.error("DB: %s",e); return cors(500,{"message":"Database error."})
    try:
        # Create Cognito user (without job_id yet - will be set after DB insert)
        cognito.admin_create_user(UserPoolId=user_pool_id,Username=email,UserAttributes=[{"Name":"email","Value":email},{"Name":"given_name","Value":body["firstName"]},{"Name":"family_name","Value":body["lastName"]},{"Name":"custom:org_name","Value":body["orgName"]}],TemporaryPassword=body["password"],MessageAction="SUPPRESS")
    except cognito.exceptions.UsernameExistsException: return cors(409,{"message":"An account with this email already exists."})
    except ClientError as e: return cors(500,{"message":"Failed to create account."})
    try:
        # Use database function for atomic customer + job creation
        result = db.execute(
            """SELECT * FROM create_customer_with_onboarding(
                :email, :fn, :ln, :org, :sz, :ind, :reg, :mfa, :gl
            )""",
            {
                "email": email,
                "fn": body["firstName"],
                "ln": body["lastName"],
                "org": body["orgName"],
                "sz": body.get("orgSize", "unknown"),
                "ind": body.get("industry", "general"),
                "reg": body["awsRegion"],
                "mfa": bool(body.get("mfaEnabled", True)),
                "gl": body.get("guardrailsLevel", "standard")
            }
        )
        # Extract customer_id and job_id from function result
        returned_customer_id, returned_job_id = result[0]
        logger.info(f"Created customer {returned_customer_id} with job {returned_job_id}")
        
        # Update Cognito user with job_id
        try:
            cognito.admin_update_user_attributes(
                UserPoolId=user_pool_id,
                Username=email,
                UserAttributes=[{"Name":"custom:job_id","Value":str(returned_job_id)}]
            )
        except Exception as cog_err:
            logger.warning(f"Failed to update Cognito job_id: {cog_err}")
    except Exception as e:
        logger.error("DB write error: %s", str(e), exc_info=True)
        # Check if it's a duplicate email error
        if 'Email already exists' in str(e):
            return cors(409, {"message": "An account with this email already exists."})
        # Rollback Cognito user if database insert failed
        try: cognito.admin_delete_user(UserPoolId=user_pool_id,Username=email)
        except: pass
        return cors(500,{"message":"Failed to save account data."})
    verify_url=f"https://securebase.tximhotep.com/verify-email?token={returned_job_id}&email={email}"
    try: ses.send_email(Source=ses_sender,Destination={"ToAddresses":[email]},Message={"Subject":{"Data":"Verify your SecureBase account"},"Body":{"Text":{"Data":f"Hi {body['firstName']},\n\nVerify your email:\n{verify_url}\n\n— SecureBase"}}})
    except ClientError as e: logger.error("SES: %s",e)
    try: lambda_.invoke(FunctionName=provisioner_fn,InvocationType="Event",Payload=json.dumps({"jobId":returned_job_id,"customerId":returned_customer_id,"email":email,"orgName":body["orgName"],"awsRegion":body["awsRegion"],"mfaEnabled":bool(body.get("mfaEnabled",True)),"guardrailsLevel":body.get("guardrailsLevel","standard")}))
    except ClientError as e: logger.error("Provisioner: %s",e)
    logger.info("Signup: customer=%s job=%s",returned_customer_id,returned_job_id)
    return cors(201,{"message":"Account created. Please verify your email.","jobId":returned_job_id})
