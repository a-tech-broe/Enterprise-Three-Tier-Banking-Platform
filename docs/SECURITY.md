# Security Model

This document records the security posture of the platform, the controls that
are enforced, and the deliberate exceptions surfaced by `checkov`.

## Controls enforced by the code

| Area | Control |
|------|---------|
| **State** | S3 backend is versioned, KMS-encrypted, TLS-enforced, and public-access-blocked; DynamoDB provides locking with PITR. |
| **Network** | Three-tier VPC. DB subnets have no route to the internet. App tier is only reachable from the ALB SG; DB only from the app SG. Default SG denies all. VPC flow logs enabled. |
| **Ingress** | Only the ALB is internet-facing (80→443 redirect, TLS 1.3/1.2 policy). No public IPs on instances; no bastion. |
| **Compute** | IMDSv2 required, encrypted EBS, SSM Session Manager (no inbound SSH), immutable rollouts via ASG instance refresh. |
| **Data** | RDS is private, Multi-AZ (prod), KMS-encrypted, `rds.force_ssl=1`, IAM auth enabled, automated backups + final snapshot. |
| **Secrets** | DB credentials are generated and stored in Secrets Manager (KMS-encrypted); never committed. Instances read them via a least-privilege IAM policy. |
| **Identity** | EC2 instance role is scoped to SSM + CloudWatch + the specific secret/KMS ARNs. CI authenticates to AWS via GitHub OIDC — no long-lived keys. |
| **Host** | Ansible `security` role: SSH hardening, password login disabled, fail2ban, firewalld, sysctl hardening, unattended security updates. |
| **Observability** | CloudWatch alarms → SNS (Teams), dashboards, flow logs, ALB access logs, RDS log exports, Performance Insights. |

## CI/CD guardrails

`terraform fmt` → `validate` → `tflint` → `checkov` → `ansible-lint` run on every
PR. Applies are gated behind a saved plan **and** a GitHub Environment approval.
Destroys require typing the environment name and a second approval.

## Deliberate `checkov` exceptions

These are suppressed in `.checkov.yml` with rationale:

- **CKV_AWS_145 / CKV_AWS_18 / CKV2_AWS_62 / CKV_AWS_144** — the ALB access-log and
  SSM-transfer buckets use SSE-S3 (ELB logging does not support customer KMS
  keys); log buckets are not themselves access-logged (recursion); event
  notifications and cross-region replication are out of scope for these buckets.
- **CKV_AWS_157 / 293 / 150 / 338** — Multi-AZ, deletion protection, and 1-year log
  retention are **enforced in prod** but relaxed in dev/qa to keep ephemeral
  environments cheap and disposable.
- **CKV_AWS_2 / CKV2_AWS_20 / CKV_AWS_103 / CKV_AWS_378** — the ALB module supports an
  HTTP-only fallback for environments without a certificate (dev/test). When a
  cert is present it redirects 80→443 and serves TLS 1.3/1.2; checkov cannot
  evaluate the dynamic cert-present condition, and target groups run HTTP by
  design because TLS terminates at the ALB.
- **CKV_AWS_260** — the ALB is intentionally internet-facing on 80/443.
- **CKV_AWS_109 / 111 / 356** — KMS administration and VPC flow-log delivery require
  the wildcards AWS mandates, scoped by the key/log-group resource.
- **CKV2_AWS_5** — false positive: SGs are attached across module boundaries.
- **CKV2_AWS_38 / CKV2_AWS_39** — DNSSEC signing and DNS query logging on the created
  public hosted zone are optional hardening, enabled per-domain when required.

## Planned follow-ups (tracked gaps)

- **WAFv2** (`CKV2_AWS_28`): attach an AWS-managed rule group web ACL to the public
  ALB. Recommended before handling production traffic for a real bank.
- **Secrets rotation** (`CKV2_AWS_57`): add a Secrets Manager rotation Lambda for
  the RDS master credentials (e.g. 30-day rotation).
- **AWS Shield Advanced / GuardDuty / Security Hub / Config**: enable org-wide
  detective controls.
- **PrivateLink endpoints** for SSM/SSMMessages/EC2Messages/Secrets/ECR to remove
  the last dependence on NAT egress for the app tier.

## Reporting

Report suspected vulnerabilities privately to the platform team; do not open a
public issue.
