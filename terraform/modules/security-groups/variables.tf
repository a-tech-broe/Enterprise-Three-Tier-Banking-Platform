variable "name" {
  description = "Name prefix for the security groups."
  type        = string
}

variable "vpc_id" {
  description = "VPC in which to create the security groups."
  type        = string
}

variable "app_port" {
  description = "Port the application listens on behind the ALB."
  type        = number
  default     = 8080
}

variable "db_port" {
  description = "Port the database listens on."
  type        = number
  default     = 5432
}

variable "ingress_cidrs" {
  description = "CIDR blocks allowed to reach the ALB on 80/443 (public entrypoint)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  description = "Tags applied to all security groups."
  type        = map(string)
  default     = {}
}
