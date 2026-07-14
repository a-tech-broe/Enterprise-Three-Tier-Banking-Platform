# Enterprise Three-Tier Banking Platform

A bank wants an automated platform where **every environment (Dev, QA, UAT, Prod)
is created from Git**. No engineer manually creates AWS resources. Terraform
provisions the infrastructure, Ansible configures the instances over SSM (no
bastion, no inbound SSH), and GitHub Actions orchestrates the whole delivery
pipeline with security scanning and a manual approval gate.

> **Status:** IaC, configuration management, and CI/CD are implemented and pass
> `terraform validate` (all envs), `checkov` (0 findings), and `ansible-lint`
> (production profile). CI authenticates to AWS via GitHub OIDC and has been
> exercised end-to-end against a live account (provision → configure over SSM).
> See [`docs/`](docs/) for architecture, runbook, and security notes.

## Architecture

```
GitHub ─► GitHub Actions ─► [ fmt · validate · tflint · checkov · plan ·
                              approval · apply · ansible · smoke · teams ] ─► AWS

VPC (3 AZ)
├── Public Subnets        → ALB (HTTPS w/ ACM, or HTTP)  +  NAT Gateways
├── Private App Subnets   → EC2 ASG: nginx :8080 → banking-api container :8081
│                                    (CloudWatch agent, SSM, pulls image from Docker Hub)
└── Private DB Subnets    → Multi-AZ RDS PostgreSQL (KMS, Secrets Manager)
```

The application tier is a FastAPI banking service ([`app/`](app/)) — accounts,
transactions, and transfers with ledger integrity — that reads its DB credentials
from Secrets Manager and runs as a container behind nginx.

Full diagrams and design rationale: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What Terraform builds

Custom VPC · 3 AZs · Internet Gateway · NAT Gateways · Route Tables · VPC Flow
Logs · S3 Gateway Endpoint · Security Groups (three-tier, least privilege) · IAM
role + instance profile · KMS CMKs · S3 remote-state backend · DynamoDB locking ·
Application Load Balancer · Launch Template (IMDSv2, encrypted EBS) · Auto Scaling
Group (rolling instance refresh, target-tracking) · Multi-AZ-capable RDS
PostgreSQL · Secrets Manager · CloudWatch dashboards/alarms · SNS · S3 buckets for
ALB access logs and the Ansible SSM transfer channel.

**Optional TLS / DNS.** The `dns` module can create a public Route 53 hosted zone,
delegate the registered domain to it, and request + DNS-validate an ACM
certificate, which the ALB then serves on an HTTPS listener (with an 80→443
redirect). When no certificate is configured, the ALB serves HTTP directly — so
an environment without a domain still deploys cleanly. Toggle per environment
with `enable_dns` / `create_hosted_zone` / `zone_name` / `record_name`.

## What Ansible configures

Runs automatically after Terraform, over the **`community.aws.aws_ssm`
connection** (Session Manager + an S3 transfer bucket — no bastion, no inbound
SSH, no key pairs):

`common` (packages, users, timezone, log rotation, security updates) ·
`security` (SSH hardening, disable password login, fail2ban, firewalld, sysctl,
unattended patching) · `java` (Corretto) · `docker` (hardened daemon) ·
`monitoring` (CloudWatch agent + Node Exporter) · `nginx` (reverse proxy + `/health`).

Instances are discovered by the `amazon.aws.aws_ec2` dynamic inventory, filtered
by `Environment` + `Role` tags.

## Repository layout

```
app/                    Banking API (FastAPI): accounts, transactions, transfers
  src/banking/          config · database · models · services · routers
  tests/                pytest suite (in-memory SQLite, no AWS needed)
  Dockerfile  requirements*.txt  pyproject.toml
terraform/
  bootstrap/            S3 + DynamoDB + KMS remote-state backend (run once)
  modules/
    vpc/ security-groups/ kms/ iam/ alb/ ec2/ rds/ cloudwatch/ dns/ ecr/
    platform/           composition module wiring everything together
  environments/
    dev/ qa/ uat/ prod/ thin per-env roots (backend + config-in-code)
ansible/
  inventories/{dev,qa,uat,prod}/   aws_ec2 dynamic inventory + group_vars
  roles/{common,docker,java,nginx,monitoring,security}/
  site.yml  ansible.cfg  requirements.yml
.github/workflows/
  # infra:  bootstrap · validate · infra-plan · infra-deploy · infra-destroy
  # app:    app-ci · app-deploy
docs/
  ARCHITECTURE · RUNBOOK · SECURITY
  oidc-trust-policy.json · iam-deploy-policy.json · parah-access-policy.json
scripts/        bootstrap-backend.sh · setup-oidc.sh
.tflint.hcl  .checkov.yml  .pre-commit-config.yaml  Makefile
```

## Getting started (CI-first, no local tooling)

1. **Add repo config** (Settings → Secrets and variables → Actions — either tab
   works; workflows read `vars.X || secrets.X`):
   `AWS_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`, optional `AWS_REGION`
   (defaults `us-east-1`), plus admin `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
   used only by bootstrap, and optional `TEAMS_WEBHOOK_CONFIGURED` /
   `TEAMS_WEBHOOK_URL`.
2. **Actions → bootstrap → Run workflow** — creates the GitHub OIDC provider,
   sets the role's trust policy for this repo, and grants deploy permissions
   (a scoped customer-managed policy if it can create one, else AWS-managed
   PowerUser + IAMFull). Then delete the admin keys — everything else runs on
   short-lived OIDC.
3. **Actions → deploy → Run workflow → choose env** — plan → approval → apply →
   Ansible (over SSM) → smoke test → Teams.

Full setup, IAM policy details, and the operations runbook:
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) · [`docs/SECURITY.md`](docs/SECURITY.md).

### Local alternative

```bash
# Prereqs: terraform >= 1.5, ansible >= 2.16, aws cli v2 + session-manager-plugin
make galaxy                                   # install Ansible collections
./scripts/bootstrap-backend.sh us-east-1      # create remote-state backend (once)
make init  ENV=dev && make plan ENV=dev && make apply ENV=dev
make configure ENV=dev                        # Ansible over SSM
make check                                    # fmt · validate · tflint · scan · ansible-lint
```

## Pipelines — two separate flows

The **infra** flow provisions/configures the platform; the **app** flow ships the
application onto it. They share nothing but the OIDC role and never run each other.

**Infrastructure** (`terraform/**`, `ansible/**`):
```
PR ─► validate (fmt · tflint · checkov · terraform validate · ansible-lint) + infra-plan comment

infra-deploy (dispatch/push) ─► plan ─► approval ─► apply ─► Ansible ─► smoke ─► Teams
```

**Application** (`app/**`):
```
PR ─► app-ci (ruff · pytest · docker build · Trivy scan)

app-deploy (dispatch/push) ─► test ─► build ─► Trivy scan ─► push Docker Hub
                            ─► publish image URI to SSM ─► roll container on instances ─► verify
```

| Workflow | Deploys | Trigger |
|----------|---------|---------|
| `bootstrap` | OIDC provider + role trust/permissions | one-time |
| `validate` / `infra-plan` | — (checks only) | PR / dispatch |
| **`infra-deploy`** | **infrastructure** (Terraform + base config) | dispatch / push to `terraform`,`ansible` |
| `infra-destroy` | tears down an environment | dispatch (guarded) |
| `app-ci` | — (build/test/scan only) | PR / push to `app/` |
| **`app-deploy`** | **the application** (image → instances) | dispatch / push to `app/` |

- **OIDC only** — no long-lived cloud credentials in the repo or CI (admin keys
  are used once by `bootstrap`, then removed).
- **Approval gates** — `apply` (infra) and `deploy` (app) bind to a GitHub
  Environment; add reviewers on `uat`/`prod` to gate production.
- **App delivery is immutable** — images are tagged by git SHA, pushed to a
  Docker Hub repo (Trivy-scanned pre-push); instances pull the pinned image on boot and on deploy.

## Environments

| Env  | NAT     | RDS       | Deletion protection | Log retention |
|------|---------|-----------|---------------------|---------------|
| dev  | single  | single-AZ | off                 | 30d           |
| qa   | single  | single-AZ | on                  | 60d           |
| uat  | per-AZ  | Multi-AZ  | on                  | 90d           |
| prod | per-AZ  | Multi-AZ  | on                  | 365d          |

Each environment keeps isolated state (`<env>/terraform.tfstate`) and a
non-overlapping VPC CIDR (`10.10/20/30/40.0.0/16`).

## Skills demonstrated

Infrastructure as Code · Configuration Management · Immutable Infrastructure ·
GitOps · DevSecOps · Enterprise Networking · Auto Scaling · IAM (OIDC, least
privilege) · Security · Monitoring.

## License

See [`LICENSE`](LICENSE).
