# ── multi-region module locals ────────────────────────────────────────────
# data "aws_caller_identity" "current" is declared in data.tf

locals {
  effective_hosted_zone_id = coalesce(
    var.hosted_zone_id,
    var.route53_hosted_zone_id,
    "placeholder"
  )

  dr_tags = merge(var.tags, {
    Module      = "multi-region"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5.4-DR"
  })
}
