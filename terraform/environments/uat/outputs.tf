output "app_url" {
  description = "Application URL."
  value       = module.platform.app_url
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = module.platform.alb_dns_name
}

output "asg_name" {
  description = "Auto Scaling Group name (for the Ansible inventory)."
  value       = module.platform.asg_name
}

output "db_endpoint" {
  description = "RDS endpoint."
  value       = module.platform.db_endpoint
}

output "db_secret_arn" {
  description = "DB credentials secret ARN."
  value       = module.platform.db_secret_arn
}

output "sns_alarm_topic_arn" {
  description = "SNS alarm topic ARN."
  value       = module.platform.sns_alarm_topic_arn
}

output "ansible_ssm_bucket" {
  description = "S3 bucket for the aws_ssm Ansible connection."
  value       = module.platform.ansible_ssm_bucket
}

output "ecr_repository_url" {
  description = "ECR repository for the app image."
  value       = module.platform.ecr_repository_url
}

output "app_image_parameter" {
  description = "SSM parameter holding the current app image URI."
  value       = module.platform.app_image_parameter
}
