# --- Organizations ---
import {
  to = module.securebase.aws_organizations_organization.this
  id = "o-hb7xe727j6"
}

# --- Core IAM Roles ---
import {
  to = module.securebase.module.lambda_functions.aws_iam_role.lambda_execution
  id = "securebase_lambda_exec_role"
}

import {
  to = module.securebase.module.identity.aws_iam_role.aws_config_role
  id = "AWSConfigRole"
}

# --- SSO Permission Sets (format: instance_arn,permission_set_arn) ---
#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.admin
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72235b13cf3c097f"
#}

#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.platform
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-7223eb9cc84c17a6"
#}

#import {
#  to = module.securebase.module.identity.aws_ssoadmin_permission_set.auditor
#  id = "arn:aws:sso:::instance/ssoins-7223295e77f4f12d,arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72234a6b73040d95"
#}
