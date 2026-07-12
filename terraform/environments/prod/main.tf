###############################################################################
# Production environment
#
# Full HA, security-hardened footprint: one NAT gateway per AZ, Multi-AZ RDS
# with 35-day backups and deletion protection, larger compute, and long log
# retention. Never set skip_final_snapshot or disable deletion protection here.
###############################################################################

locals {
  aws_region = "us-east-1"
}

module "platform" {
  source = "../../modules/platform"

  project     = "banking-platform"
  environment = "prod"
  aws_region  = local.aws_region

  vpc_cidr                 = "10.40.0.0/16"
  azs                      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs      = ["10.40.0.0/24", "10.40.1.0/24", "10.40.2.0/24"]
  private_app_subnet_cidrs = ["10.40.10.0/24", "10.40.11.0/24", "10.40.12.0/24"]
  private_db_subnet_cidrs  = ["10.40.20.0/24", "10.40.21.0/24", "10.40.22.0/24"]
  single_nat_gateway       = false

  instance_type        = "m6i.large"
  asg_min_size         = 3
  asg_max_size         = 12
  asg_desired_capacity = 3
  app_port             = 8080
  health_check_path    = "/health"

  db_instance_class      = "db.m6i.large"
  db_allocated_storage   = 200
  db_multi_az            = true
  db_deletion_protection = true
  db_skip_final_snapshot = false

  enable_dns      = false
  certificate_arn = var.certificate_arn

  alarm_email_endpoints = var.alarm_email_endpoints
  log_retention_days    = 365
}
