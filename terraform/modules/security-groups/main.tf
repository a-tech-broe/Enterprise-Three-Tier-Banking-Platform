###############################################################################
# Three-tier security groups with least-privilege, reference-based rules.
#   Internet --443/80--> ALB --app_port--> App (ASG) --db_port--> DB (RDS)
# Rules are defined as standalone resources to avoid the perpetual-diff issues
# of inline blocks and to allow cross-referencing SGs without cycles.
###############################################################################

# ---------------------------------------------------------------------------
# ALB security group
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Ingress from the internet to the ALB"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-alb" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each          = toset(var.ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from allowed CIDRs"
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each          = toset(var.ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from allowed CIDRs (redirected to HTTPS at the ALB)"
  cidr_ipv4         = each.value
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward traffic to the application tier"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

# ---------------------------------------------------------------------------
# Application (EC2/ASG) security group
# ---------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.name}-app"
  description = "Application tier - only reachable from the ALB"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-app" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "App traffic from the ALB only"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

# All outbound allowed: instances need YUM/ECR/SSM/CloudWatch over the NAT.
resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "Allow all outbound (SSM, updates, ECR, CloudWatch)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ---------------------------------------------------------------------------
# Database (RDS) security group
# ---------------------------------------------------------------------------
resource "aws_security_group" "db" {
  name        = "${var.name}-db"
  description = "Database tier - only reachable from the application tier"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-db" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "Database traffic from the app tier only"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.db_port
  to_port                      = var.db_port
  ip_protocol                  = "tcp"
}
