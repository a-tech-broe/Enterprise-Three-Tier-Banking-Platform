variable "name" {
  description = "Name prefix for IAM resources."
  type        = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the instances may read (e.g. DB credentials)."
  type        = list(string)
  default     = []
}

variable "kms_key_arns" {
  description = "KMS key ARNs the instances may use to decrypt secrets/logs."
  type        = list(string)
  default     = []
}

variable "artifact_bucket_arns" {
  description = "S3 bucket ARNs the instances may read application artifacts from."
  type        = list(string)
  default     = []
}

variable "ssm_bucket_arns" {
  description = "ARNs of S3 buckets used by the aws_ssm Ansible connection for file transfer (instances need read/write). Empty list to skip."
  type        = list(string)
  default     = []
}

variable "ssm_parameter_arns" {
  description = "SSM Parameter Store ARNs the instances may read (e.g. the current app image URI)."
  type        = list(string)
  default     = []
}

variable "ses_identity_arns" {
  description = "SES identity ARNs the instances may send email from (empty disables SES send)."
  type        = list(string)
  default     = []
}

variable "enable_cloudwatch_agent" {
  description = "Attach the CloudWatchAgentServerPolicy managed policy."
  type        = bool
  default     = true
}

variable "enable_ssm" {
  description = "Attach the AmazonSSMManagedInstanceCore managed policy (SSM Session Manager)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to IAM resources."
  type        = map(string)
  default     = {}
}
