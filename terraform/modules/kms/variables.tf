variable "name_prefix" {
  description = "Prefix used for the alias and tags (e.g. banking-platform-prod)."
  type        = string
}

variable "description" {
  description = "Human-readable description of the key's purpose."
  type        = string
  default     = "CMK managed by Terraform"
}

variable "alias" {
  description = "Alias suffix for the key (final alias is alias/<name_prefix>-<alias>)."
  type        = string
}

variable "deletion_window_in_days" {
  description = "Waiting period before the key is deleted after scheduling."
  type        = number
  default     = 30
}

variable "enable_key_rotation" {
  description = "Whether to enable automatic annual key rotation."
  type        = bool
  default     = true
}

variable "key_administrators" {
  description = "List of IAM ARNs allowed to administer the key. Defaults to the account root."
  type        = list(string)
  default     = []
}

variable "key_users" {
  description = "List of IAM ARNs allowed to use the key for crypto operations."
  type        = list(string)
  default     = []
}

variable "service_principals" {
  description = "AWS service principals (e.g. logs.amazonaws.com) permitted to use the key."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to the key."
  type        = map(string)
  default     = {}
}
