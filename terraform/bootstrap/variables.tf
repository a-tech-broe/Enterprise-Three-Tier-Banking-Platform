variable "aws_region" {
  description = "AWS region in which to create the remote-state resources."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for naming and tagging."
  type        = string
  default     = "banking-platform"
}

variable "state_bucket_name" {
  description = "Globally-unique S3 bucket name that will hold Terraform state. Must be supplied per-account."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used for state locking."
  type        = string
  default     = "banking-platform-tf-locks"
}

variable "force_destroy" {
  description = "Allow the state bucket to be destroyed even if it contains objects. Keep false in production."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags applied to all bootstrap resources."
  type        = map(string)
  default     = {}
}
