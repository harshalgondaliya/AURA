# AURA — Distributed Fashion Recommendation Platform

> **Software Development Assignment:** Docker, microservices, API gateway, PostgreSQL, Redis, asynchronous workers, resilience, and ML-powered recommendations.

AURA is a containerised fashion-recommendation platform built to demonstrate the required Software Development modules through a realistic machine-learning application:

1. Architecture, Docker Compose, API gateway, rate limiting, and health checks.
2. PostgreSQL persistence, Redis caching, and asynchronous worker processing.
3. Fault tolerance, live-gateway load testing, structured logs, metrics, and a final demonstration.

The machine-learning recommendation experience provides the real application workload. It combines visual, text, popularity, preference, and outfit-compatibility signals, while the primary evaluation focus remains the distributed-system implementation.

> Start with the [SD requirement matrix](SD_REQUIREMENT_COMPLIANCE_MATRIX.md), [SD test verification report](SD_TEST_VERIFICATION_REPORT.md), and [live-gateway load-test report](SD_LOAD_TEST_REPORT.md). They record the dated evidence, results, and limitations. Historical reports are retained for provenance and should not be presented as current benchmark proof.

## Assignment Requirements and Evidence

| Assignment module | What AURA demonstrates | Main evidence |
| --- | --- | --- |
| **1. Architecture, Docker, and gateway** | Eight-service Compose deployment, a FastAPI reverse proxy, Redis Lua token bucket, HTTP 429 responses, and aggregated health | [`docker-compose.yml`](docker-compose.yml), [`backend/gateway/main.py`](backend/gateway/main.py), [architecture diagrams](infrastructure/diagrams/) |
| **2. Persistence, cache, and worker** | PostgreSQL entities and migrations, Redis-backed cache keys, Redis-list jobs, and a separate worker that persists terminal job status | [`database/`](database/), [`backend/common/redis_cache.py`](backend/common/redis_cache.py), [`backend/workers/`](backend/workers/) |
| **3. Resilience, load, and observability** | Circuit breakers, bounded traffic-spike verification through the real gateway, correlation IDs, JSON access logs, metrics, and activity audit trail | [`backend/common/circuit_breaker.py`](backend/common/circuit_breaker.py), [`load_tests/live_gateway_scenarios.py`](load_tests/live_gateway_scenarios.py), [`SD_LOAD_TEST_REPORT.md`](SD_LOAD_TEST_REPORT.md) |

## System Architecture

```mermaid
flowchart LR
    Browser[React frontend\nNginx :3000] --> Gateway[FastAPI gateway\n:8000]

    subgraph Gateway controls
        RateLimit[Redis Lua token bucket\n429 on excess traffic]
        Breaker[Circuit breakers\nDownstream fast-fail]
        Telemetry[X-Request-ID, JSON logs\nhealth and metrics]
    end

    Gateway --> RateLimit
    Gateway --> Breaker
    Gateway --> Telemetry
    Gateway --> Product[Product service]
    Gateway --> Recs[Recommendation service]
    Gateway --> Users[User service]
    Gateway --> Queue[Redis job queue]

    Product --> Postgres[(PostgreSQL 15)]
    Recs --> Postgres
    Users --> Postgres
    Product --> Redis[(Redis 7)]
    Recs --> Redis
    Queue --> Redis
    Worker[Separate worker] -->|BLPOP task| Redis
    Worker --> Postgres
```

Detailed topology, request, cache/database, asynchronous-worker, and circuit-breaker views are in [infrastructure/diagrams](infrastructure/diagrams/).

## Services and Ports

| Service | Container | Host access | Responsibility |
| --- | --- | --- | --- |
| Frontend | `fashion_frontend` | [localhost:3000](http://localhost:3000) | React single-page application served by Nginx |
| API gateway | `fashion_api_gateway` | [localhost:8000](http://localhost:8000) | Routing, rate limiting, circuit breaking, health, metrics, tracing |
| Product service | `fashion_product_service` | Internal | Catalog search, filters, category and size data |
| Recommendation service | `fashion_rec_service` | Internal | Similar-item, outfit, and personalized recommendations |
| User service | `fashion_user_service` | Internal | Interactions, favorites, saved outfits, audit records |
| Worker | `fashion_worker_service` | Internal | Consumes asynchronous recommendation jobs |
| PostgreSQL 15 | `fashion_postgres` | `localhost:5433` | Persistent application data |
| Redis 7 | `fashion_redis` | `localhost:6380` by default | Cache, atomic limiter state, and task queue |

Only the frontend, gateway, PostgreSQL, and Redis are exposed on the host. Product, recommendation, and user services remain on the Compose network, so application traffic reaches them through the gateway.

## Quick Start

### Prerequisites

- Docker Desktop with Compose v2
- Node.js 20+ and npm (required because the frontend Docker image copies the built `frontend/dist` directory)

### Start the stack

```powershell
# From the repository root
npm --prefix frontend ci
npm --prefix frontend run build
docker compose up -d --build
docker compose ps
```

On a fresh PostgreSQL volume, `database/schema/schema.sql` creates the application schema. Use the versioned migrations when upgrading an existing database; see [Database and migrations](#database-and-migrations).

### Open the application

| Resource | URL |
| --- | --- |
| Shopping application | [http://localhost:3000](http://localhost:3000) |
| System architecture, metrics, and activity logs | [http://localhost:3000/architecture](http://localhost:3000/architecture) |
| Gateway OpenAPI / Swagger | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Aggregated health | [http://localhost:8000/api/health](http://localhost:8000/api/health) |
| Gateway metrics | [http://localhost:8000/api/metrics](http://localhost:8000/api/metrics) |
| Recent user activity audit | [http://localhost:8000/api/audit/interactions](http://localhost:8000/api/audit/interactions) |

If an older frontend remains open after a rebuild, use `Ctrl+F5` to refresh it.

### Stop the stack

```powershell
docker compose down
```

This preserves the named PostgreSQL and Redis volumes. Do not add `--volumes` unless the data is intentionally disposable.

## Assignment Implementation

### Module 1 — Architecture, Docker Setup, and API Gateway

#### Compose and Routing

[`docker-compose.yml`](docker-compose.yml) defines the shared environment: frontend, gateway, three domain services, worker, PostgreSQL, and Redis. The gateway in [`backend/gateway/main.py`](backend/gateway/main.py) receives public API traffic and forwards it to the appropriate internal service.

Primary gateway routes include:

| Route | Purpose |
| --- | --- |
| `GET /api/products`, `/api/products/{id}`, `/api/categories`, `/api/sizes` | Product catalogue |
| `GET` / `POST /api/recommendations/...` | Similar, personalised, and outfit recommendations |
| `GET` / `POST` / `DELETE /api/users/...` | User history, favorites, and saved outfits |
| `POST /api/interactions` | Persist a timestamped user action |
| `POST /api/jobs/recommendations` | Submit a heavy job and receive `202 Accepted` plus a job ID |
| `GET /api/jobs/{job_id}` | Poll persisted asynchronous job state |

#### Rate Limiting

The gateway obtains a client identity and calls the Redis Lua token-bucket implementation in [`backend/common/redis_cache.py`](backend/common/redis_cache.py). The script performs the read, refill, consume, and expiry update atomically in Redis. Requests that cannot obtain a token receive **HTTP 429**, `Retry-After: 2`, and `X-RateLimit-Remaining: 0`.

The Compose defaults are a burst capacity of **120** tokens and a refill rate of **2.0 tokens/second**. Override `RATE_LIMIT_CAPACITY` and `RATE_LIMIT_REFILL_RATE` through the environment to tune a deployment; callers cannot increase their own allowance with a request header.

#### Health Checks

`GET /api/health` reports the gateway, product, recommendation, and user services, plus PostgreSQL, Redis, and circuit-breaker status. It reports `HEALTHY` only when the required dependencies are available; an unavailable dependency produces a degraded response rather than hiding the failure.

### Module 2 — Data Persistence, Caching, and Asynchronous Workers

#### Database and Migrations

PostgreSQL stores users, products, user interactions, saved outfits, outfit items, and recommendation jobs. The schema lives in [`database/schema/schema.sql`](database/schema/schema.sql); versioned changes live in [`database/migrations`](database/migrations/). Docker keeps PostgreSQL data in the `postgres_data` named volume.

For an existing database upgrade, install the Python dependencies and point the migration runner at the desired database explicitly:

```powershell
pip install -r requirements-services.txt
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/fashion_db'
python database/migrations/migrate.py --status
python database/migrations/migrate.py
```

Review the migration status before applying it. The runner records applied files in `schema_migrations`.

#### Redis Cache and Queue

Redis is used for:

- atomic rate-limit counters;
- cache entries for product and recommendation lookups;
- the `queue:recommendation_tasks` Redis list; and
- completed-job cache entries for polling.

The product and recommendation services use cache keys with TTLs to avoid repeat database or model work. Redis must be available to accept distributed asynchronous work; the system does not falsely treat a process-local fallback as a healthy distributed queue.

#### Asynchronous Workflow

1. The client submits `POST /api/jobs/recommendations`.
2. The gateway creates a PostgreSQL job record with status `pending` and pushes its payload to Redis.
3. The worker consumes the queue with `BLPOP`, conditionally claims the pending record, and changes it to `processing`.
4. It persists either `completed` with a result or `failed` with an error message.
5. The client polls `GET /api/jobs/{job_id}`.

This demonstrates a real separate worker process. Its Redis-list delivery is at-least-once/best-effort, not exactly-once transactional delivery; see [Known limits](#known-limits).

### Module 3 — Fault Tolerance, Load Testing, Metrics, and Logs

#### Circuit Breakers

Each downstream service is wrapped by the circuit breaker in [`backend/common/circuit_breaker.py`](backend/common/circuit_breaker.py). After five consecutive failures, it opens and the gateway returns a fast **503** fallback instead of repeatedly waiting for a failing service. After eight seconds it enters `HALF_OPEN` and requires successful probes before closing again.

#### Structured Observability

Every gateway request receives or preserves an `X-Request-ID`. Gateway console entries are structured JSON with timestamp, request ID, client identity, method, path, status, and latency.

#### Health Check, Logs, and Metrics Reference

| Capability | Location | Information available |
| --- | --- | --- |
| Aggregated health check | `GET /api/health` | Overall status plus the gateway, three services, PostgreSQL, Redis, and circuit-breaker state |
| Gateway access logs | `docker compose logs -f api_gateway` | Timestamp, `X-Request-ID`, client identity, HTTP method, path, status, and response latency |
| Worker trace logs | `docker compose logs -f worker_service` | Queue consumption, job ID, correlation ID, processing, completion, or failure lifecycle |
| Runtime metrics | `GET /api/metrics` | Total requests, HTTP 200/429/500 counters, circuit-breaker trips, and p50/p95/p99 latency |
| User activity audit | `GET /api/audit/interactions` | Timestamped user action, user ID, product, context, and session details |

The documented live health check returned **HTTP 200 / HEALTHY**, with all three services, PostgreSQL, and Redis marked `UP` and all circuit breakers `CLOSED`. When a downstream dependency is unavailable, the gateway reports individual nodes as `DOWN` and the aggregate status as `DEGRADED` instead of masking the failure.

The following observability surfaces are available:

| Surface | What it shows |
| --- | --- |
| `GET /api/metrics` | Process-lifetime request counters, 200/429/500 counts, breaker trips, and p50/p95/p99 latency summaries |
| `GET /api/health` | Service, dependency, and circuit-breaker health |
| `GET /api/audit/interactions` | Recent persisted user actions: timestamp, user, action, product, context, and session |
| `/architecture` in the frontend | Metric cards plus the latest audit records in a readable operations dashboard |
| `docker compose logs -f api_gateway user_service worker_service` | Correlated request and worker lifecycle logs |

The activity endpoint is designed for the local evaluator/operations dashboard. A production deployment must protect audit data with appropriate administrator authorization.

#### Run the Bounded Live Gateway Check

```powershell
python load_tests/live_gateway_scenarios.py `
  --base-url http://localhost:8000 `
  --rate-capacity 120
```

This runner sends requests through the running Docker gateway, verifies routing and health, compares cold and repeated cacheable requests, creates tagged success and failure jobs, drives a bounded concurrent rate-limit spike, and prints a JSON report. It is a classroom verification rather than a production-capacity test.

#### Eight-Scenario Benchmark Matrix

The System Architecture dashboard at [`/architecture`](http://localhost:3000/architecture) presents the following matrix for the eight required demonstration scenarios. It provides a compact view of the expected protected-system behaviour across normal traffic, spikes, cache use, failure handling, asynchronous processing, and recovery.

| Test scenario | Requests | Throughput | Average latency | p95 / expected behaviour | Result |
| --- | ---: | --- | --- | --- | --- |
| 1. Normal traffic | 50 | 147.6 RPS | 6.77 ms | 7.76 ms | PASS |
| 2. Traffic spike burst | 150 | 241.6 RPS | 4.14 ms | 7.40 ms | PASS |
| 3. Token bucket limiter | 75 | Rate limited | 429 blocked | `Retry-After: 2s` | PASS |
| 4. Cache cold warm-up | 21 | 150.7 RPS | 6.49 ms | 9.21 ms | PASS |
| 5. Cache miss vs. hit | 45 | 62.7 RPS | 8.53 ms hit | 12.95 ms miss | PASS |
| 6. Circuit-breaker fallback | 25 | 233.6 RPS | 4.28 ms | Immediate 503 fallback | PASS |
| 7. Asynchronous worker queue | 10 | Queue jobs | 100% persisted | Asynchronous database acknowledgement | PASS |
| 8. Recovery after spike | 25 | 124.9 RPS | 8.01 ms | Zero dropouts | PASS |

The dashboard matrix is a scenario-oriented demonstration summary. Use the reproducible live-gateway measurements below and the linked report when presenting measured results.

#### Reproducible Live Gateway Results

The following results are from the reproducible **23 November 2026** live test against `http://localhost:8000`. Traffic passed through the running Docker gateway; these are bounded local observations, not a production-capacity SLA.

| Scenario | Requests | Concurrency | Throughput | 2xx | 429 | 5xx | Average latency | p95 latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline product gateway traffic | 30 | 6 | 91.08 RPS | 30 | 0 | 0 | 64.14 ms | 98.72 ms |
| Concurrent rate-limit traffic spike | 136 | 24 | 60.45 RPS | 123 | 13 | 0 | 376.78 ms | 744.46 ms |

The 13 HTTP 429 responses in the spike were intentional protection by the Redis Lua token bucket. A request using the same client identity was accepted after the one-second refill interval, and no HTTP 5xx responses occurred during the spike.

| Supporting verification | Recorded result |
| --- | --- |
| Cacheable product query, cold | 49.48 ms |
| Mean of 12 repeated cacheable queries | 12.47 ms |
| Observed cold-to-warm improvement | 3.97× |
| Valid asynchronous job submission | HTTP 202 in 78.42 ms, then `completed` with a persisted result |
| Invalid asynchronous job | Persisted as `failed` with the real unknown-anchor validation error |

The full method, raw result interpretation, and limitations are in [SD_LOAD_TEST_REPORT.md](SD_LOAD_TEST_REPORT.md). Do not generalise these local values into a production SLA.

## Machine Learning Features

The ML capability is intentionally documented after the SD platform because it is the consumer of the platform features above.

| Capability | Implementation |
| --- | --- |
| Similar-item recommendation | TF-IDF metadata similarity, optional MobileNetV2 visual embeddings, and hybrid scoring in [`backend/services/recommendation_service/main.py`](backend/services/recommendation_service/main.py) |
| Outfit generation | Slot-aware candidate selection with gender/size filters and colour-harmony rules |
| Personalisation | Recent user interactions and preference signals influence recommendation retrieval |
| Heavy synthesis | A queued worker job can produce a multi-slot outfit without blocking the gateway request |
| Reproducible analysis | Ten notebooks in [`notebooks/`](notebooks/) cover data understanding, preparation, feature engineering, recommenders, hybrid evaluation, outfit compatibility, and final evaluation |

The recommendation service loads processed catalogue data from `data/processed` and model artifacts from `artifacts/` at startup. Dataset preparation, methodology, and evaluation context are documented in [the ML workflow audit](docs/ml/ml_workflow_audit.md) and [the model comparison report](reports/ml_evaluation/model_comparison_report.md).

## Verification

Run these after the Docker stack is healthy:

```powershell
# Backend resilience and outfit/history tests
python -m pytest tests/backend/test_gateway_resilience.py tests/backend/test_outfit_studio_history.py -q

# Frontend state-machine tests
node --test tests/frontend/outfit_history_state_machine.test.js

# Production frontend bundle
npm --prefix frontend run build

# Bounded live gateway verification
python load_tests/live_gateway_scenarios.py --base-url http://localhost:8000 --rate-capacity 120
```

For a faculty-facing walkthrough, use [SD_LIVE_DEMO_GUIDE.md](SD_LIVE_DEMO_GUIDE.md). The detailed verification record is in [SD_TEST_VERIFICATION_REPORT.md](SD_TEST_VERIFICATION_REPORT.md).

## Repository Structure

```text
backend/
  common/                  Shared SQLAlchemy, Redis, schemas, circuit breaker
  gateway/                 Public FastAPI gateway
  services/                Product, recommendation, and user microservices
  workers/                 Redis-queue consumer and job processing
database/
  schema/                  Fresh PostgreSQL schema
  migrations/              Versioned database upgrades
  seed/                    Development seed data
frontend/                  React, Vite, Tailwind, and Nginx SPA
infrastructure/
  diagrams/                Architecture and data-flow Mermaid diagrams
  docker/                  Dockerfiles and Nginx proxy configuration
load_tests/                Bounded live verifier and Locust profile
notebooks/                 ML workflow notebooks
reports/                   ML and historical performance reports
tests/                     Backend and frontend verification tests
```

## Known Limitations

- The Redis list queue is not an exactly-once, transactionally acknowledged queue. A crash after `BLPOP` can require operational recovery.
- The documented load results are bounded local measurements for one gateway instance. They do not prove horizontal scale or production capacity.
- A live Redis-outage exercise and multi-gateway deployment were not part of the recorded evidence.
- Gateway counters are held in process memory and reset when the gateway restarts.
- The audit-log interface displays persisted application interaction data. It is not a substitute for an authenticated production security-audit system.

## Further Documentation

| Document | Use it for |
| --- | --- |
| [SD requirement compliance matrix](SD_REQUIREMENT_COMPLIANCE_MATRIX.md) | Requirement-by-requirement status, evidence, and open gaps |
| [SD test verification report](SD_TEST_VERIFICATION_REPORT.md) | Commands executed, fixes, and actual results |
| [SD load-test report](SD_LOAD_TEST_REPORT.md) | Throughput, latency, rate-limit, cache, worker, and resilience observations |
| [SD live demo guide](SD_LIVE_DEMO_GUIDE.md) | Demonstrating the assignment to an evaluator |
| [ML workflow audit](docs/ml/ml_workflow_audit.md) | Dataset and notebook workflow evidence |
| [System architecture diagram](infrastructure/diagrams/system_architecture.md) | High-level component topology |
