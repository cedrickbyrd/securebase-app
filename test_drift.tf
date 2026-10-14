resource "aws_s3_bucket" "audit_test_bucket" {
  bucket = "securebase-audit-test-bucket-dev"
  
  # Object lock disabled intentionally to test FFIEC/HIPAA shift-left detection
  object_lock_enabled = false
}
