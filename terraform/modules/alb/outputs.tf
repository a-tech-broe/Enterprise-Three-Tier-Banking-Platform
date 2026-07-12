output "alb_arn" {
  description = "ARN of the load balancer."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "DNS name of the load balancer."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (for Route53 alias records)."
  value       = aws_lb.this.zone_id
}

output "alb_arn_suffix_computed" {
  description = "ARN suffix of the ALB (for CloudWatch dimensions)."
  value       = aws_lb.this.arn_suffix
}

output "target_group_arn" {
  description = "ARN of the target group (attach the ASG to this)."
  value       = aws_lb_target_group.app.arn
}

output "target_group_arn_suffix_computed" {
  description = "ARN suffix of the target group (for CloudWatch dimensions)."
  value       = aws_lb_target_group.app.arn_suffix
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener."
  value       = aws_lb_listener.https.arn
}
