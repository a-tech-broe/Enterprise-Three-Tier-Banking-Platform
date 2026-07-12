variable "certificate_arn" {
  description = "ACM certificate ARN for the ALB HTTPS listener. Required unless enable_dns is set in main.tf."
  type        = string
  default     = ""
}

variable "alarm_email_endpoints" {
  description = "Email addresses subscribed to CloudWatch alarm notifications."
  type        = list(string)
  default     = []
}
