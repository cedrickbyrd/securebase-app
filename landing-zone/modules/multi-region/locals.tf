# ── multi-region module locals ────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

locals {
  # Effective hosted zone ID — support both variable names
  effective_hosted_zone_id = coalesce(
    var.hosted_zone_id,
    var.route53_hosted_zone_id,
    "placeholder"
  )

  # Standard tags applied to every DR resource
  dr_tags = merge(var.tags, {
    Module      = "multi-region"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5.3-DR"
  })
}
