# SecureBase customer-baseline Terraform module
# Called by CodeBuild per-customer with variable overrides.
terraform {
  required_version = ">= 1.6"
  required_providers { aws = { source="hashicorp/aws" version="~> 5.0" } }
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
  assume_role { role_arn = "arn:aws:iam::${var.customer_account_id}:role/${var.baseline_role_name}" }
  default_tags { tags = local.common_tags }
}

variable "customer_account_id" { type=string validation { condition=can(regex("^[0-9]{12}$",var.customer_account_id)) error_message="Must be 12 digits." } }
variable "customer_name"       { type=string }
variable "aws_region"          { type=string default="us-east-1" }
variable "mfa_enabled"         { type=bool   default=true }
variable "guardrails_level"    { type=string default="standard" validation { condition=contains(["standard","enhanced","sovereign"],var.guardrails_level) error_message="Must be standard, enhanced, or sovereign." } }
variable "job_id"              { type=string }
variable "vpc_cidr"            { type=string default="10.0.0.0/16" }
variable "baseline_role_name"  { type=string default="SecureBaseBaselineRole" }
variable "securebase_control_plane_role_arn" { type=string }

locals {
  name_prefix = "securebase-${lower(replace(var.customer_name," ","-"))}"
  common_tags = { ManagedBy="SecureBase-Terraform" CustomerAccountId=var.customer_account_id CustomerName=var.customer_name GuardrailsLevel=var.guardrails_level JobId=var.job_id Environment="production" }
  azs = ["${var.aws_region}a","${var.aws_region}b"]
}

resource "aws_vpc" "main" { cidr_block=var.vpc_cidr enable_dns_support=true enable_dns_hostnames=true tags={Name="${local.name_prefix}-vpc"} }
resource "aws_internet_gateway" "main" { vpc_id=aws_vpc.main.id tags={Name="${local.name_prefix}-igw"} }
resource "aws_subnet" "public"   { count=2 vpc_id=aws_vpc.main.id cidr_block=cidrsubnet(var.vpc_cidr,4,count.index)   availability_zone=local.azs[count.index] tags={Name="${local.name_prefix}-public-${count.index+1}" Tier="public"} }
resource "aws_subnet" "private"  { count=2 vpc_id=aws_vpc.main.id cidr_block=cidrsubnet(var.vpc_cidr,4,count.index+4) availability_zone=local.azs[count.index] tags={Name="${local.name_prefix}-private-${count.index+1}" Tier="private"} }
resource "aws_eip" "nat"         { domain="vpc" tags={Name="${local.name_prefix}-nat-eip"} }
resource "aws_nat_gateway" "main" { allocation_id=aws_eip.nat.id subnet_id=aws_subnet.public[0].id tags={Name="${local.name_prefix}-natgw"} depends_on=[aws_internet_gateway.main] }
resource "aws_route_table" "public"  { vpc_id=aws_vpc.main.id route { cidr_block="0.0.0.0/0" gateway_id=aws_internet_gateway.main.id } tags={Name="${local.name_prefix}-rt-public"} }
resource "aws_route_table" "private" { vpc_id=aws_vpc.main.id route { cidr_block="0.0.0.0/0" nat_gateway_id=aws_nat_gateway.main.id } tags={Name="${local.name_prefix}-rt-private"} }
resource "aws_route_table_association" "public"  { count=2 subnet_id=aws_subnet.public[count.index].id  route_table_id=aws_route_table.public.id }
resource "aws_route_table_association" "private" { count=2 subnet_id=aws_subnet.private[count.index].id route_table_id=aws_route_table.private.id }

resource "aws_s3_account_public_access_block" "main" { block_public_acls=true block_public_policy=true ignore_public_acls=true restrict_public_buckets=true }
resource "aws_ebs_encryption_by_default" "main" { enabled=true }
resource "aws_kms_key" "default" { description="${local.name_prefix} default encryption key" deletion_window_in_days=30 enable_key_rotation=true }
resource "aws_kms_alias" "default" { name="alias/${local.name_prefix}-default" target_key_id=aws_kms_key.default.key_id }
resource "aws_iam_account_password_policy" "main" { minimum_password_length=14 require_lowercase_characters=true require_uppercase_characters=true require_numbers=true require_symbols=true allow_users_to_change_password=true max_password_age=90 password_reuse_prevention=12 }

resource "aws_cloudtrail" "main" { name="${local.name_prefix}-trail" s3_bucket_name="securebase-cloudtrail-${var.customer_account_id}" include_global_service_events=true is_multi_region_trail=true enable_log_file_validation=true kms_key_id=aws_kms_key.default.arn }

resource "aws_iam_role" "securebase_access" {
  name="SecureBaseControlPlaneAccess"
  assume_role_policy=jsonencode({Version="2012-10-17" Statement=[{Effect="Allow" Principal={AWS=var.securebase_control_plane_role_arn} Action="sts:AssumeRole" Condition={StringEquals={"sts:ExternalId"=var.job_id}}}]})
}
resource "aws_iam_role_policy_attachment" "securebase_readonly" { role=aws_iam_role.securebase_access.name policy_arn="arn:aws:iam::aws:policy/SecurityAudit" }

resource "aws_guardduty_detector" "main" { count=var.guardrails_level!="standard"?1:0 enable=true }
resource "aws_securityhub_account" "main" { count=var.guardrails_level!="standard"?1:0 enable_default_standards=true }
resource "aws_macie2_account" "main" { count=var.guardrails_level=="sovereign"?1:0 status="ENABLED" }

output "vpc_id"                      { value=aws_vpc.main.id }
output "private_subnet_ids"          { value=aws_subnet.private[*].id }
output "kms_key_arn"                 { value=aws_kms_key.default.arn }
output "securebase_access_role_arn"  { value=aws_iam_role.securebase_access.arn }
output "customer_account_id"         { value=var.customer_account_id }
output "job_id"                      { value=var.job_id }
