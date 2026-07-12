#!/usr/bin/env bash
#
# Creates the Terraform remote-state backend (S3 + DynamoDB + KMS) for this
# account, then writes a backend.hcl into every environment directory.
#
# Usage: ./scripts/bootstrap-backend.sh [aws-region]
set -euo pipefail

REGION="${1:-us-east-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="banking-platform-tfstate-${ACCOUNT_ID}"
LOCK_TABLE="banking-platform-tf-locks"

echo ">> Bootstrapping backend in account ${ACCOUNT_ID} / ${REGION}"

pushd "${ROOT}/terraform/bootstrap" >/dev/null
terraform init -input=false
terraform apply -input=false -auto-approve \
  -var="aws_region=${REGION}" \
  -var="state_bucket_name=${BUCKET}" \
  -var="lock_table_name=${LOCK_TABLE}"
KMS_ARN="$(terraform output -raw kms_key_arn)"
popd >/dev/null

for env in dev qa uat prod; do
  dir="${ROOT}/terraform/environments/${env}"
  cat > "${dir}/backend.hcl" <<EOF
bucket         = "${BUCKET}"
dynamodb_table = "${LOCK_TABLE}"
region         = "${REGION}"
kms_key_id     = "${KMS_ARN}"
EOF
  echo ">> Wrote ${dir}/backend.hcl"
done

echo ">> Done. Next: cd terraform/environments/<env> && terraform init -backend-config=backend.hcl"
