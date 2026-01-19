bucket         = "securebase-terraform-state-dev"
key            = "landing-zone/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-terraform-locks"
encrypt        = true
