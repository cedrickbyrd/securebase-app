terraform {
  required_providers {
    aws = {
<<<<<<< HEAD
      source  = "hashicorp/aws"
      version = "~> 5.0"

      configuration_aliases = [
        aws.primary,
        aws.secondary,
      ]
=======
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.secondary]
>>>>>>> feat(phase5.3): implement logging, alerting, multi-region DR, and cost optimization
    }
  }
}
