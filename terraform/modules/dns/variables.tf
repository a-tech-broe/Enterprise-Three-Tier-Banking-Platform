variable "zone_name" {
  description = "Public hosted zone name (e.g. skybroe.com). Created when create_hosted_zone=true, otherwise looked up."
  type        = string
}

variable "record_name" {
  description = "Fully-qualified record for the application (e.g. www.skybroe.com)."
  type        = string
}

variable "create_hosted_zone" {
  description = "Create the public hosted zone. Set true when no zone exists yet; false to reuse an existing one (Terraform cannot auto-detect because a missing data-source zone is a hard error)."
  type        = bool
  default     = false
}

variable "update_registered_domain_ns" {
  description = "When creating the zone, point the Route53-registered domain's name servers at it so ACM DNS validation resolves publicly. Requires the domain to be registered in Route53 Domains in this account (us-east-1 endpoint)."
  type        = bool
  default     = false
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

variable "tags" {
  description = "Tags applied to DNS/ACM resources."
  type        = map(string)
  default     = {}
}
