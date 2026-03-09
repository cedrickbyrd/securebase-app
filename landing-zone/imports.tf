# --- Organizations ---
import {
  to = aws_organizations_organization.this
  id = "o-hb7xe727j6"
}

# --- Core IAM Roles ---
import {
  to = aws_iam_role.lambda_exec
  id = "securebase_lambda_exec_role"
}

import {
  to = module.identity.aws_iam_role.aws_config_role
  id = "AWSConfigRole"
}

# --- SSO Permission Sets ---

# Assuming ps-72235b13cf3c097f is Admin
import {
  to = module.identity.aws_ssoadmin_permission_set.admin
  id = "arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72235b13cf3c097f,arn:aws:sso:::instance/ssoins-7223295e77f4f12d"
}

# Assuming ps-7223eb9cc84c17a6 is Platform
import {
  to = module.identity.aws_ssoadmin_permission_set.platform
  id = "arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-7223eb9cc84c17a6,arn:aws:sso:::instance/ssoins-7223295e77f4f12d"
}

# Assuming ps-72234a6b73040d95 is Auditor (NERC Compliance)
import {
  to = module.identity.aws_ssoadmin_permission_set.auditor
  id = "arn:aws:sso:::permissionSet/ssoins-7223295e77f4f12d/ps-72234a6b73040d95,arn:aws:sso:::instance/ssoins-7223295e77f4f12d"
}
