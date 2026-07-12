output "sns_topic_arn" {
  description = "ARN of the SNS alarm topic (subscribe Slack/chatbot here)."
  value       = aws_sns_topic.alarms.arn
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "app_log_group_name" {
  description = "Name of the application log group, if created."
  value       = var.app_log_group_name != "" ? aws_cloudwatch_log_group.app[0].name : null
}
