data "aws_partition" "current" {}

locals {
  arn_prefix = "arn:${data.aws_partition.current.partition}:iam::aws:policy"
}

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name                 = "${var.name}-ec2"
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  max_session_duration = 3600
  tags                 = var.tags
}

# ---------------------------------------------------------------------------
# AWS-managed policies for SSM and CloudWatch agent.
# ---------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "ssm" {
  count      = var.enable_ssm ? 1 : 0
  role       = aws_iam_role.instance.name
  policy_arn = "${local.arn_prefix}/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  count      = var.enable_cloudwatch_agent ? 1 : 0
  role       = aws_iam_role.instance.name
  policy_arn = "${local.arn_prefix}/CloudWatchAgentServerPolicy"
}

# ---------------------------------------------------------------------------
# Least-privilege inline policy for secrets, KMS decrypt, and artifact reads.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "app" {
  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []
    content {
      sid       = "ReadDbSecrets"
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      resources = var.secret_arns
    }
  }

  dynamic "statement" {
    for_each = length(var.kms_key_arns) > 0 ? [1] : []
    content {
      sid       = "DecryptWithCmk"
      effect    = "Allow"
      actions   = ["kms:Decrypt", "kms:DescribeKey"]
      resources = var.kms_key_arns
    }
  }

  dynamic "statement" {
    for_each = length(var.artifact_bucket_arns) > 0 ? [1] : []
    content {
      sid     = "ReadArtifacts"
      effect  = "Allow"
      actions = ["s3:GetObject", "s3:ListBucket"]
      resources = concat(
        var.artifact_bucket_arns,
        [for arn in var.artifact_bucket_arns : "${arn}/*"],
      )
    }
  }

  dynamic "statement" {
    for_each = var.ssm_bucket_arn != "" ? [1] : []
    content {
      sid    = "AnsibleSsmTransfer"
      effect = "Allow"
      actions = [
        "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
        "s3:ListBucket", "s3:GetBucketLocation",
      ]
      resources = [var.ssm_bucket_arn, "${var.ssm_bucket_arn}/*"]
    }
  }
}

resource "aws_iam_role_policy" "app" {
  count  = length(var.secret_arns) + length(var.kms_key_arns) + length(var.artifact_bucket_arns) + (var.ssm_bucket_arn != "" ? 1 : 0) > 0 ? 1 : 0
  name   = "${var.name}-app"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.name}-ec2"
  role = aws_iam_role.instance.name
  tags = var.tags
}
