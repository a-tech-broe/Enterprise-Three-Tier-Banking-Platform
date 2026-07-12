###############################################################################
# QA environment
#
# Production-like topology at reduced scale for integration/regression testing.
# Single NAT to save cost, single-AZ RDS, final snapshot retained.
###############################################################################

locals {
  aws_region = "us-east-1"
}

module "platform" {
  source = "../../modules/platform"

  project     = "banking-platform"
  environment = "qa"
  aws_region  = local.aws_region

  vpc_cidr                 = "10.20.0.0/16"
  azs                      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs      = ["10.20.0.0/24", "10.20.1.0/24", "10.20.2.0/24"]
  private_app_subnet_cidrs = ["10.20.10.0/24", "10.20.11.0/24", "10.20.12.0/24"]
  private_db_subnet_cidrs  = ["10.20.20.0/24", "10.20.21.0/24", "10.20.22.0/24"]
  single_nat_gateway       = true

  instance_type        = "t3.medium"
  asg_min_size         = 2
  asg_max_size         = 4
  asg_desired_capacity = 2
  app_port             = 8080
  health_check_path    = "/health"

  db_instance_class      = "db.t3.medium"
  db_allocated_storage   = 50
  db_multi_az            = false
  db_deletion_protection = true
  db_skip_final_snapshot = false

  enable_dns      = false
  certificate_arn = var.certificate_arn

  alarm_email_endpoints = var.alarm_email_endpoints
  log_retention_days    = 60
}
