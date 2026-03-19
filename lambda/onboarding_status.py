import json, logging, os, re
import boto3
import db

logger=logging.getLogger(); logger.setLevel(logging.INFO)
STEP_KEYS=["email_verified","account_created","org_linked","terraform_applied","guardrails_active","iam_roles_created","welcome_sent"]

def cors(status,body):
    return{"statusCode":status,"headers":{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":os.environ.get("ALLOWED_ORIGIN","https://securebase.tximhotep.com")},"body":json.dumps(body)}

def handler(event,context):
    if event.get("httpMethod")=="OPTIONS": return cors(200,{})
    params=event.get("queryStringParameters") or {}
    job_id=params.get("jobId","").strip()
    if not job_id: return cors(400,{"message":"jobId is required."})
    if not re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",job_id): return cors(400,{"message":"Invalid jobId."})
    try:
        rows=db.execute("SELECT overall_status,aws_account_id,created_at FROM onboarding_jobs WHERE id=$1",[job_id])
    except Exception as e: logger.error("DB: %s",e); return cors(500,{"message":"Database error."})
    if not rows: return cors(404,{"message":"Job not found."})
    overall_status=rows[0][0]; aws_account_id=rows[0][1]; created_at=str(rows[0][2])
    try: step_rows=db.execute("SELECT step_key,status,error_message,updated_at FROM onboarding_steps WHERE job_id=$1",[job_id])
    except: step_rows=[]
    steps={k:"pending" for k in STEP_KEYS}; timestamps={}; errors={}
    for r in step_rows:
        steps[r[0]]=r[1]; timestamps[r[0]]=str(r[3])
        if r[2]: errors[r[0]]=r[2]
    return cors(200,{"jobId":job_id,"overallStatus":overall_status,"awsAccountId":aws_account_id,"createdAt":created_at,"steps":steps,"timestamps":timestamps,"errors":errors})