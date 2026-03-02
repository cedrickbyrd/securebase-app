resource "aws_cloudwatch_dashboard" "sre_dashboard" {
  dashboard_name = "sre-operations-dashboard"
  dashboard_body = file("${path.module}/../../cloudwatch_dashboard.json")
}
