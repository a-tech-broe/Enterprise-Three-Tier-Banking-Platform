#!/usr/bin/env bash
#
# Configures GitHub Actions OIDC access to AWS for this repo:
#   1. Creates the token.actions.githubusercontent.com IAM OIDC provider (if missing).
#   2. Sets the trust policy on an existing IAM role so this repo can assume it.
#
# Usage: ./scripts/setup-oidc.sh <ROLE_NAME>
# Requires: awscli v2, credentials with iam:* on the target role/provider.
set -euo pipefail

ROLE_NAME="${1:?Usage: setup-oidc.sh <ROLE_NAME>}"
REPO="a-tech-broe/Enterprise-Three-Tier-Banking-Platform"
PROVIDER_HOST="token.actions.githubusercontent.com"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${PROVIDER_HOST}"

echo ">> Account: ${ACCOUNT_ID}  Role: ${ROLE_NAME}  Repo: ${REPO}"

# 1) Ensure the OIDC provider exists (thumbprint is ignored for this provider by
#    AWS today, but the API still requires one).
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${PROVIDER_ARN}" >/dev/null 2>&1; then
  echo ">> OIDC provider already exists."
else
  echo ">> Creating OIDC provider ${PROVIDER_HOST}..."
  aws iam create-open-id-connect-provider \
    --url "https://${PROVIDER_HOST}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" >/dev/null
fi

# 2) Write the trust policy and attach it to the role.
TRUST_DOC="$(mktemp)"
cat > "${TRUST_DOC}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GitHubActionsOIDC",
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "${PROVIDER_HOST}:aud": "sts.amazonaws.com" },
        "StringLike": { "${PROVIDER_HOST}:sub": "repo:${REPO}:*" }
      }
    }
  ]
}
EOF

echo ">> Updating trust policy on ${ROLE_NAME}..."
aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "file://${TRUST_DOC}"
rm -f "${TRUST_DOC}"

echo ">> Done. Re-run the GitHub Actions 'plan' workflow."
