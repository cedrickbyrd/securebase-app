terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    
    netlify = {
      source  = "netlify/netlify"
      version = ">= 0.1.0"
    }
  }
}
