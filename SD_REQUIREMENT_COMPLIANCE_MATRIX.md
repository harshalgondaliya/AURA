# AURA SD Requirement Compliance Matrix

**Audit date:** 23 November 2026 (Asia/Kolkata)  
**Scope:** Software Development modules only. ML artifacts, datasets, and algorithms were not changed.  
**Status key:** PASS = implemented and evidenced; PARTIAL = useful implementation with an evidence or behaviour gap; NOT VERIFIED = not executed; BLOCKED = environmental blocker.

## Evidence register

- `docker compose -p aura config --quiet` validated the Compose file. `config --services` returned exactly `postgres`, `redis`, `product_service`, `recommendation_service`, `user_service`, `worker_service`, `api_gateway`, and `frontend`.
- Live `GET /api/health` returned HTTP 200 / `HEALTHY`, all three service nodes `UP`, PostgreSQL `UP`, and Redis `UP`.
- The reproducible live load run is `python load_tests/live_gateway_scenarios.py --rate-capacity 120`. Its results are recorded in [SD_LOAD_TEST_REPORT.md](SD_LOAD_TEST_REPORT.md).
- Isolated migration test: an empty disposable PostgreSQL 15 container applied migrations `001`, `002`, and `003` successfully. The current AURA PostgreSQL database then registered the same three versions in `schema_migrations`.
- `python -m pytest tests/backend/test_gateway_resilience.py tests/backend/test_outfit_studio_history.py -q` passed **8 tests**. `node --test tests/frontend/outfit_history_state_machine.test.js` passed **11 tests**. `npm --prefix frontend run build` succeeded.

## Module 1 — Architecture, Docker, and Gateway

| ID | Requirement / deliverable | Implementation | Verification | Initial | Final | Result / limitation |
|---|---|---|---|---|---|---|
| 1.1a | Git repository and understandable source structure | `.git`, `.gitignore`, `README.md`, `README_SD.md`, source and infra folders | `git status`, `git log -1`, source inspection | PASS | PASS | Repository exists; ignore rules cover environments, generated files, datasets, node modules, and volumes. Pre-existing uncommitted work was preserved. |
| 1.1b | Shared Git repository status | `origin` is configured | `git remote -v` returned GitHub fetch/push URLs | PARTIAL | PARTIAL | A remote is configured, but this audit did not authenticate or prove collaborator access. No remote change or push was attempted. |
| 1.1c | Valid reproducible Compose deployment | `docker-compose.yml` with `name: aura` | `docker compose -p aura config --quiet`, `ps` | PASS | PASS | Eight AURA services are running. Project name prevents an additional deployment after the folder rename. |
| 1.1d | Safe service isolation | Compose network plus host exposure only for frontend, gateway, PostgreSQL, Redis | Inspect effective Compose and `ps` after rebuild | PARTIAL | PASS | Product, recommendation, and user service host-port mappings were removed. They remain reachable only inside AURA's Compose network, so browser/API traffic cannot bypass gateway enforcement. |
| 1.2a | API gateway routes valid requests | `backend/gateway/main.py` | Live `GET /api/products?limit=1` | PASS | PASS | HTTP 200 through port 8000 reached the product service. |
| 1.2b | Invalid-route behaviour and response forwarding | Gateway route definitions and `forward_request` | Live `GET /api/not-a-route` | PASS | PASS | HTTP 404. Gateway now preserves raw downstream response bodies and safe headers instead of assuming every response is JSON. |
| 1.3a | Token/Leaky bucket limiter | Redis Lua token-bucket in `backend/common/redis_cache.py` | Source review and live concurrent spike | PASS | PASS | Redis Lua performs the token mutation atomically. Server configuration: capacity **120**, refill **2.0 tokens/s**. |
| 1.3b | Excess requests return 429 and recover | Gateway middleware | 136 requests at concurrency 24 with one client identity; 13 HTTP 429; same identity accepted a request after one second | PASS | PASS | A deliberately supplied `X-Test-RateLimit-Capacity: 100000` header did not increase allowance; test still received 429. |
| 1.3c | Concurrency cannot trivially bypass limiter | Redis Lua script | Same 24-client concurrent scenario | PASS | PASS | 123 2xx and 13 429; no 5xx. The test demonstrates atomic shared bucket enforcement for one gateway instance. Multi-gateway replica deployment was not configured, so replica testing is not applicable. |
| 1.4a | Individual-node health endpoint | `GET /api/health`, service health handlers | Live healthy response | PASS | PASS | Gateway lists product, recommendation, user, database, cache, and breaker state. |
| 1.4b | Controlled unavailable-node health behaviour | `tests/backend/test_gateway_resilience.py` | Test forces all downstream URLs to an unused localhost port | NOT VERIFIED | PASS | Endpoint remained HTTP 200, reported `DEGRADED`, and marked each affected node `DOWN`; no production container was stopped. |
| 1.D1 | Architecture diagram | `infrastructure/diagrams/system_architecture.md` | Source/doc inspection against current Compose | PASS | PASS | Diagram matches the eight-service deployment. |
| 1.D2 | Data-flow sketch | `infrastructure/diagrams/request_data_flow.md` and `async_worker_flow.md` | Source/doc inspection plus live trace | PASS | PASS | See the request trace in the test report. |

## Module 2 — Persistence, Cache, and Worker

| ID | Requirement / deliverable | Implementation | Verification | Initial | Final | Result / limitation |
|---|---|---|---|---|---|---|
| 2.1a | Persistent database integration | PostgreSQL 15, SQLAlchemy models, `postgres_data` named volume | Live health and job records | PASS | PASS | Gateway, services, and worker connect to PostgreSQL. |
| 2.1b | Create, retrieve, update relevant record | `RecommendationJob` model and job APIs | HTTP 202 create, polling read, worker `pending → processing → completed/failed` update | PASS | PASS | Valid job `job_99e34ed6e029` completed with a stored result; invalid job `job_0147428335fc` stored a real validation error. |
| 2.1c | Persistence across restart | `postgres_data` | Controlled AURA PostgreSQL restart with tagged job `job_c2944ac14436` | NOT VERIFIED | PASS | Status was `completed` both before and after restart; volume was not removed. |
| 2.1d | Database failure handling | Session and health error paths | Static inspection only | NOT VERIFIED | PARTIAL | Gateway degrades database health on query failure, but this audit did not take the live database down. |
| 2.2a | Current documented schema | `database/schema/schema.sql`, ORM models | Schema inspection and migration test | PASS | PASS | Schema includes users, products, interactions, outfits/items, and recommendation jobs. |
| 2.2b | Versioned migrations / fresh initialization | `database/migrations/001...003`, `migrate.py` | Empty isolated PostgreSQL test; current DB migration status | PARTIAL | PASS | Added `003_reconcile_job_and_outfit_schema.sql` to repair baseline job/outfit drift. All three applied successfully in both contexts. |
| 2.3a | Redis connection, cache keys, TTLs | `backend/common/redis_cache.py`; product and recommendation services | Live health; source inspection | PASS | PASS | Redis is `UP`; product list/detail cache keys have 120/600 second TTLs. |
| 2.3b | Cache hit/miss behaviour | Product-service cache | Cold versus repeated gateway query plus Redis `INFO stats` | PASS | PASS | Cold request: 49.48 ms; 12 warm requests averaged 12.47 ms. During a controlled sequence, Redis global counters increased by 20 hits and 2 misses. |
| 2.3c | Redis failure behaviour | In-memory fallback code | Static inspection | NOT VERIFIED | PARTIAL | The fallback is deliberately reported as `DEGRADED`, not Redis `UP`; an actual live Redis outage was not induced. A process-local fallback cannot operate as a distributed worker queue. |
| 2.4a | Gateway queues heavy work and returns promptly | `POST /api/jobs/recommendations` | Live HTTP 202 response and measured 78.42 ms submission | PARTIAL | PASS | Removed the previous in-gateway worker thread. The gateway now enqueues only to Redis and rejects queue-unavailable jobs with 503. |
| 2.4b | Separate worker consumes queued work | `backend/workers/main.py`, `tasks.py` | Container log trace for `job_c2944ac14436` | PARTIAL | PASS | Worker logged Redis consumption, processing, and persisted completion using the gateway request ID. |
| 2.4c | Completion and failure state persisted | `RecommendationJob` | Valid job completed; unknown `anchor_article_id` job failed | PARTIAL | PASS | Failure is genuine validation in the worker, not a dummy response. |
| 2.4d | Queue delivery semantics documented | Redis list + DB pending scan | Source inspection | PARTIAL | PARTIAL | Delivery is at-least-once/best-effort, not exactly-once: a task removed by `BLPOP` before a process crash is not transactionally acknowledged. Do not claim durable exactly-once processing. |
| 2.D | Updated Compose includes DB, cache, worker | `docker-compose.yml` | Effective service list and live stack | PASS | PASS | All required data/worker services are present. |

## Module 3 — Resilience, Load, Observability, and Documentation

| ID | Requirement / deliverable | Implementation | Verification | Initial | Final | Result / limitation |
|---|---|---|---|---|---|---|
| 3.1a | Circuit-breaker implementation | `backend/common/circuit_breaker.py` | Unit test: CLOSED → OPEN → HALF_OPEN → CLOSED | PASS | PASS | Two-failure controlled test verifies recovery; production setting remains five failures and eight-second recovery. |
| 3.1b | Gateway failure handling | Gateway `forward_request` | Controlled unused upstream port test | PASS | PASS | Gateway returned 503, opened the product breaker, and fast-failed the next request without touching live downstream containers. |
| 3.2 | Bounded live load script | `load_tests/live_gateway_scenarios.py`; compatibility wrapper `run_scenarios.py`; `locustfile.py` | Executed live against `localhost:8000` | PARTIAL | PASS | Replaced the prior in-process runner that bypassed the gateway. |
| 3.3 | Throughput and latency metrics | Live script and `/api/metrics` | Baseline and spike measurements | PASS | PASS | Counts, RPS, average, p50, p95, p99, maximum, 4xx/5xx categories are reported with actual values. |
| 3.4 | Structured logging / task trace | Gateway JSON access log, request IDs, unbuffered worker logs | Live trace `sd-trace-ca678811b5` | PARTIAL | PASS | Gateway HTTP 202 and worker processing/completion share the same request ID. Worker Docker command uses unbuffered output so logs are visible. |
| 3.5 | Source and setup documentation | README files, diagrams, this audit suite | Documentation review | PARTIAL | PASS | Root README now points to current evidence. Historical unverified “all-pass” matrix/reports are explicitly marked historical. |
| 3.6 | Faculty-friendly load report | `SD_LOAD_TEST_REPORT.md` | Based only on executed live run | NOT VERIFIED | PASS | Includes bounded methodology, measured tables, limits, and conclusion. |

## Final acceptance view

| Assignment module | Requirements verified | Passed | Partial | Failed | Not verified | Overall |
|---|---:|---:|---:|---:|---:|---|
| Module 1 | 13 | 12 | 1 | 0 | 0 | PASS with remote-access caveat |
| Module 2 | 14 | 11 | 3 | 0 | 0 | PASS with Redis-outage / queue-semantics caveats |
| Module 3 | 6 | 6 | 0 | 0 | 0 | PASS |

**Final verdict: CONDITIONAL PASS — SOME REQUIREMENTS REMAIN PARTIAL OR UNVERIFIED.** The mandatory live flows are working and demonstrated. The conditional verdict is intentionally conservative because collaborative Git access was not proven, a live Redis-outage exercise was not performed, and Redis-list jobs must not be represented as exactly-once durable delivery.

## Final evaluation

### Executive summary

AURA is now demonstrably ready to show the three SD modules: eight isolated Compose services run under the intended project name; the public gateway routes requests, rate-limits a concurrent burst, reports individual health, and exposes metrics; PostgreSQL/Redis/worker integration has been exercised end-to-end; and the circuit breaker has controlled-failure coverage. The reports use current executions rather than the prior unsupported all-pass narrative.

### Initial findings and corrections

The primary initial defects were migration drift in the queue tables, a user-controllable rate-limit test header, public host mappings that allowed service bypass, an in-gateway worker thread that undermined the separate-worker claim, buffered worker logs, and a load runner that often bypassed the live gateway. The exact corrective files and rationale are in [SD_TEST_VERIFICATION_REPORT.md](SD_TEST_VERIFICATION_REPORT.md).

### Remaining gaps

- Git remote configuration is visible, but sharing permissions were not authenticated or changed.
- Redis outage handling was inspected but not exercised by stopping the live Redis service.
- The queue uses lightweight Redis-list semantics, so exactly-once delivery and crash-safe acknowledgement are out of scope.
- The measurements are local, bounded results; they are not production-capacity results.

### Faculty demonstration readiness

| Module | Readiness | Why |
|---|---|---|
| 1 | High | Live health, valid/invalid routing, 429 spike, service isolation, and controlled degraded-health test are reproducible. |
| 2 | High | Migration chain, cache evidence, HTTP 202 → Redis → separate worker → PostgreSQL completion, failure state, and restart persistence are evidenced. |
| 3 | High with caveats | Live bounded results, log trace, and breaker tests are reproducible. Explain the local-load and best-effort queue limits proactively. |

### Evidence-based quality rating

| Area | Rating / 10 | Basis |
|---|---:|---|
| Requirements compliance | 8.3 | Core mandatory flows pass; conservative deductions for the documented partial items. |
| Architecture | 8.0 | Clear service boundaries and diagrams; single-instance Compose is intentionally limited. |
| Docker integration | 8.5 | Eight healthy services, named persistence, and project isolation; no orchestration/autoscaling. |
| API gateway | 8.7 | Routing, errors, health, metrics, headers, and isolation were live-tested. |
| Rate limiting | 9.0 | Atomic Redis Lua and a real concurrent 429/recovery test; only one replica is configured. |
| Database and caching | 8.3 | Fresh migration chain, persistence restart, and cache observations pass; no live DB/Redis outage test. |
| Async task processing | 8.0 | Separate worker and stored outcomes pass; no exactly-once guarantee. |
| Fault tolerance | 8.0 | Breaker trip and recovery tests pass; no production-container failure was induced. |
| Testing | 8.2 | Unit, frontend, migration, live integration, bounded load, and restart coverage; broader browser E2E is not rerun. |
| Documentation | 8.5 | Current evidence, limitations, and demo commands are explicit. |
| Live demo readiness | 8.7 | Safe, reproducible commands and expected outcomes are prepared. |
