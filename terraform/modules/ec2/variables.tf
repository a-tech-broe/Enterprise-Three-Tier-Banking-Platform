variable "name" {
  description = "Name prefix for the launch template and ASG."
  type        = string
}

variable "ami_id" {
  description = "AMI ID for instances. If empty, the latest Amazon Linux 2023 AMI is used."
  type        = string
  default     = ""
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.medium"
}

variable "subnet_ids" {
  description = "Private application subnet IDs the ASG launches instances into."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups attached to the instances."
  type        = list(string)
}

variable "instance_profile_name" {
  description = "IAM instance profile name to attach."
  type        = string
}

variable "target_group_arns" {
  description = "ALB target group ARNs to register instances with."
  type        = list(string)
  default     = []
}

variable "kms_key_arn" {
  description = "KMS key ARN used to encrypt the root EBS volume."
  type        = string
  default     = null
}

variable "root_volume_size" {
  description = "Root EBS volume size in GiB."
  type        = number
  default     = 30
}

variable "root_volume_type" {
  description = "Root EBS volume type."
  type        = string
  default     = "gp3"
}

variable "min_size" {
  description = "Minimum number of instances in the ASG."
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of instances in the ASG."
  type        = number
  default     = 6
}

variable "desired_capacity" {
  description = "Desired number of instances in the ASG."
  type        = number
  default     = 2
}

variable "health_check_grace_period" {
  description = "Seconds to wait after launch before checking instance health."
  type        = number
  default     = 300
}

variable "target_cpu_utilization" {
  description = "Target average CPU utilization for the scaling policy."
  type        = number
  default     = 60
}

variable "user_data" {
  description = "Base64-decoded user-data script rendered onto each instance."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Optional EC2 key pair name. Prefer SSM Session Manager and leave empty."
  type        = string
  default     = null
}

variable "instance_refresh_min_healthy_percentage" {
  description = "Minimum healthy percentage during a rolling instance refresh."
  type        = number
  default     = 90
}

variable "extra_asg_tags" {
  description = "Additional tags propagated to launched instances."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags applied to the launch template and ASG resources."
  type        = map(string)
  default     = {}
}
