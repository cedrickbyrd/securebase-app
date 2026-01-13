terraform {
  required_version = ">= 1.5.0"

  # REQUIRED: Remote state prevents state loss and enables collaboration
  # This matches your DEPLOYMENT_GUIDE.md requirements
  backend "s3" {
    bucket         = "securebase-foundation-tfstate" # Change to your bootstrap bucket
    key            = "v0.1/landing-zone.tfstate"
    region         = "us-east-1"
    dynamodb_table = "securebase-lock-table"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
