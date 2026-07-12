variable "name" {
  description = "Name prefix for ALB resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID in which the target group lives."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs to place the ALB in (one per AZ)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups attached to the ALB."
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener."
  type        = string
}

variable "app_port" {
  description = "Port the target application listens on."
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "HTTP path used for target group health checks."
  type        = string
  default     = "/health"
}

variable "health_check_matcher" {
  description = "HTTP status codes considered healthy."
  type        = string
  default     = "200"
}

variable "ssl_policy" {
  description = "ELB security policy for the HTTPS listener (TLS 1.2+ recommended)."
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

variable "internal" {
  description = "Whether the ALB is internal (no public IP)."
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Protect the ALB from accidental deletion."
  type        = bool
  default     = true
}

variable "access_logs_bucket" {
  description = "S3 bucket name for ALB access logs. If empty, access logging is disabled."
  type        = string
  default     = ""
}

variable "access_logs_prefix" {
  description = "Prefix within the access logs bucket."
  type        = string
  default     = "alb"
}

variable "deregistration_delay" {
  description = "Seconds to wait before deregistering a target (connection draining)."
  type        = number
  default     = 30
}

variable "idle_timeout" {
  description = "ALB idle connection timeout in seconds."
  type        = number
  default     = 60
}

variable "tags" {
  description = "Tags applied to ALB resources."
  type        = map(string)
  default     = {}
}
