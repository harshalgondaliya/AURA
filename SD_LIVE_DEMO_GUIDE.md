# AURA Faculty Live Demonstration Guide

Use a PowerShell terminal in `H:\AURA ML-SD`. Every Docker command below names project `aura`, so it does not operate on other local Docker projects.

## Start and confirm the stack

```powershell
docker compose -p aura up -d --build
docker compose -p aura ps
```

Show that all eight services are present. Only the frontend (`3000`), gateway (`8000`), PostgreSQL (`5433`), and Redis (`6380`) are published to the host. Product, recommendation, and user services are internal, which prevents bypassing the gateway.

Open `http://localhost:3000` in a browser. Then run:

```powershell
Invoke-RestMethod http://localhost:8000/api/health | ConvertTo-Json -Depth 8
```

Expected: `HEALTHY`, individual product/recommendation/user states, PostgreSQL/Redis states, and circuit-breaker states.

## Module 1 — Architecture, routing, rate limit, health

| What to show | Command / file | What to say |
|---|---|---|
| Architecture | `infrastructure/diagrams/system_architecture.md` | Browser traffic reaches the API gateway; product, recommendation, and user services are separate; PostgreSQL is durable state; Redis is cache, limiter, and queue. |
| Valid route | `Invoke-WebRequest -UseBasicParsing 'http://localhost:8000/api/products?limit=2'` | The gateway forwards the public product API to the internal product service. |
| Invalid route | `Invoke-WebRequest -UseBasicParsing 'http://localhost:8000/api/not-a-route'` | This returns 404, proving route handling is explicit. |
| Rate-limit protection | `python load_tests/live_gateway_scenarios.py --rate-capacity 120` | One client sends a bounded concurrent spike. It receives 429 responses, then recovers after refill. |
| Individual health under failure | `python -m pytest tests/backend/test_gateway_resilience.py -q` | Tests use an unused localhost upstream, not a stopped AURA service. Health returns `DEGRADED` and identifies affected nodes. |

Natural explanation: “The limiter is an atomic Redis Lua token bucket. The configured burst is 120 tokens and it refills at two per second. The API, not the client, owns that configuration, so a client cannot raise its own quota using a header.”

Likely question: *Why Redis Lua rather than a Python counter?*  
Answer: “A Lua script executes at Redis as one atomic operation, avoiding concurrent read–modify–write races.”

## Module 2 — Database, cache, queue, worker

### Schema and migrations

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://postgres:postgres@localhost:5433/fashion_db'
python database/migrations/migrate.py --status
Remove-Item Env:DATABASE_URL
```

Show `database/schema/schema.sql`, `database/migrations/001_initial_schema.sql`, `002_add_sizing_and_indexes.sql`, and `003_reconcile_job_and_outfit_schema.sql`.

### Redis/cache

```powershell
docker exec fashion_redis redis-cli ping
python load_tests/live_gateway_scenarios.py --rate-capacity 120
```

Explain that products/lists are cached with TTLs in the product service; Redis is also the shared rate-limit and queue store. Refer to the current measured cold/warm comparison in [SD_LOAD_TEST_REPORT.md](SD_LOAD_TEST_REPORT.md), not historical benchmark documents.

### Submit and follow an asynchronous job

```powershell
$headers = @{ 'X-Request-ID' = 'faculty-demo-001'; 'X-Client-ID' = 'faculty-demo-001' }
$body = @{ user_id = 'faculty_demo'; job_type = 'outfit_synthesis'; anchor_article_id = '0559129003' } | ConvertTo-Json
$job = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/jobs/recommendations -Headers $headers -ContentType 'application/json' -Body $body
$job
Invoke-RestMethod "http://localhost:8000/api/jobs/$($job.job_id)" -Headers $headers
docker compose -p aura logs --tail 40 worker_service
```

Expected: immediate HTTP 202 with `job_id`, then `pending`/`processing`/`completed`; worker logs show Redis consumption and database persistence. Poll once or twice more if the result has not yet reached `completed`.

Natural explanation: “The gateway inserts the job record and pushes a small payload into Redis. It does not execute the work. A distinct worker consumes the queue and stores either a result or a failure state in PostgreSQL.”

Likely question: *Is this exactly-once?*  
Answer: “No. It is a lightweight Redis-list worker with best-effort/at-least-once characteristics, not a transactional exactly-once system. We document that limit rather than overclaim.”

## Module 3 — resilience, metrics, and report

```powershell
Invoke-RestMethod http://localhost:8000/api/metrics | ConvertTo-Json -Depth 6
python -m pytest tests/backend/test_gateway_resilience.py -q
python load_tests/live_gateway_scenarios.py --rate-capacity 120
```

Show [SD_LOAD_TEST_REPORT.md](SD_LOAD_TEST_REPORT.md) for actual local measurements. The live runner reports total requests, status classes, RPS, average/p50/p95/p99/max latency, cache comparison, and job outcomes.

For one clear trace, run the async job command above using a unique `X-Request-ID`, then filter both logs:

```powershell
docker compose -p aura logs --tail 100 api_gateway | Select-String 'faculty-demo-001'
docker compose -p aura logs --tail 100 worker_service | Select-String 'faculty-demo-001'
```

Expected: the same ID in the gateway acceptance/poll log and worker processing/completion log.

Likely question: *How does fault tolerance behave?*  
Answer: “The breaker opens after five consecutive downstream failures in the deployed configuration, returns a fast 503 fallback while open, and probes recovery after eight seconds. The test uses a controlled unreachable address so the live services are never stopped.”

## Close safely

To stop AURA only, preserving database and Redis volumes:

```powershell
docker compose -p aura down
```

Do **not** add `-v`, use `docker system prune`, or run broad Docker cleanup commands during the demonstration.
