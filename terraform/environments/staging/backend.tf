bucket         = "securebase-terraform-state-dev"
key            = "securebase-workspace-staging/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-terraform-locks"
encrypt        = true
