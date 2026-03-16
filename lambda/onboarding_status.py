import json, logging, os, re
import boto3
from botocore.exceptions import ClientError

logger=logging.getLogger(); logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); rds=boto3.client("rds-data")
STEP_KEYS=["email_verified","account_created","org_linked","terraform_applied","guardrails_active","iam_roles_created","welcome_sent"]

def get_param(name): return ssm.get_parameter(Name=name,WithDecryption=True)["Parameter"]["Value"]
def cors_response(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com"),"Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"},"body":json.dumps(body)}

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors_response(200,{})
    params=event.get("queryStringParameters") or {}
    job_id=params.get("jobId","").strip()
    if not job_id: return cors_response(400,{"message":"jobId is required."})
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",job_id): return cors_response(400,{"message":"Invalid jobId."})
    try:
        db_resource_arn=get_param("/securebase/db/resource_arn"); db_secret_arn=get_param("/securebase/db/secret_arn"); db_name=get_param("/securebase/db/name")
    except ClientError: return cors_response(500,{"message":"Configuration error."})
    try:
        rows=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT overall_status,aws_account_id,created_at FROM onboarding_jobs WHERE id=:id",parameters=[{"name":"id","value":{"stringValue":job_id}}])["records"]
    except ClientError: return cors_response(500,{"message":"Database error."})
    if not rows: return cors_response(404,{"message":"Job not found."})
    row=rows[0]; overall_status=row[0]["stringValue"]; aws_account_id=None if row[1].get("isNull") else row[1].get("stringValue"); created_at=row[2]["stringValue"]
    try:
        step_rows=rds.execute_statement(resourceArn=db_resource_arn,secretArn=db_secret_arn,database=db_name,sql="SELECT step_key,status,error_message,updated_at FROM onboarding_steps WHERE job_id=:id",parameters=[{"name":"id","value":{"stringValue":job_id}}])["records"]
    except ClientError: step_rows=[]
    steps={k:"pending" for k in STEP_KEYS}; timestamps={}; errors={}
    for r in step_rows:
        k=r[0]["stringValue"]; s=r[1]["stringValue"]; err=None if r[2].get("isNull") else r[2].get("stringValue"); ts=r[3]["stringValue"]
        steps[k]=s; timestamps[k]=ts
        if err: errors[k]=err
    return cors_response(200,{"jobId":job_id,"overallStatus":overall_status,"awsAccountId":aws_account_id,"createdAt":created_at,"steps":steps,"timestamps":timestamps,"errors":errors})