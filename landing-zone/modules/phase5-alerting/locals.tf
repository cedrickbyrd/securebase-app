locals {
  common_tags = merge(var.tags, {
    Phase   = "5.3"
    Module  = "phase5-alerting"
  })
}
