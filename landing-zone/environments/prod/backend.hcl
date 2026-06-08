bucket         = "securebase-terraform-state-prod"
key            = "prod/securebase.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-terraform-locks"
encrypt        = true
