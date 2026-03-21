import json, logging, os, time
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError
import db

logger=logging.getLogger(); logger.setLevel(logging.INFO)
ssm=boto3.client("ssm"); orgs=boto3.client("organizations")
codebuild=boto3.client("codebuild"); ses=boto3.client("ses",region_name=os.environ.get("AWS_REGION","us-east-1"))
cognito=boto3.client("cognito-idp")

def get_param(n): return ssm.get_parameter(Name=n,WithDecryption=True)["Parameter"]["Value"]

def update_step(job_id,step,status,error=None):
    now=datetime.now(timezone.utc).isoformat()
    db.execute_write("INSERT INTO onboarding_steps(job_id,step_key,status,error_message,updated_at) VALUES(:j,:k,:s,:e,:t) ON CONFLICT(job_id,step_key) DO UPDATE SET status=EXCLUDED.status,error_message=EXCLUDED.error_message,updated_at=EXCLUDED.updated_at",{"j":job_id,"k":step,"s":status,"e":error,"t":now})

def update_job(job_id,status,account_id=None):
    now=datetime.now(timezone.utc).isoformat()
    db.execute_write("UPDATE onboarding_jobs SET overall_status=:s,aws_account_id=:a,updated_at=:t WHERE id=:j",{"j":job_id,"s":status,"a":account_id,"t":now})

def email_verified(email,pool_id):
    try:
        resp=cognito.admin_get_user(UserPoolId=pool_id,Username=email)
        attrs={a["Name"]:a["Value"] for a in resp.get("UserAttributes",[])}
        return attrs.get("email_verified","false").lower()=="true"
    except ClientError: return False

def create_org_account(org_name):
    name=f"securebase-{org_name.lower().replace(' ','-')[:40]}"
    resp=orgs.create_account(Email=f"aws+{name}@securebase.tximhotep.com",AccountName=name,IamUserAccessToBilling="DENY")
    return resp["CreateAccountStatus"]["Id"]

def wait_for_account(request_id,timeout=300):
    deadline=time.time()+timeout; backoff=5
    while time.time()<deadline:
        resp=orgs.describe_create_account_status(CreateAccountRequestId=request_id)
        state=resp["CreateAccountStatus"]["State"]
        if state=="SUCCEEDED": return resp["CreateAccountStatus"]["AccountId"]
        if state=="FAILED": raise RuntimeError(f"Account creation failed: {resp['CreateAccountStatus'].get('FailureReason')}")
        time.sleep(backoff); backoff=min(backoff*2,30)
    raise TimeoutError("Account creation timed out.")

def move_to_workloads_ou(account_id):
    root_id=orgs.list_roots()["Roots"][0]["Id"]
    ous=orgs.list_organizational_units_for_parent(ParentId=root_id)["OrganizationalUnits"]
    ou=next((o for o in ous if o["Name"]=="Workloads"),None)
    if not ou: ou=orgs.create_organizational_unit(ParentId=root_id,Name="Workloads")["OrganizationalUnit"]
    orgs.move_account(AccountId=account_id,SourceParentId=root_id,DestinationParentId=ou["Id"])

def trigger_terraform(payload,project):
    resp=codebuild.start_build(projectName=project,environmentVariablesOverride=[{"name":"TF_VAR_customer_account_id","value":payload["awsAccountId"],"type":"PLAINTEXT"},{"name":"TF_VAR_customer_name","value":payload["orgName"],"type":"PLAINTEXT"},{"name":"TF_VAR_aws_region","value":payload["awsRegion"],"type":"PLAINTEXT"},{"name":"TF_VAR_mfa_enabled","value":str(payload["mfaEnabled"]).lower(),"type":"PLAINTEXT"},{"name":"TF_VAR_guardrails_level","value":payload["guardrailsLevel"],"type":"PLAINTEXT"},{"name":"TF_VAR_job_id","value":payload["jobId"],"type":"PLAINTEXT"}])
    return resp["build"]["id"]

def wait_for_build(build_id,timeout=900):
    deadline=time.time()+timeout; backoff=15
    while time.time()<deadline:
        build=codebuild.batch_get_builds(ids=[build_id])["builds"][0]
        s=build["buildStatus"]
        if s=="SUCCEEDED": return
        if s in("FAILED","FAULT","TIMED_OUT","STOPPED"): raise RuntimeError(f"Build {s}: {build_id}")
        time.sleep(backoff); backoff=min(backoff*1.5,60)
    raise TimeoutError("CodeBuild timed out.")

def send_welcome(email,first_name,org_name,account_id,sender):
    ses.send_email(Source=sender,Destination={"ToAddresses":[email]},Message={"Subject":{"Data":f"Your SecureBase environment is live, {first_name}!"},"Body":{"Text":{"Data":f"Hi {first_name},\n\nYour AWS landing zone for {org_name} is ready.\nAWS Account ID: {account_id}\n\nhttps://securebase.tximhotep.com/dashboard\n\n— SecureBase"}}})

def handler(event,context):
    job_id=event["jobId"]; customer_id=event["customerId"]; email=event["email"]
    org_name=event["orgName"]; aws_region=event["awsRegion"]
    mfa_enabled=event.get("mfaEnabled",True); guardrails_level=event.get("guardrailsLevel","standard")
    logger.info("Provisioner start: job=%s",job_id)
    pool_id=get_param("/securebase/cognito/user_pool_id")
    cb_project=get_param("/securebase/codebuild/project_name")
    ses_sender=get_param("/securebase/ses/from_address")
    update_job(job_id,"in_progress")
    update_step(job_id,"email_verified","in_progress")
    if not email_verified(email,pool_id):
        update_step(job_id,"email_verified","pending")
        return{"status":"waiting_for_email_verification"}
    update_step(job_id,"email_verified","completed")
    update_step(job_id,"account_created","in_progress")
    try:
        req_id=create_org_account(org_name); aws_account_id=wait_for_account(req_id)
    except Exception as e:
        update_step(job_id,"account_created","failed",str(e)); update_job(job_id,"failed")
        return{"status":"failed","step":"account_created","error":str(e)}
    update_step(job_id,"account_created","completed")
    update_step(job_id,"org_linked","in_progress")
    try: move_to_workloads_ou(aws_account_id)
    except Exception as e:
        update_step(job_id,"org_linked","failed",str(e)); update_job(job_id,"failed")
        return{"status":"failed","step":"org_linked","error":str(e)}
    update_step(job_id,"org_linked","completed")
    update_job(job_id,"in_progress",aws_account_id)
    db.execute_write("UPDATE customers SET aws_account_id=:a WHERE id=:c",{"a":aws_account_id,"c":customer_id})
    update_step(job_id,"terraform_applied","in_progress")
    try:
        build_id=trigger_terraform({"awsAccountId":aws_account_id,"orgName":org_name,"awsRegion":aws_region,"mfaEnabled":mfa_enabled,"guardrailsLevel":guardrails_level,"jobId":job_id},cb_project)
        wait_for_build(build_id)
    except Exception as e:
        update_step(job_id,"terraform_applied","failed",str(e)); update_job(job_id,"failed")
        return{"status":"failed","step":"terraform_applied","error":str(e)}
    update_step(job_id,"terraform_applied","completed")
    update_step(job_id,"guardrails_active","completed")
    update_step(job_id,"iam_roles_created","completed")
    update_step(job_id,"welcome_sent","in_progress")
    try:
        rows=db.execute("SELECT first_name FROM customers WHERE id=:c",{"c":customer_id})
        first_name=rows[0][0] if rows else "there"
        send_welcome(email,first_name,org_name,aws_account_id,ses_sender)
    except Exception as e: logger.warning("Welcome email (non-fatal): %s",e)
    update_step(job_id,"welcome_sent","completed")
    update_job(job_id,"completed",aws_account_id)
    db.execute_write("UPDATE customers SET onboarding_status='completed' WHERE id=:c",{"c":customer_id})
    logger.info("Complete: job=%s account=%s",job_id,aws_account_id)
    return{"status":"completed","awsAccountId":aws_account_id}
