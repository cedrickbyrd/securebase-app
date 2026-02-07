# Netlify Sites Module
# Manages Netlify deployments for marketing site and portal demo
#
# IMPORTANT: This configuration is based on Netlify Terraform provider ~> 0.4.0.
# The provider has limited resource support compared to newer versions.
#
# PREREQUISITES - Sites must be created manually first:
# 1. Go to https://app.netlify.com and create two sites:
#    - securebase-marketing (for marketing site)
#    - securebase-portal-demo (for portal demo)
# 2. Configure each site with:
#    - Repository: cedrickbyrd/securebase-app
#    - Branch: main
#    - Build command: (as specified below)
#    - Publish directory: (as specified below)
# 3. Note the site IDs from Netlify dashboard (Settings → General → API ID)
# 4. Set the site names in variables and reference via data sources
#
# Provider v0.4.0 Limitations:
# - No `netlify_site` resource (sites must exist, use data source)
# - No `netlify_build_hook` resource (create manually in Netlify UI)
# - Use `netlify_environment_variable` instead of `netlify_env_var`
#
# Before deploying, run `terraform init` and `terraform validate` to check compatibility.


# ============================================================================
# Marketing Site (securebase.io)
# ============================================================================

# Data source to reference existing Netlify site
# Site must be created manually in Netlify UI first
# Build settings:
#   - Repository: cedrickbyrd/securebase-app
#   - Branch: main
#   - Build command: npm run build
#   - Publish directory: dist
data "netlify_site" "marketing" {
  name = "securebase-marketing"
}

# Environment variables for marketing site
resource "netlify_environment_variable" "marketing_node_version" {
  site_id = data.netlify_site.marketing.id
  key     = "NODE_VERSION"
  values  = [
    {
      value   = "22"
      context = "all"
    }
  ]
}

resource "netlify_environment_variable" "marketing_vite_env" {
  site_id = data.netlify_site.marketing.id
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

# Data source to reference existing Netlify site
# Site must be created manually in Netlify UI first
# Build settings:
#   - Repository: cedrickbyrd/securebase-app
#   - Branch: main
#   - Build command: cd phase3a-portal && npm run build
#   - Publish directory: phase3a-portal/dist
data "netlify_site" "portal_demo" {
  name = "securebase-portal-demo"
}

# Environment variables for portal demo site
resource "netlify_environment_variable" "portal_demo_node_version" {
  site_id = data.netlify_site.portal_demo.id
  key     = "NODE_VERSION"
  values  = [
    {
      value   = "22"
      context = "all"
    }
  ]
}

resource "netlify_environment_variable" "portal_demo_mock_api" {
  site_id = data.netlify_site.portal_demo.id
  key     = "VITE_USE_MOCK_API"
  values  = [
    {
      value   = "true"
      context = "all"
    }
  ]
}

resource "netlify_environment_variable" "portal_demo_vite_env" {
  site_id = data.netlify_site.portal_demo.id
  key     = "VITE_ENV"
  values  = [
    {
      value   = "demo"
      context = "all"
    }
  ]
}

resource "netlify_environment_variable" "portal_demo_analytics" {
  site_id = data.netlify_site.portal_demo.id
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
# Note: netlify_build_hook resource is not supported in provider v0.4.0
# Build hooks must be created manually in Netlify UI:
#   1. Go to Site settings → Build & deploy → Build hooks
#   2. Click "Add build hook"
#   3. Name: "Manual Deploy - Marketing Site" (for marketing site)
#   4. Name: "Manual Deploy - Portal Demo" (for portal demo)
#   5. Branch: main
#   6. Save the webhook URL for triggering manual deploys
# ============================================================================
