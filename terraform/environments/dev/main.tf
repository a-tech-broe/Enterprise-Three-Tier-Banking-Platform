###############################################################################
# Dev environment
#
# Cost-optimised, non-HA settings suitable for development: single NAT gateway,
# single-AZ RDS, small instances, and no deletion protection so it can be torn
# down freely. All values here are non-secret and intentionally in version
# control; the DB password is generated and stored in Secrets Manager.
###############################################################################

locals {
  aws_region = "us-east-1"
}

module "platform" {
  source = "../../modules/platform"

  project     = "banking-platform"
  environment = "dev"
  aws_region  = local.aws_region

  # Networking
  vpc_cidr                 = "10.10.0.0/16"
  azs                      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs      = ["10.10.0.0/24", "10.10.1.0/24", "10.10.2.0/24"]
  private_app_subnet_cidrs = ["10.10.10.0/24", "10.10.11.0/24", "10.10.12.0/24"]
  private_db_subnet_cidrs  = ["10.10.20.0/24", "10.10.21.0/24", "10.10.22.0/24"]
  single_nat_gateway       = true

  # Compute. t3.medium (2 vCPU / 4 GB) is ample for one nginx + app container and
  # keeps dev cheap (~$30/mo vs ~$140 for m5.xlarge).
  instance_type        = "t3.medium"
  asg_min_size         = 1
  asg_max_size         = 3
  asg_desired_capacity = 1
  app_port             = 8080
  health_check_path    = "/health"

  # Database
  db_instance_class      = "db.t3.small"
  db_allocated_storage   = 20
  db_multi_az            = false
  db_deletion_protection = false
  db_skip_final_snapshot = true

  # TLS / DNS: serve the app at https://bank.skybroe.com. The skybroe.com apex
  # (and its hosted zone, registrar delegation and SES identity) belong to a
  # separate project (ecs-platform), so we reuse that EXISTING zone, add only the
  # bank.* alias + ACM validation records, and never touch the registrar.
  enable_dns                   = true
  create_hosted_zone           = false
  manage_registrar_nameservers = false
  zone_name                    = "skybroe.com"
  record_name                  = "bank.skybroe.com"

  # Back-office access: these emails get admin (comma-separated). Edit as needed.
  admin_emails = "jen4rill@gmail.com"

  # Transactional email via SES is OFF: skybroe.com's SES domain identity/DKIM is
  # owned by the other project. Re-enable once a separate sending identity exists.
  enable_email = false

  # Observability
  alarm_email_endpoints = var.alarm_email_endpoints
  log_retention_days    = 30
}
