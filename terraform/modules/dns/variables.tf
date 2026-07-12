variable "zone_name" {
  description = "Public hosted zone name (e.g. bank.example.com). Must already exist in Route53."
  type        = string
}

variable "record_name" {
  description = "Fully-qualified record to create for the application (e.g. app.dev.bank.example.com)."
  type        = string
}

variable "create_certificate" {
  description = "Whether to request and validate an ACM certificate for record_name."
  type        = bool
  default     = true
}

variable "subject_alternative_names" {
  description = "Additional SANs for the certificate."
  type        = list(string)
  default     = []
}

variable "alb_dns_name" {
  description = "ALB DNS name for the alias record."
  type        = string
}

variable "alb_zone_id" {
  description = "ALB canonical hosted zone ID for the alias record."
  type        = string
}

variable "tags" {
  description = "Tags applied to DNS/ACM resources."
  type        = map(string)
  default     = {}
}
