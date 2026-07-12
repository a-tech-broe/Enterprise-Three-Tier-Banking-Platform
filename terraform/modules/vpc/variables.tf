variable "name" {
  description = "Name prefix for all VPC resources (e.g. banking-platform-prod)."
  type        = string
}

variable "cidr_block" {
  description = "Primary CIDR block for the VPC."
  type        = string

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "cidr_block must be a valid IPv4 CIDR."
  }
}

variable "azs" {
  description = "List of Availability Zones to spread subnets across (3 recommended)."
  type        = list(string)

  validation {
    condition     = length(var.azs) >= 2
    error_message = "At least two Availability Zones are required for HA."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (one per AZ). Hosts the ALB and NAT gateways."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets (one per AZ). Hosts EC2/ASG."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "CIDRs for private database subnets (one per AZ). Hosts RDS."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (cheaper, non-HA) instead of one per AZ. Set false in prod."
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Whether to enable VPC flow logs to CloudWatch."
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Retention period for the VPC flow log group."
  type        = number
  default     = 90
}

variable "flow_logs_kms_key_arn" {
  description = "KMS key ARN used to encrypt the flow log group. If null, uses default encryption."
  type        = string
  default     = null
}

variable "enable_s3_endpoint" {
  description = "Create a gateway VPC endpoint for S3 (keeps state/artifact traffic off the NAT)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
