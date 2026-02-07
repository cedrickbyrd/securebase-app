# Netlify Sites Module Variables

variable "netlify_token" {
  description = "Netlify API token for authentication"
  type        = string
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "cedrickbyrd"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "securebase-app"
}

variable "marketing_domain" {
  description = "Custom domain for marketing site"
  type        = string
  default     = "securebase.io"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?\\.([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)*[a-z]{2,}$", var.marketing_domain))
    error_message = "Marketing domain must be a valid domain name (e.g., securebase.io)"
  }
}

variable "portal_demo_domain" {
  description = "Custom domain for portal demo site"
  type        = string
  default     = "portal-demo.securebase.io"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?\\.([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)*[a-z]{2,}$", var.portal_demo_domain))
    error_message = "Portal demo domain must be a valid domain name (e.g., portal-demo.securebase.io)"
  }
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
