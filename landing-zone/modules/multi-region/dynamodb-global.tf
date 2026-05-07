# ── DynamoDB Global Table replicas (us-west-2) ───────────────────────────────
# Adds a secondary replica for each table listed in var.dynamodb_table_names.
# Prerequisites:
#   - Each source table must have DynamoDB Streams enabled (NEW_AND_OLD_IMAGES).
#   - Tables must use PAY_PER_REQUEST or have auto-scaling configured.
#   - aws_kms_key.secondary (aurora-global.tf) must be applied first.

resource "aws_dynamodb_table_replica" "this" {
  for_each = toset(var.dynamodb_table_names)
  provider = aws.secondary

  global_table_arn = "arn:aws:dynamodb:${var.primary_region}:${data.aws_caller_identity.current.account_id}:table/${each.key}"
  kms_key_arn      = aws_kms_key.secondary.arn

  tags = local.dr_tags
}
