output "certificate_arn" {
  description = "ARN of the validated ACM certificate."
  value       = var.create_certificate ? aws_acm_certificate_validation.this[0].certificate_arn : null
}

output "record_fqdn" {
  description = "FQDN of the application alias record."
  value       = aws_route53_record.app.fqdn
}

output "zone_id" {
  description = "Route53 hosted zone ID."
  value       = data.aws_route53_zone.this.zone_id
}
