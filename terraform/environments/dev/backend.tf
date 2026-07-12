terraform {
  # Partial backend configuration. The bucket / dynamodb_table / kms_key_id are
  # supplied at init time via `-backend-config=backend.hcl` (created from the
  # bootstrap outputs). This keeps account-specific names out of version control.
  backend "s3" {
    key     = "dev/terraform.tfstate"
    encrypt = true
  }
}
