# Building a Bank on AWS Where Every Environment Comes From Git

### A hands-on guide to a production-grade, three-tier platform: Terraform for the infrastructure, Ansible over SSM for configuration, GitHub Actions for delivery — and not a single click in the AWS console.

---

Most "deploy an app to AWS" tutorials stop at a load balancer, an EC2 instance, and a `terraform apply` you run from your laptop. Real banks don't work like that. In a regulated environment, *no engineer manually creates a resource*. Every environment — Dev, QA, UAT, Prod — is reconstructable from a Git commit. Credentials are short-lived. Production changes are deliberate, gated, and auditable.

This article walks through a project that does exactly that: the **Enterprise Three-Tier Banking Platform**. It's a real, working system — a FastAPI banking app with a React UI, running behind an Application Load Balancer, on an Auto Scaling Group of hardened EC2 instances, talking to a Multi-AZ RDS PostgreSQL database — and *all of it* is provisioned and delivered by code.

By the end you'll understand not just *what* it builds, but *why* each decision was made, and you'll be able to stand the whole thing up in your own AWS account.

> **What you'll learn:** GitOps and Infrastructure as Code with Terraform modules; configuration management with Ansible over AWS Session Manager (no bastion, no SSH keys); DevSecOps pipelines with GitHub OIDC, Checkov, Trivy, and manual approval gates; immutable infrastructure with ASG instance refresh; and a clean split between an *infrastructure* pipeline and an *application* pipeline.

---

## The 30-second architecture

```
GitHub ─► GitHub Actions ─► [ fmt · validate · tflint · checkov · plan ·
                              approval · apply · ansible · smoke · teams ] ─► AWS

VPC (3 AZ)
├── Public Subnets        → ALB (HTTPS w/ ACM)  +  NAT Gateways
├── Private App Subnets   → EC2 ASG: nginx :8080 → banking-api container :8081
│                                    (CloudWatch agent, SSM, pulls image from Docker Hub)
└── Private DB Subnets    → Multi-AZ RDS PostgreSQL (KMS, Secrets Manager)
```

Three tiers, three subnet groups, three availability zones. Traffic only flows **inward**: the internet can reach the ALB, the ALB can reach the app tier, the app tier can reach the database — and nothing can reach *back out* except through a NAT gateway. The database subnets have no route to the internet at all.

Everything you see in that diagram is Terraform. Everything *inside* the instances is Ansible. Everything that decides *when* things change is GitHub Actions.

---

## The five principles that shape every decision

Before the code, internalize the design philosophy — it explains the "why" behind every module.

**1. GitOps — Git is the single source of truth.** Every environment is reproducible from a commit. Humans never click in the console. If it isn't in the repo, it doesn't exist.

**2. Immutable infrastructure — servers are cattle, not pets.** You never SSH in to patch a running box. You change the launch template, and the Auto Scaling Group performs a *rolling instance refresh* — new instances come up, old ones drain and die. This kills configuration drift.

**3. No long-lived credentials.** CI authenticates to AWS via **GitHub OIDC** — short-lived tokens minted per workflow run. There are no `AWS_SECRET_ACCESS_KEY` values sitting in your repo (except a one-time admin key used to bootstrap, which you delete immediately after).

**4. No bastion, no inbound SSH.** Operators and Ansible reach instances through **SSM Session Manager**. There are no key pairs, no port 22 open to the world, no jump box to maintain. This dramatically shrinks the attack surface.

**5. Least privilege everywhere.** Security groups reference each other, not CIDR ranges. The EC2 instance role can read *one specific secret* and *one specific KMS key* — not "secretsmanager:\*".

Keep these five in mind and the rest of the design reads like a straight line.

---

## Part 1 — The infrastructure, tier by tier

The Terraform lives under `terraform/` and is organized into three layers:

```
terraform/
  bootstrap/            S3 + DynamoDB + KMS remote-state backend (run once)
  modules/
    vpc/ security-groups/ kms/ iam/ alb/ ec2/ rds/ cloudwatch/ dns/
    platform/           composition module wiring everything together
  environments/
    dev/ qa/ uat/ prod/ thin per-env roots (backend + config-in-code)
```

This layering is the single most important structural idea, so let's unpack it.

### Modules, a composition module, and thin environments

A **module** (e.g. `modules/vpc`) knows how to build *one thing* well and knows nothing about environments. The **`platform` composition module** wires all the modules together in the right dependency order. And each **environment root** (`environments/dev`) is a *thin caller* — it does almost nothing except pass environment-specific values into `platform`.

Here's the entire dev environment's `main.tf`, lightly trimmed. Notice how little there is — it's configuration, not logic:

```hcl
module "platform" {
  source = "../../modules/platform"

  project     = "banking-platform"
  environment = "dev"
  aws_region  = "us-east-1"

  # Networking — a non-overlapping /16 per environment
  vpc_cidr                 = "10.10.0.0/16"
  azs                      = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs      = ["10.10.0.0/24", "10.10.1.0/24", "10.10.2.0/24"]
  private_app_subnet_cidrs = ["10.10.10.0/24", "10.10.11.0/24", "10.10.12.0/24"]
  private_db_subnet_cidrs  = ["10.10.20.0/24", "10.10.21.0/24", "10.10.22.0/24"]
  single_nat_gateway       = true          # dev is cost-optimised

  # Compute — small & cheap for dev
  instance_type        = "t3.medium"
  asg_min_size         = 1
  asg_max_size         = 3
  asg_desired_capacity = 1

  # Database — single-AZ, disposable
  db_instance_class      = "db.t3.small"
  db_multi_az            = false
  db_deletion_protection = false
  db_skip_final_snapshot = true

  log_retention_days = 30
}
```

The `prod` root is the *same shape* with different numbers: `single_nat_gateway = false` (one NAT per AZ for HA), `db_multi_az = true`, `db_deletion_protection = true`, bigger instances, 365-day log retention. This is how you get four consistent environments that differ *only* where they should.

Each environment also keeps **isolated state** (`<env>/terraform.tfstate`) and a **non-overlapping CIDR** (`10.10/20/30/40.0.0/16`). A broken `dev` apply physically cannot corrupt `prod` state.

| Env  | NAT     | RDS       | Deletion protection | Log retention |
|------|---------|-----------|---------------------|---------------|
| dev  | single  | single-AZ | off                 | 30d           |
| qa   | single  | single-AZ | on                  | 60d           |
| uat  | per-AZ  | Multi-AZ  | on                  | 90d           |
| prod | per-AZ  | Multi-AZ  | on                  | 365d          |

### The module dependency graph

Terraform figures out ordering from references, but it helps to see the intended shape:

```
kms ──┬─────────────► rds ──► iam ──┐
      │                             ├──► ec2 (launch template + ASG)
vpc ──┼──► security-groups ─────────┘        │
      │                                       ▼
      └──► (subnets) ──► alb ◄── dns (ACM+Route53)
                          │
                          └──► cloudwatch (alarms, dashboard, SNS)
```

- **`kms`** creates the customer-managed keys first, because RDS, secrets, and EBS all need them.
- **`vpc`** builds the three-tier network: IGW, NAT gateway(s), route tables, VPC Flow Logs, and an S3 gateway endpoint (so instances pull from S3 without touching the NAT).
- **`security-groups`** implements the three-tier firewall by *reference*: the app SG allows ingress only from the ALB SG; the DB SG allows `5432` only from the app SG. No CIDR guessing.
- **`iam`** builds the EC2 instance role — scoped to SSM, CloudWatch, and the *specific* secret/KMS ARNs.
- **`rds`** stands up PostgreSQL, generates a password, and stores it in Secrets Manager (never in state as plaintext, never committed).
- **`alb`** and **`dns`** put a TLS-terminating load balancer in the public subnets, optionally with an ACM certificate validated via Route 53.
- **`cloudwatch`** wires up alarms, a dashboard, and an SNS topic (which can fan out to Microsoft Teams).

### The remote-state backend (run this once)

Before *any* environment, you need somewhere to keep Terraform state. `terraform/bootstrap` builds it: a **versioned, KMS-encrypted, TLS-enforced, public-access-blocked S3 bucket** plus a **DynamoDB table for state locking** (with point-in-time recovery). Versioning means you can roll back state; locking means two applies can't stomp each other.

```bash
./scripts/bootstrap-backend.sh us-east-1   # or: make bootstrap
```

This is the one piece of infrastructure that can't manage its own state (chicken and egg), so it's deliberately separate and run once per account.

---

## Part 2 — Configuration management with Ansible over SSM

Terraform gets you *running instances*. Ansible makes them *correct instances*. The clever part here is **how** Ansible connects.

Traditional Ansible needs SSH — which means open port 22, key pairs to distribute and rotate, and often a bastion host. This project uses none of that. It connects over the **`community.aws.aws_ssm` connection plugin**, which tunnels through **AWS Session Manager** using an S3 bucket as the file-transfer channel:

- No inbound SSH. No port 22. No bastion.
- No key pairs to manage or leak.
- Every session is IAM-authenticated and logged.

Instances are discovered dynamically by the **`amazon.aws.aws_ec2` inventory plugin**, filtered by `Environment` and `Role` tags — so Ansible always targets exactly the right hosts without a static inventory file to maintain.

The roles applied by `ansible/site.yml`:

| Role | What it does |
|------|--------------|
| `common` | packages, users, timezone, log rotation, security updates |
| `security` | SSH hardening, disable password login, fail2ban, firewalld, sysctl hardening, unattended patching |
| `java` | Amazon Corretto |
| `docker` | hardened Docker daemon |
| `monitoring` | CloudWatch agent + Node Exporter |
| `nginx` | reverse proxy + `/health` endpoint |

One subtlety worth calling out: the instances **self-bootstrap enough to pass health checks from first boot** via EC2 user-data (nginx + `/health` come up immediately), and Ansible then layers on the full hardened configuration. That way an ASG scale-out event doesn't have to wait for an Ansible run to serve traffic — but every instance still converges to the same hardened baseline.

---

## Part 3 — The application (so there's something to deploy)

The platform exists to run **Atechbroe Bank**, and the app is genuinely full-featured — not a "hello world" health check.

It's a **FastAPI** service (`app/src/banking/`) with:

- **JWT auth** (register / login) with bcrypt password hashing, every route scoped to the calling user.
- **Accounts, deposits, withdrawals, transfers** with ledger integrity — money is stored as **integer cents end-to-end**, never floats.
- **Statements** with date filtering, search, and CSV export; **spending insights**.
- **Account actions** (rename / freeze / close) and a **password-reset flow** over SES email.
- An **admin / back-office** view (see all accounts, reverse a transaction), gated by an `ADMIN_EMAILS` allowlist.
- **45 pytest cases** covering auth, user isolation, ledger correctness, admin, and reset flows.

A neat packaging decision: the **React + Vite web UI** (`app/web/`) is *built and bundled into the same container image*. FastAPI serves the SPA at `/`, the JSON API under `/api/v1/*`, and Swagger at `/docs`. One image, one URL, one deployable. Here's the mount logic that makes the API and the SPA coexist:

```python
@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str) -> FileResponse:
    # Unknown API/docs paths must 404 as usual, not fall back to HTML.
    if full_path.startswith(("api/", "health", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404)
    target = (WEB_DIST_DIR / full_path).resolve()
    if full_path and target.is_file() and root in target.parents:
        return FileResponse(str(target))   # favicon, static assets, etc.
    return FileResponse(str(index))        # SPA entrypoint / client routes
```

Another production-minded touch: the app **starts in degraded mode rather than crash-looping** if the database is briefly unreachable at boot. `/health` (liveness) always answers so the ALB keeps the container in service; `/health/ready` (readiness) reports actual DB connectivity separately.

Runtime config comes entirely from the environment — **DB credentials from Secrets Manager**, a **KMS-encrypted JWT signing secret from SSM** (shared across instances so tokens validate behind the ALB), and the admin allowlist. Nothing secret is baked into the image.

---

## Part 4 — Two pipelines that never touch each other

This is where the design really pays off. There are **two independent delivery flows**, and they share nothing but the OIDC role:

**Infrastructure pipeline** (`terraform/**`, `ansible/**`):
```
PR ─► validate (fmt · tflint · checkov · terraform validate · ansible-lint) + plan comment

infra-deploy ─► plan ─► approval ─► apply ─► Ansible ─► smoke ─► Teams
```

**Application pipeline** (`app/**`):
```
PR ─► app-ci (ruff · pytest · docker build · Trivy scan)

app-deploy ─► test ─► build ─► Trivy scan ─► push Docker Hub
            ─► publish image URI to SSM ─► roll container on instances ─► verify
```

Why split them? Because **shipping a new version of the app should not re-plan your VPC**, and changing a subnet should not rebuild your Docker image. The infra pipeline changes *the platform*; the app pipeline changes *what runs on it*. They move at different speeds, carry different risk, and are owned by different concerns.

### The promotion model: auto to dev, deliberate above it

Both pipelines follow the same rule:

- A **push to the `dev` branch** deploys straight to the **dev** environment. Fast feedback, no ceremony.
- **qa / uat / prod deploy only via an explicit `workflow_dispatch`** — you go to Actions, click *Run workflow*, and choose the environment. **Merging to `main` never auto-deploys production.** Production is always a deliberate, manual act.
- For an extra gate, add **required reviewers** to the `prod` (and `uat`) GitHub Environment. The deploy job binds to that environment and *pauses for human approval* before applying.

Here's the heart of the infra-deploy workflow — note how the `apply` job binds to a GitHub Environment, which is where the approval gate lives:

```yaml
apply:
  name: apply
  needs: plan
  runs-on: ubuntu-latest
  environment: ${{ needs.plan.outputs.target }}   # <-- manual approval happens here
  steps:
    - uses: actions/checkout@v4
    - name: Configure AWS credentials (OIDC)
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ vars.AWS_ROLE_ARN || secrets.AWS_ROLE_ARN }}
        aws-region: ${{ env.AWS_REGION }}
        role-session-name: gha-deploy-apply
    - uses: actions/download-artifact@v4          # the *exact* plan we reviewed
      with: { name: deploy-plan-${{ needs.plan.outputs.target }} }
    - name: Init & apply saved plan
      run: terraform apply -input=false -auto-approve tfplan.bin
```

Two things to notice. First, there are **no static AWS credentials** — `configure-aws-credentials` mints a short-lived token via OIDC. Second, the job applies the **exact saved plan** (`tfplan.bin`) that was generated and reviewed in the `plan` job. You approve *what you saw*, not a fresh plan that might have drifted.

### How the app actually rolls out

The `app-deploy` flow is a small masterpiece of "immutable but fast." When you ship:

1. `ruff` + `pytest` run. Then the image is built (API + bundled web UI).
2. **Trivy scans the image** and *fails the build on HIGH/CRITICAL vulnerabilities*.
3. The image is pushed to Docker Hub, tagged by environment + git SHA (e.g. `dev-sha-4a15dee`) — immutable and traceable.
4. The image URI is published to **SSM Parameter Store** (`/banking-platform/<env>/app_image`).
5. An **SSM `send-command`** targets instances by tag and runs `systemctl restart banking-app`, which re-pulls the pinned image and restarts the container — then curls `/health` to verify.

The elegant part is the `banking-app` systemd service defined in user-data. On **every boot** it reads the current image URI from SSM, pulls it, and starts the container:

```bash
IMAGE="$(aws ssm get-parameter --name "$PARAM" --query 'Parameter.Value' --output text)"
docker pull "$IMAGE"
docker run -d --name banking-app --restart unless-stopped \
  -p 127.0.0.1:8081:8081 \
  -e DB_SECRET_ARN="$DB_SECRET_ARN" \
  -e ADMIN_EMAILS="$ADMIN_EMAILS" \
  "${JWT_ARG[@]}" \
  "$IMAGE"
```

This means **ASG scale-out and instance refresh self-deploy the current app** — a brand-new instance pulls the same pinned image the rest of the fleet is running. The fleet stays consistent without any orchestration server. Rollback is just re-running `app-deploy` at an older commit (its SHA-tagged image is still on Docker Hub).

---

## Part 5 — Build it yourself

There are two paths. The **CI-first path** needs zero local tooling — you only click buttons in GitHub. The **local path** is there if you prefer running Terraform from your laptop.

### Prerequisites

- An AWS account.
- A GitHub repo (fork this one).
- Optionally: a domain in Route 53 if you want real HTTPS (the platform serves plain HTTP at the ALB DNS name without one, so a domain is *not* required).

### Step 1 — Add repository configuration

In **Settings → Secrets and variables → Actions**, add (either the Variables or Secrets tab works — the workflows read `vars.X || secrets.X`):

| Name | Example | Notes |
|------|---------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::<acct>:role/github-actions-terraform` | role CI assumes via OIDC |
| `TF_STATE_BUCKET` | `banking-platform-tfstate-<acct>` | state bucket |
| `TF_LOCK_TABLE` | `banking-platform-tf-locks` | lock table (hash key `LockID`) |
| `AWS_REGION` | `us-east-1` | optional; defaults to `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | **admin** keys, used *only* by bootstrap |
| `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | — | for a **public** Docker Hub repo |

### Step 2 — Bootstrap the AWS-side wiring (one click)

Go to **Actions → bootstrap → Run workflow**. Using the admin keys once, it:

- creates the **GitHub OIDC provider** in your account (if missing),
- applies the **repo-scoped trust policy** so only *this* repo can assume the role,
- attaches the **deploy permissions** (a scoped customer-managed policy if it can create one, else AWS-managed PowerUser + IAMFull),
- optionally creates the S3 + DynamoDB state backend (tick `create_backend`).

**Then delete the admin keys.** From here on, everything runs on short-lived OIDC tokens. This is the whole point — the powerful static credential exists for exactly one workflow run and then it's gone.

### Step 3 — Create GitHub Environments

Create Environments named `dev`, `qa`, `uat`, `prod`. Add **required reviewers** on `uat` and `prod` so applies to those environments pause for approval. This is the intentional human gate on production.

### Step 4 — Deploy the infrastructure

**Actions → infra-deploy → Run workflow → choose `dev`.** Watch it: plan → (approval, if configured) → apply → Ansible over SSM → smoke test `/health` → Teams notification. When it's green, your VPC, ALB, ASG, and RDS exist, and the instances have Docker and the self-deploying `banking-app` service ready.

### Step 5 — Ship the application

**Actions → app-deploy → Run workflow → choose `dev`.** It tests, builds, Trivy-scans, pushes to Docker Hub, publishes the image URI to SSM, and rolls the container on your instances.

> Run `infra-deploy` at least once *before* the first `app-deploy`, so the instances actually have the container runtime. (The workflow even detects this case and tells you.)

Then open the app — either your ALB's DNS name over HTTP, or your custom domain over HTTPS if you enabled DNS. Register an account, sign in, move some money. Any email in `admin_emails` gets the **Admin** back-office view.

### The local alternative

If you'd rather drive it from your laptop (needs `terraform >= 1.5`, `ansible >= 2.16`, AWS CLI v2 + the session-manager-plugin):

```bash
make galaxy                                   # install Ansible collections
./scripts/bootstrap-backend.sh us-east-1      # create remote-state backend (once)
make init  ENV=dev && make plan ENV=dev && make apply ENV=dev
make configure ENV=dev                        # Ansible over SSM
make check                                    # fmt · validate · tflint · scan · ansible-lint
```

`make check` is worth running before every push — it's the same gauntlet CI runs (`terraform fmt`, `validate`, `tflint`, `checkov`, `ansible-lint`), so you catch problems locally instead of in a failed pipeline.

---

## Part 6 — Turning on real HTTPS (optional)

By default, environments serve **HTTP** at the ALB's AWS DNS name, so they deploy cleanly with no domain. To serve HTTPS on your own domain, set a few flags in `environments/<env>/main.tf`:

```hcl
enable_dns                   = true
create_hosted_zone           = true      # if no public zone exists yet
manage_registrar_nameservers = true      # only if the domain is in this account's Route 53 Domains
zone_name                    = "yourbank.com"
record_name                  = "yourbank.com"
```

The `dns` module creates a Route 53 hosted zone, requests an ACM certificate, and DNS-validates it. If your domain is registered in the same account's Route 53 Domains, Terraform *also* delegates it to the new zone automatically (`aws_route53domains_registered_domain`) — so cert validation completes in the same apply, no manual registrar step. The ALB then serves TLS 1.3/1.2 with an 80→443 redirect. (If your domain is at an external registrar, you point its name servers at the `zone_name_servers` output once, then apply again.)

---

## The security model, in one glance

This is a *bank*, so security isn't a footnote. What the code enforces:

- **State**: versioned, KMS-encrypted, TLS-enforced, public-access-blocked S3; DynamoDB locking with PITR.
- **Network**: three-tier VPC; DB subnets have no internet route; app tier reachable only from the ALB SG; DB only from the app SG; default SG denies all; VPC flow logs on.
- **Ingress**: only the ALB is internet-facing; 80→443 redirect; TLS 1.3/1.2 policy; no public IPs on instances; no bastion.
- **Compute**: IMDSv2 required, encrypted EBS, SSM Session Manager, immutable rollouts via instance refresh.
- **Data**: RDS private, Multi-AZ (prod), KMS-encrypted, `force_ssl`, IAM auth, automated backups + final snapshot.
- **Secrets**: DB credentials generated into Secrets Manager (KMS-encrypted), never committed; instances read them via a least-privilege policy.
- **Identity**: EC2 role scoped to SSM + CloudWatch + specific ARNs; CI via OIDC, zero long-lived keys.
- **CI/CD guardrails**: `fmt → validate → tflint → checkov → ansible-lint` on every PR; applies gated behind a saved plan *and* an Environment approval; destroys require typing the environment name plus a second approval.

The repo is honest about its edges, too. `docs/SECURITY.md` documents each **deliberate Checkov exception** with a rationale (e.g. dev relaxes Multi-AZ and long log retention to stay cheap and disposable; ALB access-log buckets use SSE-S3 because ELB logging doesn't support customer KMS keys), and it tracks **planned follow-ups** — WAFv2 on the ALB, Secrets Manager rotation, GuardDuty/Security Hub/Config, and PrivateLink endpoints to drop the last NAT dependency. That kind of documented, reasoned exception list is exactly what a real security review wants to see.

---

## What to take away

If you strip this project down to its lessons, here's what's worth carrying into your own work:

1. **Separate modules, a composition layer, and thin environments.** Consistency across environments should come from *shared code with different inputs*, not copy-paste.
2. **Split infrastructure delivery from application delivery.** They change at different rates and carry different risk. Coupling them is a tax you pay forever.
3. **OIDC over static keys, every time.** A short-lived token that a specific repo mints for a specific run is categorically safer than a secret sitting in a settings page.
4. **SSM over SSH.** No bastion, no key rotation, no open port 22 — and every session is authenticated and logged.
5. **Make production a deliberate act.** Auto-deploy to dev for speed; require a human dispatch and an approval for prod. Gates belong where the blast radius is largest.
6. **Immutable + self-deploying instances** give you both consistency (no drift) and speed (new instances converge to the current image on their own).

The full source, architecture diagrams, operations runbook, and security notes are in the repo under [`docs/`](docs/). Fork it, run `infra-deploy` into your own dev account, and go move some (integer-cent) money around.

*Happy shipping — from Git, and only from Git.*
