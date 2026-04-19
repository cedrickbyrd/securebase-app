# Pilot Slots DynamoDB Table
# Tracks available and claimed spots for each pilot SKU.
#
# Partition Key:  sku           (String) — e.g. "pilot_compliance"
# Attributes:
#   slots_total   (Number) — maximum seats available for this SKU
#   slots_claimed (Number) — seats already purchased (incremented by Stripe webhook)
#   updated_at    (String) — ISO-8601 timestamp of last mutation
#
# Seed (performed outside Terraform via the AWS CLI / seed script):
#   aws dynamodb put-item \
#     --table-name securebase-pilot-slots \
#     --item '{"sku":{"S":"pilot_compliance"},"slots_total":{"N":"5"},"slots_claimed":{"N":"0"}}'

resource "aws_dynamodb_table" "pilot_slots" {
  name         = "securebase-pilot-slots"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sku"

  attribute {
    name = "sku"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name                = "securebase-pilot-slots"
    Environment         = "production"
    ComplianceFramework = "SOC2"
    DataClassification  = "internal"
    ManagedBy           = "terraform"
    Component           = "PilotProgram"
    Phase               = "5.3"
  }
}
