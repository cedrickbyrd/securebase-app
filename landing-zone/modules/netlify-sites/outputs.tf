# Netlify Sites Module Outputs

# Marketing Site Outputs
output "marketing_site_url" {
  description = "Marketing site URL (primary Netlify URL)"
  value       = netlify_site.marketing.default_domain
}

output "marketing_site_id" {
  description = "Marketing site Netlify ID"
  value       = netlify_site.marketing.id
}

output "marketing_deploy_url" {
  description = "Latest deploy URL for marketing site"
  value       = "https://${netlify_site.marketing.default_domain}"
}

output "marketing_custom_domain" {
  description = "Custom domain for marketing site"
  value       = netlify_site.marketing.custom_domain
}

output "marketing_build_hook_url" {
  description = "Build hook URL for manual marketing site deployments"
  value       = netlify_build_hook.marketing_manual.url
  sensitive   = true
}

# Portal Demo Site Outputs
output "portal_demo_url" {
  description = "Portal demo site URL (primary Netlify URL)"
  value       = netlify_site.portal_demo.default_domain
}

output "portal_demo_site_id" {
  description = "Portal demo site Netlify ID"
  value       = netlify_site.portal_demo.id
}

output "portal_demo_deploy_url" {
  description = "Latest deploy URL for portal demo site"
  value       = "https://${netlify_site.portal_demo.default_domain}"
}

output "portal_demo_custom_domain" {
  description = "Custom domain for portal demo site"
  value       = netlify_site.portal_demo.custom_domain
}

output "portal_demo_build_hook_url" {
  description = "Build hook URL for manual portal demo deployments"
  value       = netlify_build_hook.portal_demo_manual.url
  sensitive   = true
}

# Summary Output
output "deployment_summary" {
  description = "Summary of Netlify deployments"
  value = {
    marketing_site = {
      netlify_url   = "https://${netlify_site.marketing.default_domain}"
      custom_domain = netlify_site.marketing.custom_domain
      site_id       = netlify_site.marketing.id
    }
    portal_demo = {
      netlify_url   = "https://${netlify_site.portal_demo.default_domain}"
      custom_domain = netlify_site.portal_demo.custom_domain
      site_id       = netlify_site.portal_demo.id
    }
  }
}
