data "aws_ami" "al2023" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.al2023[0].id
}

resource "aws_launch_template" "this" {
  name_prefix   = "${var.name}-"
  image_id      = local.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  user_data     = var.user_data != "" ? base64encode(var.user_data) : null

  iam_instance_profile {
    name = var.instance_profile_name
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = var.security_group_ids
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = var.root_volume_size
      volume_type           = var.root_volume_type
      encrypted             = true
      kms_key_id            = var.kms_key_arn
      delete_on_termination = true
    }
  }

  # Require IMDSv2 to mitigate SSRF-based credential theft. Hop limit is 2 (not 1)
  # because the banking-api runs as a Docker container on the bridge network,
  # which adds one network hop; at hop limit 1 the container cannot reach IMDS to
  # obtain instance-role credentials, so boto3 (Secrets Manager, etc.) fails.
  # Hop limit 2 is still safe: IMDSv2 tokens remain required and are not routable
  # off the instance.
  # checkov:skip=CKV_AWS_341:Containers on the docker bridge need hop limit 2 for IMDSv2; tokens still required.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "enabled"
  }

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, var.extra_asg_tags, { Name = "${var.name}-instance" })
  }

  tag_specifications {
    resource_type = "volume"
    tags          = merge(var.tags, { Name = "${var.name}-volume" })
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "this" {
  name_prefix               = "${var.name}-"
  min_size                  = var.min_size
  max_size                  = var.max_size
  desired_capacity          = var.desired_capacity
  vpc_zone_identifier       = var.subnet_ids
  target_group_arns         = var.target_group_arns
  health_check_type         = length(var.target_group_arns) > 0 ? "ELB" : "EC2"
  health_check_grace_period = var.health_check_grace_period
  capacity_rebalance        = true

  # Pin to the specific latest version (not "$Latest"): this makes the ASG show a
  # diff whenever the launch template changes, which is what triggers the implicit
  # instance refresh below. With "$Latest" the ASG never changes on a new LT
  # version, so instances silently never roll.
  launch_template {
    id      = aws_launch_template.this.id
    version = aws_launch_template.this.latest_version
  }

  # Roll instances automatically when the launch template changes (immutable
  # infra). Because the ASG now references a concrete version number, any LT
  # change updates the ASG and implicitly triggers a refresh.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = var.instance_refresh_min_healthy_percentage
      instance_warmup        = var.health_check_grace_period
    }
  }

  dynamic "tag" {
    for_each = merge(var.tags, var.extra_asg_tags, { Name = "${var.name}-instance" })
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]
  }
}

# Target-tracking scaling on average CPU.
resource "aws_autoscaling_policy" "cpu" {
  name                   = "${var.name}-cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.this.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = var.target_cpu_utilization
  }
}
