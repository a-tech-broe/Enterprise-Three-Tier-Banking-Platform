# Operations Runbook

## Prerequisites

- Terraform >= 1.5, Ansible >= 2.16, AWS CLI v2 + Session Manager plugin.
- An AWS account and an IAM role that GitHub Actions can assume via OIDC.

## One-time: create the remote-state backend

```bash
cd terraform/bootstrap
terraform init
terraform apply -var="state_bucket_name=banking-platform-tfstate-<ACCOUNT_ID>"
terraform output backend_config_hint     # copy into each env's backend.hcl
```

## One-time: wire GitHub

Create these **repository variables** (Settings → Secrets and variables → Actions):

| Variable | Example |
|----------|---------|
| `AWS_ROLE_ARN` | `arn:aws:iam::<acct>:role/github-oidc-banking-platform` |
| `AWS_REGION` | `us-east-1` |
| `TF_STATE_BUCKET` | `banking-platform-tfstate-<acct>` |
| `TF_LOCK_TABLE` | `banking-platform-tf-locks` |
| `SLACK_WEBHOOK_CONFIGURED` | `true` (optional) |

Secrets: `SLACK_WEBHOOK_URL` (optional). Create GitHub **Environments**
`dev/qa/uat/prod` and add required reviewers on `uat` and `prod` to gate applies.

## Deploy an environment

Via CI (recommended): **Actions → deploy → Run workflow → choose env**. The run
plans, waits for approval, applies, runs Ansible over SSM, smoke-tests `/health`,
and notifies Slack.

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
