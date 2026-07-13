output "certificate_arn" {
  description = "ARN of the validated ACM certificate."
  value       = var.create_certificate ? aws_acm_certificate_validation.this[0].certificate_arn : null
}

output "zone_id" {
  description = "Route53 hosted zone ID (used by the root module for the alias record)."
  value       = local.zone_id
}

output "name_servers" {
  description = "Name servers of the created zone (empty when reusing an existing zone). Delegate the domain to these if not done automatically."
  value       = local.name_servers
}
