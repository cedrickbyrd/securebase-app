# VPC Module Variables

variable "customer_name" {
  description = "Customer identifier (e.g., acme, medicorp)"
  type        = string
}

variable "customer_framework" {
  description = "Compliance framework (cis, hipaa, soc2, fedramp)"
  type        = string
  
  validation {
    condition     = contains(["cis", "hipaa", "soc2", "fedramp"], var.customer_framework)
    error_message = "Framework must be: cis, hipaa, soc2, or fedramp"
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC (e.g., 10.1.0.0/16)"
  type        = string
  
  validation {
    condition     = can(regex("^10\\.[0-9]{1,3}\\.0\\.0/16$", var.vpc_cidr))
    error_message = "VPC CIDR must follow pattern 10.X.0.0/16"
  }
}

variable "public_subnet_cidr" {
  description = "CIDR for public subnet (e.g., 10.1.0.0/24)"
  type        = string
  default     = ""
}

variable "private_subnet_1a_cidr" {
  description = "CIDR for private subnet in AZ a (e.g., 10.1.1.0/24)"
  type        = string
  default     = ""
}

variable "private_subnet_1b_cidr" {
  description = "CIDR for private subnet in AZ b (e.g., 10.1.2.0/24)"
  type        = string
  default     = ""
}

variable "vpc_config" {
  description = "VPC configuration options"
  type = object({
    enable_nat_gateway    = bool
    enable_vpn_gateway    = bool
    enable_vpc_flow_logs  = bool
    dns_hostnames         = bool
    dns_support           = bool
  })
  
  default = {
    enable_nat_gateway   = true
    enable_vpn_gateway   = false
    enable_vpc_flow_logs = true
    dns_hostnames        = true
    dns_support          = true
  }
}

variable "vpc_flow_logs_retention_days" {
  description = "CloudWatch Logs retention for VPC Flow Logs"
  type        = number
  default     = 30
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
