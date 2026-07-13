# Banking Platform API

The application tier of the platform: a FastAPI service exposing accounts,
transactions, and transfers, backed by PostgreSQL (RDS). It runs as a container
on the app-tier EC2 instances, behind nginx (which proxies `:8080` → `:8081`),
behind the ALB.

## Architecture

```
ALB ──► nginx (:8080) ──► banking-api container (:8081) ──► RDS PostgreSQL
```

- **Money is integer cents** — never floats.
- **Ledger integrity** — balances never go negative; withdrawals/transfers past
  the balance are rejected (422).
- **Atomic transfers** — debit + credit commit in a single DB transaction.
- **Idempotency** — mutations accept an `idempotency_key`; retries are safe.
- Credentials come from **Secrets Manager** (`DB_SECRET_ARN`) in AWS, or
  `DATABASE_URL` locally/in tests.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness (ALB health check) |
| GET | `/health/ready` | Readiness (checks the DB) |
| POST | `/api/v1/accounts` | Open an account |
| GET | `/api/v1/accounts` | List accounts |
| GET | `/api/v1/accounts/{id}` | Get an account |
| POST | `/api/v1/accounts/{id}/deposit` | Deposit |
| POST | `/api/v1/accounts/{id}/withdraw` | Withdraw (overdraft-protected) |
| GET | `/api/v1/accounts/{id}/transactions` | Transaction history |
| POST | `/api/v1/transfers` | Transfer between accounts |
| GET | `/docs` | OpenAPI / Swagger UI |

## Develop & test

```bash
cd app
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
ruff check src tests
pytest                      # uses in-memory SQLite, no AWS/Postgres needed
uvicorn banking.main:app --port 8081 --reload
```

## Container

```bash
docker build -t banking-platform-api .
docker run -p 8081:8081 -e DATABASE_URL=sqlite+pysqlite:///:memory: banking-platform-api
curl localhost:8081/health
```

In AWS the image is built, tested, scanned, pushed to ECR, and deployed to the
instances by the **`app-deploy`** workflow (see the repo root README for how the
app and infra pipelines differ).
