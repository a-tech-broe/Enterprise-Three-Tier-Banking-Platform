variable "name" {
  description = "Name prefix for the database resources."
  type        = string
}

variable "subnet_ids" {
  description = "Private DB subnet IDs (spread across AZs) for the DB subnet group."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups controlling access to the database."
  type        = list(string)
}

variable "kms_key_arn" {
  description = "KMS key ARN used to encrypt storage, secrets, and performance insights."
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GiB."
  type        = number
  default     = 50
}

variable "max_allocated_storage" {
  description = "Upper limit for storage autoscaling in GiB."
  type        = number
  default     = 200
}

variable "database_name" {
  description = "Name of the initial database to create."
  type        = string
  default     = "banking"
}

variable "master_username" {
  description = "Master username for the database."
  type        = string
  default     = "bankadmin"
}

variable "multi_az" {
  description = "Deploy the database across multiple AZs."
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 30
}

variable "backup_window" {
  description = "Daily backup window (UTC)."
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window (UTC)."
  type        = string
  default     = "sun:04:30-sun:05:30"
}

variable "deletion_protection" {
  description = "Protect the database from accidental deletion."
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on deletion. Keep false in production."
  type        = bool
  default     = false
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights."
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0 to disable)."
  type        = number
  default     = 60
}

variable "apply_immediately" {
  description = "Apply modifications immediately rather than in the maintenance window."
  type        = bool
  default     = false
}

variable "secret_recovery_window_days" {
  description = "Recovery window for the credentials secret on deletion."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags applied to database resources."
  type        = map(string)
  default     = {}
}
