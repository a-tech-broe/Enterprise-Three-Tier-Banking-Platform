output "state_bucket" {
  description = "Name of the S3 bucket that stores Terraform state."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Name of the DynamoDB table used for state locking."
  value       = aws_dynamodb_table.locks.name
}

output "kms_key_arn" {
  description = "ARN of the KMS key encrypting state at rest."
  value       = aws_kms_key.state.arn
}

output "backend_config_hint" {
  description = "Copy these values into each environment's backend.tf / -backend-config."
  value = {
    bucket         = aws_s3_bucket.state.id
    dynamodb_table = aws_dynamodb_table.locks.name
    kms_key_id     = aws_kms_key.state.arn
    region         = var.aws_region
    encrypt        = true
  }
}
