# ── DynamoDB Global Table replicas (us-west-2) ───────────────────────────────────────
# Prerequisites:
#   - Each source table must have DynamoDB Streams enabled (NEW_AND_OLD_IMAGES).
#   - Tables must use PAY_PER_REQUEST or have auto-scaling configured.
#
# KMS NOTE: kms_key_arn is intentionally omitted. The source tables use
# AWS-managed KMS keys (not customer-managed). DynamoDB requires all replicas
# use the same key type as the source. Specifying a CMK here would cause:
#   "All replica keys must either be Customer Managed CMK or AWS Managed CMK"

resource "aws_dynamodb_table_replica" "this" {
  for_each = toset(var.dynamodb_table_names)
  provider = aws.secondary

  global_table_arn = "arn:aws:dynamodb:${var.primary_region}:${data.aws_caller_identity.current.account_id}:table/${each.key}"

  tags = local.dr_tags
}
