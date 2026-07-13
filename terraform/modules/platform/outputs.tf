output "vpc_id" {
  description = "VPC ID."
  value       = module.vpc.vpc_id
}

output "private_app_subnet_ids" {
  description = "Private application subnet IDs."
  value       = module.vpc.private_app_subnet_ids
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB."
  value       = module.alb.alb_dns_name
}

output "app_url" {
  description = "URL applications are reachable at."
  value = (
    var.enable_dns ? "https://${var.record_name}" :
    local.certificate_arn != "" ? "https://${module.alb.alb_dns_name}" :
    "http://${module.alb.alb_dns_name}"
  )
}

output "asg_name" {
  description = "Auto Scaling Group name (used by the Ansible dynamic inventory)."
  value       = module.ec2.asg_name
}

output "db_endpoint" {
  description = "RDS endpoint."
  value       = module.rds.db_endpoint
}

output "db_secret_arn" {
  description = "ARN of the DB credentials secret."
  value       = module.rds.secret_arn
}

output "instance_profile_name" {
  description = "EC2 instance profile name."
  value       = module.iam.instance_profile_name
}

output "kms_key_arn" {
  description = "Environment data CMK ARN."
  value       = module.kms.key_arn
}

output "sns_alarm_topic_arn" {
  description = "SNS topic ARN for alarms/Teams notifications."
  value       = module.cloudwatch.sns_topic_arn
}

output "alb_logs_bucket" {
  description = "S3 bucket receiving ALB access logs."
  value       = aws_s3_bucket.alb_logs.id
}

output "ansible_ssm_bucket" {
  description = "S3 bucket used by the aws_ssm Ansible connection for file transfer."
  value       = aws_s3_bucket.ansible_ssm.id
}
