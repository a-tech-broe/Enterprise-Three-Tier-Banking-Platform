output "key_id" {
  description = "The globally-unique ID of the KMS key."
  value       = aws_kms_key.this.key_id
}

output "key_arn" {
  description = "The ARN of the KMS key."
  value       = aws_kms_key.this.arn
}

output "alias_name" {
  description = "The alias of the KMS key."
  value       = aws_kms_alias.this.name
}
