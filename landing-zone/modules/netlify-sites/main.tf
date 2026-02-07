# Netlify Sites Module
# Manages Netlify deployments for marketing site and portal demo
#
# IMPORTANT: This configuration is based on Netlify Terraform provider ~> 1.0.
# The actual resource schema may vary. Please consult the official provider docs:
# https://registry.terraform.io/providers/netlify/netlify/latest/docs
# 
# You may need to adjust resource names and attributes based on the provider version.
# Common adjustments needed:
# - Resource names (netlify_site, netlify_build_settings, netlify_env_var, etc.)
# - Attribute names within resources
# - Block structure (repo, environment, etc.)
#
# Before deploying, run `terraform init` and `terraform validate` to check compatibility.

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

  custom_domain = var.marketing_domain

  repo {
    branch        = "main"
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

# Environment variables for marketing site
resource "netlify_env_var" "marketing_node_version" {
  site_id = netlify_site.marketing.id
  key     = "NODE_VERSION"
  values  = [
    {
      value   = "22"
      context = "all"
    }
  ]
}

resource "netlify_env_var" "marketing_vite_env" {
  site_id = netlify_site.marketing.id
  key     = "VITE_ENV"
  values  = [
    {
      value   = "production"
      context = "all"
    }
  ]
}

# ============================================================================
# Portal Demo Site (portal-demo.securebase.io)
# ============================================================================

resource "netlify_site" "portal_demo" {
  name = "securebase-portal-demo"

  custom_domain = var.portal_demo_domain

  repo {
    branch        = "main"
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

# Environment variables for portal demo site
resource "netlify_env_var" "portal_demo_node_version" {
  site_id = netlify_site.portal_demo.id
  key     = "NODE_VERSION"
  values  = [
    {
      value   = "22"
      context = "all"
    }
  ]
}

resource "netlify_env_var" "portal_demo_mock_api" {
  site_id = netlify_site.portal_demo.id
  key     = "VITE_USE_MOCK_API"
  values  = [
    {
      value   = "true"
      context = "all"
    }
  ]
}

resource "netlify_env_var" "portal_demo_vite_env" {
  site_id = netlify_site.portal_demo.id
  key     = "VITE_ENV"
  values  = [
    {
      value   = "demo"
      context = "all"
    }
  ]
}

resource "netlify_env_var" "portal_demo_analytics" {
  site_id = netlify_site.portal_demo.id
  key     = "VITE_ANALYTICS_ENABLED"
  values  = [
    {
      value   = "false"
      context = "all"
    }
  ]
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
