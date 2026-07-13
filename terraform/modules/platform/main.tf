###############################################################################
# Platform composition
#
# Wires together every building-block module into a complete three-tier stack
# for a single environment. Environments call this module with env-specific
# inputs, keeping the per-environment footprint to a backend + a tfvars file.
###############################################################################

data "aws_caller_identity" "current" {}
data "aws_elb_service_account" "main" {}

locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

# ---------------------------------------------------------------------------
# Encryption key (RDS storage, Secrets Manager, CloudWatch Logs, SNS)
# ---------------------------------------------------------------------------
module "kms" {
  source = "../kms"

  name_prefix = local.name_prefix
  alias       = "data"
  description = "CMK for ${local.name_prefix} data at rest"

  service_principals = [
    "logs.${var.aws_region}.amazonaws.com",
    "cloudwatch.amazonaws.com",
    "sns.amazonaws.com",
    "delivery.logs.amazonaws.com",
  ]

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------
module "vpc" {
  source = "../vpc"

  name                     = local.name_prefix
  cidr_block               = var.vpc_cidr
  azs                      = var.azs
  public_subnet_cidrs      = var.public_subnet_cidrs
  private_app_subnet_cidrs = var.private_app_subnet_cidrs
  private_db_subnet_cidrs  = var.private_db_subnet_cidrs
  single_nat_gateway       = var.single_nat_gateway
  flow_logs_retention_days = var.log_retention_days
  flow_logs_kms_key_arn    = module.kms.key_arn

  tags = local.common_tags
}

module "security_groups" {
  source = "../security-groups"

  name          = local.name_prefix
  vpc_id        = module.vpc.vpc_id
  app_port      = var.app_port
  db_port       = 5432
  ingress_cidrs = var.alb_ingress_cidrs

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
module "rds" {
  source = "../rds"

  name               = local.name_prefix
  subnet_ids         = module.vpc.private_db_subnet_ids
  security_group_ids = [module.security_groups.db_sg_id]
  kms_key_arn        = module.kms.key_arn

  engine_version      = var.db_engine_version
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  multi_az            = var.db_multi_az
  database_name       = var.db_name
  deletion_protection = var.db_deletion_protection
  skip_final_snapshot = var.db_skip_final_snapshot

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# IAM (instance role: SSM, CloudWatch, read DB secret)
# ---------------------------------------------------------------------------
module "iam" {
  source = "../iam"

  name           = local.name_prefix
  secret_arns    = [module.rds.secret_arn]
  kms_key_arns   = [module.kms.key_arn]
  ssm_bucket_arn = aws_s3_bucket.ansible_ssm.arn

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Ansible SSM transfer bucket
#
# The community.aws.aws_ssm connection plugin shuttles files through S3. Both the
# runner (deploy role) and the instances (instance profile) read/write here.
# Objects are transient, so they expire quickly and the bucket is force-destroyed.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "ansible_ssm" {
  bucket        = "${local.name_prefix}-ansible-ssm-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "ansible_ssm" {
  bucket                  = aws_s3_bucket.ansible_ssm.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ansible_ssm" {
  bucket = aws_s3_bucket.ansible_ssm.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "ansible_ssm" {
  bucket = aws_s3_bucket.ansible_ssm.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "ansible_ssm" {
  bucket = aws_s3_bucket.ansible_ssm.id
  rule {
    id     = "expire-transient-transfer-objects"
    status = "Enabled"
    filter {}
    expiration {
      days = 1
    }
    noncurrent_version_expiration {
      noncurrent_days = 1
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# ---------------------------------------------------------------------------
# ALB access-log bucket (must use SSE-S3; ALB logs do not support SSE-KMS/CMK)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${local.name_prefix}-alb-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = false
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "alb_logs" {
  statement {
    sid       = "AllowElbLogDelivery"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.alb_logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.main.arn]
    }
  }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.alb_logs.arn, "${aws_s3_bucket.alb_logs.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = data.aws_iam_policy_document.alb_logs.json
}

# ---------------------------------------------------------------------------
# ACM certificate (optional; when disabled, certificate_arn must be set or the
# ALB serves HTTP only). Cert-only module so it has no dependency on the ALB.
# ---------------------------------------------------------------------------
module "dns" {
  source = "../dns"
  count  = var.enable_dns ? 1 : 0

  zone_name                   = var.zone_name
  record_name                 = var.record_name
  create_hosted_zone          = var.create_hosted_zone
  update_registered_domain_ns = var.update_registered_domain_ns

  tags = local.common_tags
}

locals {
  certificate_arn = var.enable_dns ? module.dns[0].certificate_arn : var.certificate_arn
  # Known at plan time (both inputs are static), unlike certificate_arn which is
  # a computed ACM ARN when enable_dns = true.
  enable_https = var.enable_dns || var.certificate_arn != ""
}

# Alias record -> ALB. Created here (after the ALB) rather than inside the dns
# module to break the cert<->ALB cycle.
resource "aws_route53_record" "app" {
  count = var.enable_dns ? 1 : 0

  zone_id = module.dns[0].zone_id
  name    = var.record_name
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

# ---------------------------------------------------------------------------
# Load balancer
# ---------------------------------------------------------------------------
module "alb" {
  source = "../alb"

  name               = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_sg_id]
  certificate_arn    = local.certificate_arn
  enable_https       = local.enable_https
  app_port           = var.app_port
  health_check_path  = var.health_check_path
  access_logs_bucket = aws_s3_bucket.alb_logs.id

  enable_deletion_protection = var.environment == "prod"

  tags = local.common_tags

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

# ---------------------------------------------------------------------------
# Compute (launch template + ASG)
# ---------------------------------------------------------------------------
locals {
  # Minimal, idempotent user-data. Ansible performs the full configuration; this
  # only ensures the SSM agent is live so the pipeline can reach the instance.
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    dnf install -y amazon-ssm-agent || yum install -y amazon-ssm-agent || true
    systemctl enable --now amazon-ssm-agent || true
    echo "${local.name_prefix} bootstrapped at $(date -u)" > /etc/banking-platform-release
  EOF
}

module "ec2" {
  source = "../ec2"

  name                  = local.name_prefix
  ami_id                = var.ami_id
  instance_type         = var.instance_type
  subnet_ids            = module.vpc.private_app_subnet_ids
  security_group_ids    = [module.security_groups.app_sg_id]
  instance_profile_name = module.iam.instance_profile_name
  target_group_arns     = [module.alb.target_group_arn]

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity
  user_data        = local.user_data

  extra_asg_tags = {
    Role        = "app"
    Environment = var.environment
    AnsibleRole = "app-server"
  }

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# Observability
# ---------------------------------------------------------------------------
module "cloudwatch" {
  source = "../cloudwatch"

  name       = local.name_prefix
  aws_region = var.aws_region

  asg_name                = module.ec2.asg_name
  alb_arn_suffix          = module.alb.alb_arn_suffix_computed
  target_group_arn_suffix = module.alb.target_group_arn_suffix_computed
  db_instance_id          = module.rds.db_instance_id

  app_log_group_name    = "/banking-platform/${var.environment}/app"
  log_retention_days    = var.log_retention_days
  alarm_email_endpoints = var.alarm_email_endpoints
  kms_key_arn           = module.kms.key_arn

  tags = local.common_tags
}
