variable "alarm_email_endpoints" {
  description = "Email addresses subscribed to CloudWatch alarm notifications."
  type        = list(string)
  default     = []
}
