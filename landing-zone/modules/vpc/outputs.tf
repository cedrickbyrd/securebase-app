# VPC Module Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.customer.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.customer.cidr_block
}

output "public_subnet_id" {
  description = "Public subnet ID"
  value       = aws_subnet.public.id
}

output "private_subnet_1a_id" {
  description = "Private subnet ID (AZ: us-east-1a)"
  value       = aws_subnet.private_1a.id
}

output "private_subnet_1b_id" {
  description = "Private subnet ID (AZ: us-east-1b)"
  value       = aws_subnet.private_1b.id
}

output "nat_gateway_id" {
  description = "NAT Gateway ID (if enabled)"
  value       = try(aws_nat_gateway.customer[0].id, null)
}

output "nat_gateway_eip" {
  description = "Elastic IP for NAT Gateway (if enabled)"
  value       = try(aws_eip.nat[0].public_ip, null)
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.customer.id
}

output "public_route_table_id" {
  description = "Public route table ID"
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "Private route table ID"
  value       = aws_route_table.private.id
}

output "vpc_flow_logs_log_group" {
  description = "CloudWatch Log Group for VPC Flow Logs (if enabled)"
  value       = try(aws_cloudwatch_log_group.vpc_flow_logs[0].name, null)
}

output "default_security_group_id" {
  description = "Default security group ID"
  value       = aws_security_group.default.id
}

output "healthcare_security_group_id" {
  description = "Healthcare (HIPAA) security group ID (if applicable)"
  value       = try(aws_security_group.healthcare[0].id, null)
}

output "fintech_security_group_id" {
  description = "Fintech (SOC2) security group ID (if applicable)"
  value       = try(aws_security_group.fintech[0].id, null)
}

output "govfed_security_group_id" {
  description = "Gov-Federal (FedRAMP) security group ID (if applicable)"
  value       = try(aws_security_group.govfed[0].id, null)
}

output "standard_security_group_id" {
  description = "Standard (CIS) security group ID (if applicable)"
  value       = try(aws_security_group.standard[0].id, null)
}

output "network_acl_id" {
  description = "Network ACL ID"
  value       = aws_network_acl.customer.id
}

output "customer_summary" {
  description = "Summary of customer VPC configuration"
  value = {
    customer_name   = var.customer_name
    framework       = var.customer_framework
    vpc_id          = aws_vpc.customer.id
    vpc_cidr        = aws_vpc.customer.cidr_block
    nat_gateway_ip  = try(aws_eip.nat[0].public_ip, "disabled")
    flow_logs_group = try(aws_cloudwatch_log_group.vpc_flow_logs[0].name, "disabled")
  }
}
