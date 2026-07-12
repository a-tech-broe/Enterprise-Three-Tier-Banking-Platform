###############################################################################
# UAT environment
#
# Full production topology for user-acceptance testing: HA NAT gateways,
# Multi-AZ RDS, deletion protection. Mirrors prod so release candidates are
# validated against production-equivalent infrastructure.
###############################################################################

locals {
  aws_region = "us-east-1"
}

module "platform" {
  source = "../../modules/platform"

  project     = "banking-platform"
  environment = "uat"
  aws_region  = local.aws_region

  vpc_cidr                 = "10.30.0.0/16"
  azs                      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs      = ["10.30.0.0/24", "10.30.1.0/24", "10.30.2.0/24"]
  private_app_subnet_cidrs = ["10.30.10.0/24", "10.30.11.0/24", "10.30.12.0/24"]
  private_db_subnet_cidrs  = ["10.30.20.0/24", "10.30.21.0/24", "10.30.22.0/24"]
  single_nat_gateway       = false

  instance_type        = "t3.medium"
  asg_min_size         = 2
  asg_max_size         = 6
  asg_desired_capacity = 2
  app_port             = 8080
  health_check_path    = "/health"

  db_instance_class      = "db.t3.large"
  db_allocated_storage   = 100
  db_multi_az            = true
  db_deletion_protection = true
  db_skip_final_snapshot = false

  enable_dns      = false
  certificate_arn = var.certificate_arn

  alarm_email_endpoints = var.alarm_email_endpoints
  log_retention_days    = 90
}
