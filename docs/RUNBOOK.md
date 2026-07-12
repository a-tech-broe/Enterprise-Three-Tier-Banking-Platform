# Operations Runbook

## Prerequisites

- An AWS account, an IAM role for CI, and an S3 bucket + DynamoDB table for state.
- Local tooling (Terraform/Ansible/AWS CLI) is only needed if you run outside CI.

## One-time setup — fully automated, no local CLI

The entire AWS-side wiring (OIDC provider, role trust policy, role permissions,
and optionally the state backend) is provisioned by the **`bootstrap` workflow**.
You only set repository config, then click one button.

**1. Add config** (Settings → Secrets and variables → Actions). Values may live
in either the **Variables** or **Secrets** tab — the workflows read both:

| Name | Example | Notes |
|------|---------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::<acct>:role/github-actions-terraform` | role CI assumes via OIDC |
| `TF_STATE_BUCKET` | `banking-platform-tfstate-<acct>` | existing state bucket |
| `TF_LOCK_TABLE` | `banking-platform-tf-locks` | existing lock table (hash key `LockID`) |
| `AWS_REGION` | `us-east-1` | optional; defaults to `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | **admin** keys, used only by `bootstrap` |
| `TEAMS_WEBHOOK_CONFIGURED` / `TEAMS_WEBHOOK_URL` | `true` / webhook | optional notifications |

**2. Run bootstrap** — **Actions → bootstrap → Run workflow**. Using the admin
keys, it creates the OIDC provider (if missing), applies the repo-scoped trust
policy, and attaches the deploy permissions policy to the role. Tick
`create_backend` if you also want it to create the S3 bucket + DynamoDB table.

**3. Delete the admin keys** — once bootstrap succeeds, remove
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Everything else runs on
short-lived OIDC credentials.

**4. Environments** — create GitHub **Environments** `dev/qa/uat/prod` and add
required reviewers on `uat`/`prod` to gate applies (the only intentional manual
step: production approval).

> Prefer to do the AWS-side setup from your laptop instead? `scripts/setup-oidc.sh`
> and `docs/{oidc-trust-policy,iam-deploy-policy}.json` do the same thing manually.

## Deploy an environment

Via CI (recommended): **Actions → deploy → Run workflow → choose env**. The run
plans, waits for approval, applies, runs Ansible over SSM, smoke-tests `/health`,
and notifies Teams.

Locally:

```bash
make bootstrap                      # first time only
cp terraform/environments/dev/backend.hcl.example terraform/environments/dev/backend.hcl
make init  ENV=dev
make plan  ENV=dev
make apply ENV=dev
make configure ENV=dev              # Ansible
```

## Common tasks

**Roll the fleet (new AMI / config):** update the launch template input and apply;
the ASG performs a rolling instance refresh automatically. Watch:

```bash
aws autoscaling describe-instance-refreshes --auto-scaling-group-name <asg>
```

**Fetch DB credentials:**

```bash
aws secretsmanager get-secret-value --secret-id banking-platform-<env>/rds/credentials \
  --query SecretString --output text | jq .
```

**Connect to an instance (no SSH):**

```bash
aws ssm start-session --target <instance-id>
```

**Tail application logs:** CloudWatch Logs group `/banking-platform/<env>/app`.

## Incident response

| Symptom | First checks |
|---------|--------------|
| 5xx from ALB | Target group health; `nginx`/app logs; `*-alb-5xx` alarm; recent deploy. |
| Unhealthy hosts | ASG activity history; instance status; `/health` on the instance via SSM. |
| DB failover | RDS events; `*-rds-high-cpu` / connections; Multi-AZ status. |
| Low DB storage | `*-rds-low-storage` alarm; storage autoscaling headroom (`max_allocated_storage`). |

## Rollback

Terraform state is versioned in S3. To revert infrastructure, re-apply the prior
commit. For application rollbacks, redeploy the previous artifact/AMI which
triggers a fresh instance refresh. RDS can be restored from automated backups or
the retained final snapshot.

## Teardown

**Actions → destroy → Run workflow**, choose the env, and type its name to
confirm. Prod additionally requires environment approval. Dev sets
`skip_final_snapshot=true`; every other env retains a final RDS snapshot.
```
