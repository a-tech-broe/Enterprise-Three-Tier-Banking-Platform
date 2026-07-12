# Architecture

## Topology

```
                            Internet
                               │  443 / 80→443
                    ┌──────────▼───────────┐
                    │   Application LB      │  public subnets (3 AZ)
                    │   (ACM TLS, WAF-ready)│  access logs → S3
                    └──────────┬───────────┘
                        app_port│ (SG: ALB → App only)
        ┌──────────────────────┼──────────────────────┐
        │            Private App Subnets (3 AZ)        │
        │   ┌────────┐   ┌────────┐   ┌────────┐       │
        │   │  EC2   │   │  EC2   │   │  EC2   │  ASG   │
        │   │ nginx  │   │ nginx  │   │ nginx  │  +CW   │
        │   └────────┘   └────────┘   └────────┘        │
        └──────────────────────┼──────────────────────┘
                        5432    │ (SG: App → DB only)
        ┌──────────────────────┼──────────────────────┐
        │        Private DB Subnets (3 AZ, no NAT)     │
        │        Multi-AZ RDS PostgreSQL (KMS)         │
        └───────────────────────────────────────────────┘

Egress: private subnets → NAT gateway(s) → IGW   (S3 via gateway endpoint)
```

## Module dependency graph

```
kms ──┬─────────────► rds ──► iam ──┐
      │                             ├──► ec2 (launch template + ASG)
vpc ──┼──► security-groups ─────────┘        │
      │                                       ▼
      └──► (subnets) ──► alb ◄── dns (ACM+Route53)
                          │
                          └──► cloudwatch (alarms, dashboard, SNS)
```

`modules/platform` composes all of the above; each environment
(`environments/<env>`) is a thin caller supplying env-specific inputs.

## Environments

| Env  | NAT        | RDS       | Deletion protection | Sizing | Log retention |
|------|------------|-----------|---------------------|--------|---------------|
| dev  | single     | single-AZ | off                 | small  | 30d           |
| qa   | single     | single-AZ | on                  | medium | 60d           |
| uat  | per-AZ     | Multi-AZ  | on                  | medium | 90d           |
| prod | per-AZ     | Multi-AZ  | on                  | large  | 365d          |

Each environment keeps isolated state (`<env>/terraform.tfstate`) in the shared
S3 backend and a non-overlapping VPC CIDR (`10.10/20/30/40.0.0/16`).

## Request flow

1. Client hits `https://app.<env>...` → Route53 alias → ALB.
2. ALB terminates TLS (ACM cert), forwards to a healthy target on `app_port`.
3. `nginx` on the instance serves `/health` and reverse-proxies `/` to the app.
4. App reads DB credentials from Secrets Manager and connects to RDS over TLS.

## Design decisions

- **Immutable infrastructure** — instances are cattle. Changes to the launch
  template trigger an ASG rolling instance refresh rather than in-place edits.
- **No bastion / no inbound SSH** — operators and Ansible reach hosts through SSM
  Session Manager, shrinking the attack surface.
- **GitOps** — every environment is reproducible from Git; humans never click in
  the console. CI uses OIDC, so there are no static cloud credentials anywhere.
- **State isolation** — one state file per environment, with locking, so a broken
  dev apply cannot corrupt prod.
