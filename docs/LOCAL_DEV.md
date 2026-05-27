# SecureBase — Local Development Guide

> One-command local stack for Phase 6.2 development.

## Prerequisites

- Docker Desktop ≥ 4.x (or Docker Engine + Compose plugin)
- Node.js LTS v20.x
- Python 3.11
- AWS SAM CLI (for Lambda invocations outside Docker)
- `awslocal` CLI: `pip install awscli-local`

## Quick Start

```bash
# 1. Copy env template
cp .env.local.example .env.local

# 2. Start all services
docker compose up -d

# 3. Wait for LocalStack to be healthy (10–30 sec), then bootstrap resources
./scripts/localstack-init.sh

# 4. Portal is live at http://localhost:5173
# 5. LocalStack endpoint: http://localhost:4566
# 6. Postgres: localhost:5432 (user: securebase, pass: localdev, db: securebase)
```

## Developing Lambda Functions (Phase 6.2)

```bash
# Invoke compliance_score_recalculator locally
cd phase6-backend
python -m pytest tests/phase6/test_compliance_score_recalculator.py -v

# Or invoke via SAM local (inside docker compose sam-local container)
docker compose exec sam-local python -c "
import json, sys
sys.path.insert(0, '/var/task/functions')
from compliance_score_recalculator import lambda_handler
print(json.dumps(lambda_handler({'dry_run': True}, type('ctx', (), {'aws_request_id': 'local-test'})() ), indent=2))
"
```

## Running Portal Tests

```bash
cd phase3a-portal
npm run test                         # Vitest unit tests
npx playwright test tests/e2e/       # Playwright E2E (requires portal running)
```

## Service Ports

| Service | Port | URL |
|---|---|---|
| LocalStack | 4566 | http://localhost:4566 |
| DynamoDB Local | 8000 | http://localhost:8000 |
| Postgres | 5432 | ******localhost:5432/securebase |
| Portal (Vite) | 5173 | http://localhost:5173 |
| SAM Local | 3001 | http://localhost:3001 |

## AWS Config Note

LocalStack free tier does **not** include the AWS Config service. To develop `control_test_runner.py` or `soc2_compliance_collector.py` locally with Config rules:
- Use a **LocalStack Pro** token (`LOCALSTACK_AUTH_TOKEN` in `.env.local`)
- Or mock the `boto3` Config client in unit tests (see `tests/phase6/` for `moto` examples)

## Stopping

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop and delete all volumes (clean slate)
```