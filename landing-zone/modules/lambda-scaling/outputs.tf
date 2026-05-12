output "provisioned_aliases" {
  description = "Provisioned concurrency aliases by logical function key"
  value = {
    for key, alias in aws_lambda_alias.high_traffic : key => alias.name
  }
}

output "provisioned_targets" {
  description = "Application Auto Scaling targets for provisioned concurrency"
  value = {
    for key, target in aws_appautoscaling_target.provisioned_concurrency : key => target.resource_id
  }
}
