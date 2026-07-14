variable "name" {
  description = "ECR repository name."
  type        = string
}

variable "image_tag_mutability" {
  description = "IMMUTABLE (recommended for prod) or MUTABLE."
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Run a basic vulnerability scan when images are pushed."
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for repository encryption. If null, uses AES256."
  type        = string
  default     = null
}

variable "max_image_count" {
  description = "Number of tagged images to retain before expiring the oldest."
  type        = number
  default     = 20
}

variable "untagged_expiry_days" {
  description = "Days after which untagged images are expired."
  type        = number
  default     = 7
}

variable "pull_principal_arns" {
  description = "IAM ARNs (e.g. the instance role) allowed to pull from this repo via the repository policy."
  type        = list(string)
  default     = []
}

variable "force_delete" {
  description = "Allow deleting the repo even if it contains images."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to the repository."
  type        = map(string)
  default     = {}
}
