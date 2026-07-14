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

The `configure` step connects over SSM using the `community.aws.aws_ssm` plugin.
Terraform creates the required S3 transfer bucket (`banking-platform-<env>-ansible-ssm-<acct>`)
and grants the instance role access; CI and the Makefile pass its name to Ansible
automatically — no manual setup.

## Deploying the application

Infra and app deploy through **separate** pipelines. After the infra exists:

**Actions → app-deploy → Run workflow → choose env.** It runs `ruff` + `pytest`,
builds the image, scans it with Trivy (fails on HIGH/CRITICAL), pushes to the
env's ECR repo tagged by git SHA, publishes the image URI to SSM
(`/banking-platform/<env>/app_image`), and rolls the container on the app
instances via SSM (each runs `systemctl restart banking-app`, which re-pulls and
restarts). New/scaled ASG instances self-deploy the same image on boot from
user-data, so the fleet stays consistent.

Locally, from `app/`: `ruff check src tests && pytest`, then
`docker build -t banking-platform-api .`.

Roll back by re-running `app-deploy` for the previous commit (its SHA-tagged image
is still in ECR), or `aws ssm put-parameter --name /banking-platform/<env>/app_image`
with the prior image URI and restart the service.

## Enabling HTTPS on a domain

Environments default to **HTTP** (the ALB serves the app at its AWS DNS name), so
they deploy without a domain. To serve HTTPS on your own domain:

1. In `terraform/environments/<env>/main.tf` set `enable_dns = true`, plus
   `zone_name` / `record_name`, and `create_hosted_zone = true` if no public zone
   exists yet.
2. `apply` once — it creates the hosted zone, cert request, and validation
   records. Read the `zone_name_servers` output.
3. **Delegate the registered domain to those name servers at your registrar**
   (Route 53 Domains → *Edit name servers*, or your external registrar). This is a
   one-time, out-of-band step — registrar management is intentionally not in the
   pipeline.
4. `apply` again — ACM validates over public DNS, the HTTPS listener and the
   `record_name` alias are created, and `app_url` becomes `https://<record_name>`.

## Common tasks

**Roll the fleet (new AMI / config):** update the launch template input and apply;
the ASG performs a rolling instance refresh automatically. Instances self-bootstrap
nginx + `/health` from user-data, so refreshed/scaled instances pass ALB health
checks without waiting for Ansible. Watch:

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
