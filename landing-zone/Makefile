# SecureBase Terraform Makefile
# Usage examples:
#   make bootstrap ENV=dev ORG=securebase REGION=us-east-1
#   make init ENV=dev
#   make plan ENV=dev
#   make apply
#   make destroy ENV=dev

ENV ?= dev
REGION ?= us-east-1
ORG ?= securebase
BACKEND_HCL := environments/$(ENV)/backend.hcl
TFVARS := environments/$(ENV)/terraform.tfvars

.PHONY: check-backend bootstrap clean-cache init migrate plan apply validate destroy fmt

check-backend:
	@[ -f $(BACKEND_HCL) ] || { echo "Error: $(BACKEND_HCL) not found. Create it or use the example: environments/backend.hcl.example"; exit 1; }
	@grep -q 'backend\s*"s3"' main.tf || { echo "Error: backend \"s3\" not configured in main.tf"; exit 1; }
	@echo "✅ Backend config present: $(BACKEND_HCL)"

bootstrap:
	ENV=$(ENV) ORG=$(ORG) REGION=$(REGION) bash BOOTSTRAP_BACKEND.sh

clean-cache:
	bash FIX_TERRAFORM_CACHE.sh

init: check-backend
	terraform init -backend-config=$(BACKEND_HCL) -upgrade

migrate: check-backend
	terraform init -migrate-state -backend-config=$(BACKEND_HCL)

plan: check-backend
	terraform plan -lock=false -var-file=$(TFVARS) -out=tfplan

apply:
	terraform apply tfplan

validate:
	terraform validate

fmt:
	terraform fmt -check

destroy: check-backend
	terraform destroy -lock=false -var-file=$(TFVARS)

# --- Environment-specific shortcuts ---
.PHONY: init-dev plan-dev apply-dev init-staging plan-staging apply-staging init-prod plan-prod apply-prod safe-init

init-dev:
	$(MAKE) init ENV=dev

plan-dev:
	$(MAKE) plan ENV=dev

apply-dev:
	$(MAKE) apply

init-staging:
	$(MAKE) init ENV=staging

plan-staging:
	$(MAKE) plan ENV=staging

apply-staging:
	$(MAKE) apply

init-prod:
	$(MAKE) init ENV=production

plan-prod:
	$(MAKE) plan ENV=production

apply-prod:
	$(MAKE) apply

# Safe init wrapper enforces backend.hcl usage
safe-init:
	bash scripts/safe-init.sh $(ENV)
