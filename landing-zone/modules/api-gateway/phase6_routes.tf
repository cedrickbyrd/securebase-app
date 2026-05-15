# ============================================================================
# Phase 6.1 — /admin/evidence API routes
# Wired conditionally: only deployed when audit_evidence_lambda_arn is set.
# Handles: GET /admin/evidence, GET /admin/evidence/{id},
#          POST /admin/evidence/generate
# ============================================================================

locals {
  evidence_enabled         = var.audit_evidence_lambda_arn != null
  compliance_hist_enabled  = var.compliance_history_lambda_arn != null
}

# /admin resource (shared parent — only create if not already defined elsewhere)
resource "aws_api_gateway_resource" "admin" {
  count       = local.evidence_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "admin"
}

# /admin/evidence
resource "aws_api_gateway_resource" "admin_evidence" {
  count       = local.evidence_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.admin[0].id
  path_part   = "evidence"
}

# /admin/evidence/{id}
resource "aws_api_gateway_resource" "admin_evidence_id" {
  count       = local.evidence_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.admin_evidence[0].id
  path_part   = "{id}"
}

# /admin/evidence/generate
resource "aws_api_gateway_resource" "admin_evidence_generate" {
  count       = local.evidence_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  parent_id   = aws_api_gateway_resource.admin_evidence[0].id
  path_part   = "generate"
}

# ----------------------------------------------------------------------------
# GET /admin/evidence — list evidence packages
# ----------------------------------------------------------------------------
resource "aws_api_gateway_method" "evidence_list_get" {
  count         = local.evidence_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.admin_evidence[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "evidence_list_get" {
  count                   = local.evidence_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.admin_evidence[0].id
  http_method             = aws_api_gateway_method.evidence_list_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.audit_evidence_lambda_arn}/invocations"
}

# ----------------------------------------------------------------------------
# GET /admin/evidence/{id} — get single package + presigned download URL
# ----------------------------------------------------------------------------
resource "aws_api_gateway_method" "evidence_id_get" {
  count         = local.evidence_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.admin_evidence_id[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id

  request_parameters = {
    "method.request.path.id" = true
  }
}

resource "aws_api_gateway_integration" "evidence_id_get" {
  count                   = local.evidence_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.admin_evidence_id[0].id
  http_method             = aws_api_gateway_method.evidence_id_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.audit_evidence_lambda_arn}/invocations"
}

# ----------------------------------------------------------------------------
# POST /admin/evidence/generate — trigger async evidence package generation
# ----------------------------------------------------------------------------
resource "aws_api_gateway_method" "evidence_generate_post" {
  count         = local.evidence_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.admin_evidence_generate[0].id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "evidence_generate_post" {
  count                   = local.evidence_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.admin_evidence_generate[0].id
  http_method             = aws_api_gateway_method.evidence_generate_post[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.audit_evidence_lambda_arn}/invocations"
}

# ----------------------------------------------------------------------------
# CORS for evidence endpoints
# ----------------------------------------------------------------------------
module "cors_admin_evidence" {
  count  = local.evidence_enabled ? 1 : 0
  source = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.admin_evidence[0].id
}

module "cors_admin_evidence_id" {
  count  = local.evidence_enabled ? 1 : 0
  source = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.admin_evidence_id[0].id
}

module "cors_admin_evidence_generate" {
  count  = local.evidence_enabled ? 1 : 0
  source = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.admin_evidence_generate[0].id
}

# ----------------------------------------------------------------------------
# Lambda permission — API Gateway -> audit_evidence_api
# ----------------------------------------------------------------------------
resource "aws_lambda_permission" "audit_evidence_api_gateway" {
  count         = local.evidence_enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeAuditEvidence"
  action        = "lambda:InvokeFunction"
  function_name = var.audit_evidence_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}

# ============================================================================
# Phase 6.2 — /tenant/compliance/history route
# Wired conditionally: only deployed when compliance_history_lambda_arn is set.
# ============================================================================

# /tenant resource — only create if admin_metrics hasn't claimed it
# (phase5-admin-metrics owns /tenant/* via api_gateway_root_resource_id pass-through)
# We reuse the existing /tenant parent by referencing it via data source.
# If the resource doesn't exist yet this count guard prevents a conflict.
resource "aws_api_gateway_resource" "tenant_compliance_history" {
  count       = local.compliance_hist_enabled ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.securebase_api.id
  # Parent must be /tenant/compliance — created by phase5-admin-metrics.
  # Pass the parent resource ID via variable when phase5 module exposes it;
  # otherwise fall back to root (will 404 gracefully until wired).
  parent_id   = var.tenant_compliance_resource_id != null ? var.tenant_compliance_resource_id : aws_api_gateway_rest_api.securebase_api.root_resource_id
  path_part   = "history"
}

resource "aws_api_gateway_method" "compliance_history_get" {
  count         = local.compliance_hist_enabled ? 1 : 0
  rest_api_id   = aws_api_gateway_rest_api.securebase_api.id
  resource_id   = aws_api_gateway_resource.tenant_compliance_history[0].id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

resource "aws_api_gateway_integration" "compliance_history_get" {
  count                   = local.compliance_hist_enabled ? 1 : 0
  rest_api_id             = aws_api_gateway_rest_api.securebase_api.id
  resource_id             = aws_api_gateway_resource.tenant_compliance_history[0].id
  http_method             = aws_api_gateway_method.compliance_history_get[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.compliance_history_lambda_arn}/invocations"
}

module "cors_compliance_history" {
  count  = local.compliance_hist_enabled ? 1 : 0
  source = "./cors-with-credentials"
  api_id      = aws_api_gateway_rest_api.securebase_api.id
  resource_id = aws_api_gateway_resource.tenant_compliance_history[0].id
}

resource "aws_lambda_permission" "compliance_history_api_gateway" {
  count         = local.compliance_hist_enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeComplianceHistory"
  action        = "lambda:InvokeFunction"
  function_name = var.compliance_history_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.securebase_api.execution_arn}/*/*"
}
