<<<<<<< HEAD
bucket         = "securebase-tfstate-prod-us-west-2"
key            = "prod-us-west-2/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-tfstate-locks"
=======
bucket         = "securebase-terraform-state-prod"
key            = "prod-us-west-2/securebase.tfstate"
region         = "us-east-1"
dynamodb_table = "securebase-terraform-locks"
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
encrypt        = true
