# Enterprise Three-Tier Banking Platform

A bank wants an automated platform where **every environment (Dev, QA, UAT, Prod)
is created from Git**. No engineer manually creates AWS resources. Terraform
provisions the infrastructure, Ansible configures the instances, and GitHub
Actions orchestrates the whole delivery pipeline with security scanning and
manual approval gates.

> Status: infrastructure-as-code, configuration management, and CI/CD are
> implemented and pass `terraform validate`, `checkov` (0 findings), and
> `ansible-lint` (production profile). See [`docs/`](docs/) for details.

## Architecture

```
GitHub ─► GitHub Actions ─► [ fmt · validate · tflint · checkov · plan ·
                              approval · apply · ansible · smoke · slack ] ─► AWS

VPC (3 AZ)
├── Public Subnets        → ALB (ACM/TLS, access logs)  +  NAT Gateways
├── Private App Subnets   → EC2 Auto Scaling Group (nginx, CloudWatch agent, SSM)
└── Private DB Subnets    → Multi-AZ RDS PostgreSQL (KMS, Secrets Manager)
```

Full diagrams and design rationale: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What Terraform builds

Custom VPC · 3 AZs · Internet Gateway · NAT Gateways · Route Tables · VPC Flow
Logs · S3 Gateway Endpoint · Security Groups (three-tier, least privilege) · IAM
roles + instance profile · KMS CMKs · S3 remote-state backend · DynamoDB locking
· Application Load Balancer (HTTP→HTTPS) · Launch Template (IMDSv2, encrypted
EBS) · Auto Scaling Group (rolling instance refresh, target-tracking) · ACM
certificate · Route53 · Multi-AZ RDS PostgreSQL · Secrets Manager · CloudWatch
dashboards/alarms · SNS notifications.

## What Ansible configures

Runs automatically after Terraform, over **SSM Session Manager** (no bastion, no
inbound SSH):

`common` (packages, users, timezone, log rotation, security updates) ·
`security` (SSH hardening, disable password login, fail2ban, firewalld, sysctl,
unattended patching) · `java` (Corretto) · `docker` (hardened daemon) ·
`monitoring` (CloudWatch agent + Node Exporter) · `nginx` (reverse proxy +
health endpoint) · then deploys the application.

## Repository layout

```
terraform/
  bootstrap/            S3 + DynamoDB + KMS remote-state backend (run once)
  modules/
    vpc/ security-groups/ kms/ iam/ alb/ ec2/ rds/ cloudwatch/ dns/
    platform/           composition module wiring everything together
  environments/
    dev/ qa/ uat/ prod/ thin per-env roots (backend + tfvars-in-code)
ansible/
  inventories/{dev,qa,uat,prod}/   aws_ec2 dynamic inventory + group_vars
  roles/{common,docker,java,nginx,monitoring,security}/
  site.yml  ansible.cfg  requirements.yml
.github/workflows/
  validate.yml  plan.yml  deploy.yml  destroy.yml
docs/           ARCHITECTURE · RUNBOOK · SECURITY
scripts/        bootstrap-backend.sh
.tflint.hcl  .checkov.yml  .pre-commit-config.yaml  Makefile
```

## Quick start

```bash
# 0. Prereqs: terraform >= 1.5, ansible >= 2.16, aws cli v2 + session-manager-plugin
make galaxy                                   # install Ansible collections

# 1. Create the remote-state backend for your account (once)
./scripts/bootstrap-backend.sh us-east-1      # writes backend.hcl into each env

# 2. Provision an environment
make init  ENV=dev
make plan  ENV=dev
make apply ENV=dev

# 3. Configure the instances
make configure ENV=dev

# Run every local quality gate
make check                                    # fmt · validate · tflint · scan · ansible-lint
```

In CI, use **Actions → deploy** (plan → approval → apply → Ansible → smoke →
Slack). Setup details: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Pipeline

```
Pull Request ─► terraform fmt ─► validate ─► tflint ─► checkov ─► ansible-lint
                                                                      │  (plan comment on PR)
main / dispatch ─► plan ─► manual approval ─► apply ─► Ansible ─► smoke test ─► notify Slack
```

Authentication to AWS uses **GitHub OIDC** — there are no long-lived cloud
credentials in the repo or in CI.

## Skills demonstrated

Infrastructure as Code · Configuration Management · Immutable Infrastructure ·
GitOps · DevSecOps · Enterprise Networking · Auto Scaling · IAM · Security ·
Monitoring.

## License

See [`LICENSE`](LICENSE).
