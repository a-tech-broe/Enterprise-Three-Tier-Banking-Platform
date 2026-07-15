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

  # Compute
  instance_type        = "m5.xlarge"
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

  # TLS / DNS: serve the app at https://skybroe.com. Terraform creates the hosted
  # zone, requests + DNS-validates an ACM cert, adds the HTTPS listener (with an
  # 80->443 redirect) and the apex alias to the ALB. Because skybroe.com is
  # registered in this account's Route 53 Domains, manage_registrar_nameservers
  # delegates the domain to the new zone automatically, so cert validation
  # completes in the same apply with no manual registrar step.
  enable_dns                   = true
  create_hosted_zone           = true
  manage_registrar_nameservers = true
  zone_name                    = "skybroe.com"
  record_name                  = "skybroe.com"

  # Back-office access: these emails get admin (comma-separated). Edit as needed.
  admin_emails = "jen4rill@gmail.com"

  # Transactional email via SES (password-reset links). Verifies skybroe.com with
  # Easy DKIM in the hosted zone and lets the app send from no-reply@skybroe.com.
  # New SES accounts are sandboxed — request production access to email arbitrary
  # users, then set expose_reset_token = false so the token is only ever emailed.
  enable_email = true

  # Observability
  alarm_email_endpoints = var.alarm_email_endpoints
  log_retention_days    = 30
}
