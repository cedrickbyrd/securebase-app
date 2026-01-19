# SecureBase VPC Module - Per-Customer Network Isolation
# Provisions dedicated VPC, subnets, NAT gateways, and Flow Logs per customer

terraform {
  required_version = ">= 1.5.0"
}

# ============================================
# VPC Core Resources
# ============================================

resource "aws_vpc" "customer" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = var.vpc_config.dns_hostnames
  enable_dns_support   = var.vpc_config.dns_support

  tags = merge(
    var.tags,
    {
      Name        = "${var.customer_name}-vpc"
      Customer    = var.customer_name
      Framework   = var.customer_framework
    }
  )
}

# ============================================
# Internet Gateway (for public access)
# ============================================

resource "aws_internet_gateway" "customer" {
  vpc_id = aws_vpc.customer.id

  tags = merge(
    var.tags,
    {
      Name     = "${var.customer_name}-igw"
      Customer = var.customer_name
    }
  )
}

# ============================================
# Subnets (1 Public, 2 Private Multi-AZ)
# ============================================

# Public Subnet (for NAT Gateway, ALB, etc.)
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.customer.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-public-1a"
      Type    = "Public"
      Customer = var.customer_name
    }
  )
}

# Private Subnet 1 (AZ: us-east-1a)
resource "aws_subnet" "private_1a" {
  vpc_id            = aws_vpc.customer.id
  cidr_block        = var.private_subnet_1a_cidr
  availability_zone = "${var.region}a"

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-private-1a"
      Type    = "Private"
      Customer = var.customer_name
    }
  )
}

# Private Subnet 2 (AZ: us-east-1b) - For HA
resource "aws_subnet" "private_1b" {
  vpc_id            = aws_vpc.customer.id
  cidr_block        = var.private_subnet_1b_cidr
  availability_zone = "${var.region}b"

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-private-1b"
      Type    = "Private"
      Customer = var.customer_name
    }
  )
}

# ============================================
# Elastic IP for NAT Gateway
# ============================================

resource "aws_eip" "nat" {
  count  = var.vpc_config.enable_nat_gateway ? 1 : 0
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name     = "${var.customer_name}-nat-eip"
      Customer = var.customer_name
    }
  )

  depends_on = [aws_internet_gateway.customer]
}

# ============================================
# NAT Gateway (for private subnet egress)
# ============================================

resource "aws_nat_gateway" "customer" {
  count         = var.vpc_config.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public.id

  tags = merge(
    var.tags,
    {
      Name     = "${var.customer_name}-nat"
      Customer = var.customer_name
    }
  )

  depends_on = [aws_internet_gateway.customer]
}

# ============================================
# Route Tables
# ============================================

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.customer.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.customer.id
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-public-rt"
      Type    = "Public"
      Customer = var.customer_name
    }
  )
}

# Private Route Table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.customer.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.vpc_config.enable_nat_gateway ? aws_nat_gateway.customer[0].id : null
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-private-rt"
      Type    = "Private"
      Customer = var.customer_name
    }
  )
}

# ============================================
# Route Table Associations
# ============================================

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_1b" {
  subnet_id      = aws_subnet.private_1b.id
  route_table_id = aws_route_table.private.id
}

# ============================================
# VPC Flow Logs (CloudWatch)
# ============================================

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  count             = var.vpc_config.enable_vpc_flow_logs ? 1 : 0
  name              = "/aws/vpc/flowlogs/${var.customer_name}"
  retention_in_days = var.vpc_flow_logs_retention_days

  tags = merge(
    var.tags,
    {
      Customer = var.customer_name
    }
  )
}

resource "aws_iam_role" "vpc_flow_logs" {
  count = var.vpc_config.enable_vpc_flow_logs ? 1 : 0
  name  = "${var.customer_name}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Customer = var.customer_name
    }
  )
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  count = var.vpc_config.enable_vpc_flow_logs ? 1 : 0
  name  = "${var.customer_name}-vpc-flow-logs-policy"
  role  = aws_iam_role.vpc_flow_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = aws_cloudwatch_log_group.vpc_flow_logs[0].arn
      }
    ]
  })
}

resource "aws_flow_log" "vpc" {
  count                   = var.vpc_config.enable_vpc_flow_logs ? 1 : 0
  iam_role_arn            = aws_iam_role.vpc_flow_logs[0].arn
  log_destination         = aws_cloudwatch_log_group.vpc_flow_logs[0].arn
  traffic_type            = "ALL"
  vpc_id                  = aws_vpc.customer.id
  log_destination_type    = "cloud-watch-logs"

  tags = merge(
    var.tags,
    {
      Customer = var.customer_name
    }
  )

  depends_on = [aws_iam_role_policy.vpc_flow_logs]
}

# ============================================
# Network ACLs (Layer 3 Firewall)
# ============================================

resource "aws_network_acl" "customer" {
  vpc_id = aws_vpc.customer.id

  # Allow all traffic by default (security groups enforce layer 4)
  ingress {
    protocol   = "-1"  # All protocols
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-nacl"
      Customer = var.customer_name
    }
  )
}

# ============================================
# Default Security Group (Baseline)
# ============================================

resource "aws_security_group" "default" {
  name_prefix = "${var.customer_name}-default-"
  description = "Default security group for ${var.customer_name}"
  vpc_id      = aws_vpc.customer.id

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Allow all TCP from VPC CIDR"
  }

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
    description = "Allow all UDP from VPC CIDR"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.customer_name}-default-sg"
      Customer = var.customer_name
    }
  )
}

# ============================================
# Tier-Specific Security Groups
# ============================================

# Healthcare: HIPAA-compliant security group
resource "aws_security_group" "healthcare" {
  count       = var.customer_framework == "hipaa" ? 1 : 0
  name_prefix = "${var.customer_name}-hipaa-"
  description = "HIPAA-compliant security group for ${var.customer_name}"
  vpc_id      = aws_vpc.customer.id

  # Allow HTTPS only (TLS 1.2+)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  tags = merge(
    var.tags,
    {
      Name      = "${var.customer_name}-hipaa-sg"
      Framework = "HIPAA"
      Customer  = var.customer_name
    }
  )
}

# Fintech: SOC2-compliant security group
resource "aws_security_group" "fintech" {
  count       = var.customer_framework == "soc2" ? 1 : 0
  name_prefix = "${var.customer_name}-soc2-"
  description = "SOC2-compliant security group for ${var.customer_name}"
  vpc_id      = aws_vpc.customer.id

  # Allow HTTPS and SSH (bastion only)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "SSH from VPC (bastion only)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = merge(
    var.tags,
    {
      Name      = "${var.customer_name}-soc2-sg"
      Framework = "SOC2"
      Customer  = var.customer_name
    }
  )
}

# Gov-Federal: FedRAMP-compliant security group
resource "aws_security_group" "govfed" {
  count       = var.customer_framework == "fedramp" ? 1 : 0
  name_prefix = "${var.customer_name}-fedramp-"
  description = "FedRAMP-compliant security group for ${var.customer_name}"
  vpc_id      = aws_vpc.customer.id

  # Strict: HTTPS only, no direct SSH
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  tags = merge(
    var.tags,
    {
      Name      = "${var.customer_name}-fedramp-sg"
      Framework = "FedRAMP"
      Customer  = var.customer_name
    }
  )
}

# Standard: CIS Benchmark compliant security group
resource "aws_security_group" "standard" {
  count       = var.customer_framework == "cis" ? 1 : 0
  name_prefix = "${var.customer_name}-cis-"
  description = "CIS Benchmark compliant security group for ${var.customer_name}"
  vpc_id      = aws_vpc.customer.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = merge(
    var.tags,
    {
      Name      = "${var.customer_name}-cis-sg"
      Framework = "CIS"
      Customer  = var.customer_name
    }
  )
}
