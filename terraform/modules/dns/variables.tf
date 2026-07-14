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

variable "create_certificate" {
  description = "Whether to request and validate an ACM certificate for record_name."
  type        = bool
  default     = true
}

variable "manage_registrar_nameservers" {
  description = "When the domain is registered in this account's Route 53 Domains, point its registrar name servers at the created hosted zone automatically (so ACM DNS validation completes without a manual step). Only takes effect together with create_hosted_zone. Requires route53domains permissions."
  type        = bool
  default     = false
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
