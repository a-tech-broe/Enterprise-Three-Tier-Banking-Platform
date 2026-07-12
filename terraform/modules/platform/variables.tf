variable "project" {
  description = "Project name used as a naming/tagging prefix."
  type        = string
  default     = "banking-platform"
}

variable "environment" {
  description = "Environment name (dev, qa, uat, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "qa", "uat", "prod"], var.environment)
    error_message = "environment must be one of: dev, qa, uat, prod."
  }
}

variable "aws_region" {
  description = "AWS region for this environment."
  type        = string
}

# --- Networking -------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "azs" {
  description = "Availability Zones to use (3 recommended)."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "Private application subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "Private database subnet CIDRs, one per AZ."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (non-HA). False for prod."
  type        = bool
  default     = false
}

variable "alb_ingress_cidrs" {
  description = "CIDRs allowed to reach the public ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# --- Application / compute ---------------------------------------------------
variable "app_port" {
  description = "Port the application listens on."
  type        = number
  default     = 8080
}

variable "instance_type" {
  description = "EC2 instance type for the app tier."
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "Optional AMI override. Empty selects the latest Amazon Linux 2023."
  type        = string
  default     = ""
}

variable "asg_min_size" {
  description = "Minimum ASG size."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Maximum ASG size."
  type        = number
  default     = 6
}

variable "asg_desired_capacity" {
  description = "Desired ASG capacity."
  type        = number
  default     = 2
}

variable "health_check_path" {
  description = "ALB health-check path."
  type        = string
  default     = "/health"
}

# --- Database ---------------------------------------------------------------
variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.4"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Initial DB storage (GiB)."
  type        = number
  default     = 50
}

variable "db_multi_az" {
  description = "Deploy RDS Multi-AZ."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "banking"
}

variable "db_deletion_protection" {
  description = "Protect the database from deletion."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot on destroy (true only for throwaway envs)."
  type        = bool
  default     = false
}

# --- DNS / TLS --------------------------------------------------------------
variable "enable_dns" {
  description = "Create Route53 record + ACM certificate. Requires a hosted zone."
  type        = bool
  default     = false
}

variable "zone_name" {
  description = "Public hosted zone name (required when enable_dns = true)."
  type        = string
  default     = ""
}

variable "record_name" {
  description = "App FQDN to publish (required when enable_dns = true)."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "Existing ACM cert ARN to use when enable_dns = false. Required if DNS is disabled."
  type        = string
  default     = ""
}

# --- Observability ----------------------------------------------------------
variable "alarm_email_endpoints" {
  description = "Emails subscribed to the alarm SNS topic."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "Retention for application and flow logs."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Additional tags merged onto every resource."
  type        = map(string)
  default     = {}
}
