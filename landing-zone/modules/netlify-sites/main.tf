# Netlify Sites Module
# Manages Netlify deployments for marketing site and portal demo

terraform {
  required_providers {
    netlify = {
      source  = "netlify/netlify"
      version = "~> 1.0"
    }
  }
}

# ============================================================================
# Marketing Site (securebase.io)
# ============================================================================

resource "netlify_site" "marketing" {
  name = "securebase-marketing"

  repo {
    repo_branch   = "main"
    command       = "npm run build"
    deploy_key_id = netlify_deploy_key.marketing.id
    dir           = "dist"
    provider      = "github"
    repo_path     = "${var.github_owner}/${var.github_repo}"
  }
}

resource "netlify_deploy_key" "marketing" {
  # Netlify will generate a deploy key automatically
}

resource "netlify_build_settings" "marketing" {
  site_id = netlify_site.marketing.id

  build_command      = "npm run build"
  publish_directory  = "dist"
  production_branch  = "main"

  environment = {
    NODE_VERSION = "22"
    VITE_ENV     = "production"
  }
}

resource "netlify_site_domain" "marketing" {
  site_id = netlify_site.marketing.id
  domain  = var.marketing_domain
}

# ============================================================================
# Portal Demo Site (portal-demo.securebase.io)
# ============================================================================

resource "netlify_site" "portal_demo" {
  name = "securebase-portal-demo"

  repo {
    repo_branch   = "main"
    command       = "cd phase3a-portal && npm run build"
    deploy_key_id = netlify_deploy_key.portal_demo.id
    dir           = "phase3a-portal/dist"
    provider      = "github"
    repo_path     = "${var.github_owner}/${var.github_repo}"
  }
}

resource "netlify_deploy_key" "portal_demo" {
  # Netlify will generate a deploy key automatically
}

resource "netlify_build_settings" "portal_demo" {
  site_id = netlify_site.portal_demo.id

  build_command      = "cd phase3a-portal && npm run build"
  publish_directory  = "phase3a-portal/dist"
  production_branch  = "main"

  environment = {
    NODE_VERSION            = "22"
    VITE_USE_MOCK_API       = "true"
    VITE_ENV                = "demo"
    VITE_ANALYTICS_ENABLED  = "false"
  }
}

resource "netlify_site_domain" "portal_demo" {
  site_id = netlify_site.portal_demo.id
  domain  = var.portal_demo_domain
}

# ============================================================================
# Build Hooks for Manual Deployments
# ============================================================================

resource "netlify_build_hook" "marketing_manual" {
  site_id = netlify_site.marketing.id
  branch  = "main"
  title   = "Manual Deploy - Marketing Site"
}

resource "netlify_build_hook" "portal_demo_manual" {
  site_id = netlify_site.portal_demo.id
  branch  = "main"
  title   = "Manual Deploy - Portal Demo"
}
