# Netlify Terraform Example Configuration
#
# This file demonstrates how to use the Netlify sites module in different scenarios.
# Copy and adapt these examples to your specific needs.

# ============================================================================
# Example 1: Basic Usage (Development)
# ============================================================================

provider "netlify" {
  # Token from environment variable TF_VAR_netlify_token
  token = var.netlify_token
}

module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
  
  tags = {
    Project     = "SecureBase"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

# ============================================================================
# Example 2: Using AWS Secrets Manager for Token
# ============================================================================

# Fetch Netlify token from AWS Secrets Manager
data "aws_secretsmanager_secret" "netlify_token" {
  name = "netlify-api-token"
}

data "aws_secretsmanager_secret_version" "netlify_token" {
  secret_id = data.aws_secretsmanager_secret.netlify_token.id
}

locals {
  netlify_token = data.aws_secretsmanager_secret_version.netlify_token.secret_string
}

provider "netlify" {
  token = local.netlify_token
}

module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = local.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
}

# ============================================================================
# Example 3: Multiple Environments
# ============================================================================

# Development environment
module "netlify_sites_dev" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "dev.securebase.io"
  portal_demo_domain  = "portal-dev.securebase.io"
  
  tags = {
    Environment = "development"
  }
}

# Staging environment
module "netlify_sites_staging" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "staging.securebase.io"
  portal_demo_domain  = "portal-staging.securebase.io"
  
  tags = {
    Environment = "staging"
  }
}

# Production environment
module "netlify_sites_prod" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  github_owner        = "cedrickbyrd"
  github_repo         = "securebase-app"
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal.securebase.io"
  
  tags = {
    Environment = "production"
  }
}

# ============================================================================
# Example 4: With Automated DNS (Route 53)
# ============================================================================

# Get existing hosted zone
data "aws_route53_zone" "main" {
  name = "securebase.io"
}

# Deploy Netlify sites
module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
}

# Configure DNS for marketing site (apex domain)
resource "aws_route53_record" "marketing" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "securebase.io"
  type    = "A"
  ttl     = 300
  records = ["75.2.60.5"]  # Netlify load balancer IP
}

# Configure DNS for portal demo (subdomain)
resource "aws_route53_record" "portal_demo" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "portal-demo.securebase.io"
  type    = "CNAME"
  ttl     = 300
  records = [module.netlify_sites.portal_demo_url]
}

# ============================================================================
# Example 5: With Monitoring and Alerts
# ============================================================================

module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
}

# SNS topic for alerts
resource "aws_sns_topic" "netlify_alerts" {
  name = "netlify-deployment-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.netlify_alerts.arn
  protocol  = "email"
  endpoint  = "ops@securebase.io"
}

# CloudWatch alarm for marketing site
resource "aws_cloudwatch_metric_alarm" "marketing_site_down" {
  alarm_name          = "netlify-marketing-site-down"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Marketing site (securebase.io) is down"
  alarm_actions       = [aws_sns_topic.netlify_alerts.arn]
  
  dimensions = {
    HealthCheckId = aws_route53_health_check.marketing.id
  }
}

# Health check for marketing site
resource "aws_route53_health_check" "marketing" {
  fqdn              = "securebase.io"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30
  
  tags = {
    Name = "securebase-marketing-health"
  }
}

# ============================================================================
# Example 6: Outputs Usage
# ============================================================================

# Access individual outputs
output "marketing_site_url" {
  value = module.netlify_sites.marketing_site_url
}

output "marketing_site_id" {
  value = module.netlify_sites.marketing_site_id
}

output "portal_demo_url" {
  value = module.netlify_sites.portal_demo_url
}

# Access summary output
output "netlify_summary" {
  value = module.netlify_sites.deployment_summary
}

# Access build hooks (sensitive)
output "marketing_build_hook" {
  value     = module.netlify_sites.marketing_build_hook_url
  sensitive = true
}

# ============================================================================
# Example 7: Import Existing Sites
# ============================================================================

# Step 1: Define the module (as above)
module "netlify_sites" {
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
}

# Step 2: Import existing sites (run in terminal)
# terraform import 'module.netlify_sites.netlify_site.marketing' <marketing-site-id>
# terraform import 'module.netlify_sites.netlify_site.portal_demo' <portal-demo-site-id>

# Step 3: Import environment variables (if using netlify_env_var resources)
# terraform import 'module.netlify_sites.netlify_env_var.marketing_node_version' <site-id>:<env-var-key>

# Step 4: Verify import
# terraform plan -target=module.netlify_sites
# Should show "No changes" if configuration matches

# ============================================================================
# Example 8: Conditional Deployment
# ============================================================================

# Only deploy Netlify sites if token is provided
module "netlify_sites" {
  count = var.netlify_token != "" ? 1 : 0
  
  source = "../../modules/netlify-sites"
  
  netlify_token       = var.netlify_token
  marketing_domain    = "securebase.io"
  portal_demo_domain  = "portal-demo.securebase.io"
}

# ============================================================================
# Example 9: Using with CI/CD
# ============================================================================

# In your CI/CD pipeline, set the token as an environment variable:
# 
# GitHub Actions:
# env:
#   TF_VAR_netlify_token: ${{ secrets.NETLIFY_API_TOKEN }}
#
# GitLab CI:
# variables:
#   TF_VAR_netlify_token: $NETLIFY_API_TOKEN
#
# Then run:
# terraform init
# terraform plan -target=module.netlify_sites
# terraform apply -target=module.netlify_sites -auto-approve

# ============================================================================
# Example 10: Triggering Manual Builds via Build Hooks
# ============================================================================

# Get build hook URLs
data "terraform_remote_state" "netlify" {
  backend = "local"
  
  config = {
    path = "terraform.tfstate"
  }
}

# Use in scripts or CI/CD
# curl -X POST "${data.terraform_remote_state.netlify.outputs.marketing_build_hook_url}"

# Or create a null_resource to trigger on demand
resource "null_resource" "trigger_marketing_deploy" {
  triggers = {
    timestamp = timestamp()
  }
  
  provisioner "local-exec" {
    command = "curl -X POST ${module.netlify_sites.marketing_build_hook_url}"
  }
}
