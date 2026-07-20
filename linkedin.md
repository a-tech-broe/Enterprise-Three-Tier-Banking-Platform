🏦 I built a bank on AWS where every environment comes from Git — and not a single click in the console.

Most "deploy to AWS" tutorials stop at one EC2 instance and a `terraform apply` you run from your laptop. Real banks don't work like that. No engineer manually creates a resource. Dev, QA, UAT, and Prod are all reconstructable from a commit. Credentials are short-lived. Production changes are deliberate and gated.

So I wrote up exactly how to build that — a production-grade, three-tier banking platform, end to end 👇

What's inside:

🔹 Terraform for the infrastructure — reusable modules, a composition layer, and thin per-environment roots. Four consistent environments that differ only where they should (single vs. per-AZ NAT, single-AZ vs. Multi-AZ RDS, sizing, log retention).

🔹 Ansible over AWS Session Manager for configuration — no bastion, no key pairs, no inbound SSH. Every session IAM-authenticated and logged.

🔹 GitHub Actions with OIDC — zero long-lived cloud credentials in the repo. Short-lived tokens minted per run.

🔹 DevSecOps baked in — Checkov on the infra, Trivy on the image, `ruff` + `pytest`, and a manual approval gate before anything touches production.

🔹 Immutable, self-deploying instances — new instances pull the current pinned image on boot, so scale-out and instance refresh keep the fleet consistent with no orchestration server.

🔹 Two pipelines that never touch each other — one ships the platform, one ships the app. Auto-deploy to dev for speed; explicit dispatch + human approval for prod.

And it runs a genuinely full-featured FastAPI + React banking app (JWT auth, transfers with ledger integrity, statements, admin back-office, 45 tests) — money stored as integer cents end to end, DB creds from Secrets Manager, nothing secret baked into the image.

The article is a full build-along guide: fork it, run one bootstrap workflow, click "Run workflow," and stand the whole thing up in your own AWS account.

If you're learning Terraform, GitOps, or DevSecOps — or you just want to see what "reproducible from Git" looks like at bank-grade — this one's for you.

📖 Read it here: [link to Medium article]

Would love your feedback — what would you harden next? 👇

#AWS #Terraform #DevOps #DevSecOps #GitOps #InfrastructureAsCode #Ansible #CloudEngineering #GitHubActions #CloudSecurity
