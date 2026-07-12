variable "name" {
  description = "Name prefix for CloudWatch/SNS resources."
  type        = string
}

variable "aws_region" {
  description = "Region used for dashboard widgets."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN used to encrypt the SNS topic and log group."
  type        = string
  default     = null
}

variable "asg_name" {
  description = "Auto Scaling Group name to monitor."
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB (e.g. app/name/1234) for metrics."
  type        = string
  default     = ""
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the target group for metrics."
  type        = string
  default     = ""
}

variable "db_instance_id" {
  description = "RDS instance identifier to monitor."
  type        = string
  default     = ""
}

# Alarm toggles. These are gated on *static* booleans (known at plan time) rather
# than on computed ARNs/IDs, because count/for_each cannot depend on values that
# are unknown until apply (e.g. a not-yet-created ASG name or RDS id).
variable "enable_asg_alarms" {
  description = "Create ASG/compute alarms."
  type        = bool
  default     = true
}

variable "enable_alb_alarms" {
  description = "Create ALB alarms (unhealthy hosts, 5XX)."
  type        = bool
  default     = true
}

variable "enable_db_alarms" {
  description = "Create RDS alarms (CPU, free storage)."
  type        = bool
  default     = true
}

variable "app_log_group_name" {
  description = "Name of the application log group to create."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Retention for the application log group."
  type        = number
  default     = 90
}

variable "alarm_email_endpoints" {
  description = "Email addresses subscribed to the alarm SNS topic."
  type        = list(string)
  default     = []
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization percent that triggers the high-CPU alarm."
  type        = number
  default     = 80
}

variable "unhealthy_hosts_threshold" {
  description = "Number of unhealthy hosts that triggers an alarm."
  type        = number
  default     = 1
}

variable "db_free_storage_threshold_bytes" {
  description = "Free storage (bytes) below which the DB storage alarm fires."
  type        = number
  default     = 10737418240 # 10 GiB
}

variable "tags" {
  description = "Tags applied to CloudWatch resources."
  type        = map(string)
  default     = {}
}
