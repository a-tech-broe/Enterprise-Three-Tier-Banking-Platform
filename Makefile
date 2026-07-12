# Banking Platform - developer entrypoints
# Usage: make <target> ENV=dev
ENV        ?= dev
TF_DIR      = terraform/environments/$(ENV)
BOOTSTRAP   = terraform/bootstrap
ANSIBLE_DIR = ansible

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

## ---- Terraform ----------------------------------------------------------
.PHONY: fmt
fmt: ## Format all Terraform
	terraform fmt -recursive terraform/

.PHONY: validate
validate: ## Validate every environment (no backend)
	@for e in dev qa uat prod; do \
		echo "== $$e =="; \
		terraform -chdir=terraform/environments/$$e init -backend=false -input=false >/dev/null && \
		terraform -chdir=terraform/environments/$$e validate; \
	done

.PHONY: bootstrap
bootstrap: ## Create the S3/DynamoDB remote-state backend (run once per account)
	terraform -chdir=$(BOOTSTRAP) init
	terraform -chdir=$(BOOTSTRAP) apply

.PHONY: init
init: ## terraform init for ENV (expects backend.hcl)
	terraform -chdir=$(TF_DIR) init -backend-config=backend.hcl

.PHONY: plan
plan: ## terraform plan for ENV
	terraform -chdir=$(TF_DIR) plan

.PHONY: apply
apply: ## terraform apply for ENV
	terraform -chdir=$(TF_DIR) apply

.PHONY: destroy
destroy: ## terraform destroy for ENV
	terraform -chdir=$(TF_DIR) destroy

.PHONY: output
output: ## Show terraform outputs for ENV
	terraform -chdir=$(TF_DIR) output

## ---- Quality ------------------------------------------------------------
.PHONY: lint
lint: ## Run tflint across all modules/envs
	tflint --recursive --config="$(CURDIR)/.tflint.hcl"

.PHONY: scan
scan: ## Run Checkov security scan
	checkov -d terraform/ --config-file .checkov.yml

.PHONY: ansible-lint
ansible-lint: ## Lint Ansible content
	cd $(ANSIBLE_DIR) && ansible-lint site.yml roles/

.PHONY: check
check: fmt validate lint scan ansible-lint ## Run every local check

## ---- Ansible ------------------------------------------------------------
.PHONY: galaxy
galaxy: ## Install Ansible collection dependencies
	cd $(ANSIBLE_DIR) && ansible-galaxy collection install -r requirements.yml

.PHONY: configure
configure: ## Run the Ansible playbook against ENV
	cd $(ANSIBLE_DIR) && ansible-playbook -i inventories/$(ENV)/aws_ec2.yml site.yml
