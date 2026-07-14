# ---------------------------------------------------------------------------
# Hosted zone: create it, or look up an existing one.
#
# Terraform has no native "use if it exists, else create" for a data source
# (a missing data-source zone is a hard error), so the behaviour is controlled
# by create_hosted_zone. Set it true for a fresh account with no zone.
# ---------------------------------------------------------------------------
resource "aws_route53_zone" "this" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.zone_name
  tags  = merge(var.tags, { Name = var.zone_name })
}

data "aws_route53_zone" "this" {
  count        = var.create_hosted_zone ? 0 : 1
  name         = var.zone_name
  private_zone = false
}

locals {
  zone_id      = var.create_hosted_zone ? aws_route53_zone.this[0].zone_id : data.aws_route53_zone.this[0].zone_id
  name_servers = var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : []
}

# Registrar delegation.
#
# When the domain is registered in THIS account's Route 53 Domains, we point its
# registrar name servers at the freshly created hosted zone so ACM DNS
# validation below completes in the same apply — no manual step. The route53
# domains API lives only in us-east-1; this stack runs there, so the default
# provider is fine. On destroy this resource stops managing the domain but does
# not unregister it. For a domain registered elsewhere, leave this disabled and
# copy the `name_servers` output into the external registrar once.
resource "aws_route53domains_registered_domain" "this" {
  count       = var.create_hosted_zone && var.manage_registrar_nameservers ? 1 : 0
  domain_name = var.zone_name

  dynamic "name_server" {
    for_each = aws_route53_zone.this[0].name_servers
    content {
      name = name_server.value
    }
  }

  auto_renew    = true
  transfer_lock = true
}

# ---------------------------------------------------------------------------
# ACM certificate with DNS validation
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "this" {
  count                     = var.create_certificate ? 1 : 0
  domain_name               = var.record_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"
  tags                      = merge(var.tags, { Name = var.record_name })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = var.create_certificate ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = local.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = var.create_certificate ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]

  # Ensure the registrar points at this zone before we wait for validation,
  # otherwise ACM can never resolve the validation records and this would block
  # until the timeout.
  depends_on = [aws_route53domains_registered_domain.this]

  timeouts {
    create = "60m"
  }
}

# The alias A record that points the app hostname at the ALB is created in the
# root module (after the ALB), not here, to avoid a cert<->ALB dependency cycle:
# the ALB needs this certificate, and the alias record needs the ALB.
