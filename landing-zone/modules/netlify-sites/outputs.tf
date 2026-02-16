# Netlify Sites Module Outputs

# Marketing Site Outputs
output "marketing_site_url" {
  description = "Marketing site URL (custom domain)"
  value       = "tximhotep.com"
}

output "marketing_site_id" {
  description = "Marketing site Netlify ID"
  value       = data.netlify_site.marketing.id
}

output "marketing_deploy_url" {
  description = "Latest deploy URL for marketing site"
  value       = "https://tximhotep.com"
}

output "marketing_custom_domain" {
  description = "Custom domain for marketing site"
  value       = data.netlify_site.marketing.custom_domain
}

# Note: Build hooks are not managed by Terraform in provider v0.4.0
# Create build hooks manually in Netlify UI and store URLs securely

# Portal Demo Site Outputs
output "portal_demo_url" {
  description = "Portal demo site URL (custom domain)"
  value       = "demo.securebase.tximhotep.com"
}

output "portal_demo_site_id" {
  description = "Portal demo site Netlify ID"
  value       = data.netlify_site.portal_demo.id
}

output "portal_demo_deploy_url" {
  description = "Latest deploy URL for portal demo site"
  value       = "https://demo.securebase.tximhotep.com"
}

output "portal_demo_custom_domain" {
  description = "Custom domain for portal demo site"
  value       = data.netlify_site.portal_demo.custom_domain
}

# Government Demo (Placeholder - not deployed yet)
output "portal_demo_gov_url" {
  description = "Government demo site URL (placeholder - not deployed)"
  value       = "demo-gov.securebase.tximhotep.com"
}

# Summary Output
output "deployment_summary" {
  description = "Summary of Netlify deployments"
  value = {
    marketing_site = {
      netlify_url   = "https://tximhotep.com"
      custom_domain = data.netlify_site.marketing.custom_domain
      site_id       = data.netlify_site.marketing.id
      # Fallback: securebase-app.netlify.app
    }
    portal_demo = {
      netlify_url   = "https://demo.securebase.tximhotep.com"
      custom_domain = data.netlify_site.portal_demo.custom_domain
      site_id       = data.netlify_site.portal_demo.id
      # Fallback: securebase-demo.netlify.app
    }
    portal_demo_gov = {
      netlify_url   = "https://demo-gov.securebase.tximhotep.com"
      note          = "Placeholder - not deployed yet"
    }
  }
}
