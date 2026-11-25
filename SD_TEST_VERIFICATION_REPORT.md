# AURA SD Test Verification Report

**Execution date:** 23 November 2026 (Asia/Kolkata)  
**Environment:** Windows host, Docker Compose project `aura`, PostgreSQL 15, Redis 7, FastAPI services, React/Nginx frontend.  
**Safety boundary:** Only containers and data in Compose project `aura` were inspected or restarted. No unrelated Docker project, volume, dataset, model, or remote Git repository was changed.

## Corrections applied

| File | Correction | Reason |
|---|---|---|
| `docker-compose.yml` | Removed host mappings for three backend services | Prevents direct host access from bypassing the gateway's rate limit. |
| `backend/gateway/main.py` | Removed client-controlled rate-limit capacity/refill headers; improved proxy response preservation; added queue-unavailable 503; strengthened dependency health aggregation | A caller could otherwise inflate its allowance. Gateway routing/health must handle non-JSON responses and actual dependency state. |
| `backend/common/redis_cache.py` | Added Redis health probe that labels process-local fallback as degraded | A mock cache must not be reported as a healthy distributed Redis dependency. |
| `backend/workers/tasks.py` | Removed in-process worker thread; queue-required job acceptance; conditional pending-job claim; request-ID worker logging; genuine unknown-anchor failure | Makes the separate worker real, avoids a claim race, and provides a controlled failure path. |
| `infrastructure/docker/Dockerfile.worker` | Uses unbuffered Python | Makes worker lifecycle logs visible in Docker. |
| `database/migrations/003_reconcile_job_and_outfit_schema.sql` | Reconciles early job/outfit migration schema with current ORM | Fresh migrations previously lacked required queue fields and had a non-null obsolete anchor field. |
| `load_tests/live_gateway_scenarios.py` and `run_scenarios.py` | Added live HTTP runner; made old filename a compatibility wrapper | The earlier runner imported applications directly and did not reliably test gateway enforcement. |
| `backend/tests/test_system.py` | Made the legacy system-test command invoke the same live HTTP verifier | It previously depended on the removed in-process worker thread and could not prove the Docker workflow. |
| `tests/backend/test_gateway_resilience.py` | Added breaker, gateway failure, and degraded-health tests | Provides repeatable controlled failure evidence without stopping live services. |

## Commands executed and results

| Level | Command / action | Actual result |
|---|---|---|
| Repository | `git status --short`; `git remote -v`; `git log -1 --oneline` | Git repository and `origin` exist. The worktree already contained unrelated user edits; they were not reset. Remote collaboration rights were not tested. |
| Compose validation | `docker compose -p aura config --quiet`; `docker compose -p aura config --services` | Valid Compose; exactly eight required services. |
| Live stack | `docker compose -p aura up -d --build` and project-scoped recreations | AURA services came up under the existing `aura` identity. No volumes were removed. |
| Gateway health/routing | Live `GET /api/health`, `GET /api/products?limit=1`, `GET /api/not-a-route` | HTTP 200 / `HEALTHY`; valid route 200; invalid route 404. Health listed every service, PostgreSQL, Redis, and breaker states. |
| Unit / controlled fault tests | `python -m pytest tests/backend/test_gateway_resilience.py tests/backend/test_outfit_studio_history.py -q` | **8 passed**. Includes breaker OPEN/HALF_OPEN/CLOSED recovery, gateway 503 from a deliberately unreachable localhost upstream, and health `DEGRADED`/individual `DOWN` results. Pytest could not write its cache due existing directory permissions; this did not affect test execution. |
| Frontend state tests | `node --test tests/frontend/outfit_history_state_machine.test.js` | **11 passed**. |
| Frontend build | `npm --prefix frontend run build` | Vite built successfully: 1,594 modules transformed. |
| Migration freshness | Disposable PostgreSQL 15 container; `python database/migrations/migrate.py` | `001`, `002`, and `003` applied successfully to an empty DB. The container had no AURA volume and was removed automatically. |
| Current migration tracking | `DATABASE_URL=... python database/migrations/migrate.py` | The existing AURA database registered all three migrations in `schema_migrations`. |
| Live rate test | `python load_tests/live_gateway_scenarios.py --base-url http://localhost:8000 --rate-capacity 120` | 136 concurrent requests: 123 2xx, 13 HTTP 429, 0 5xx. A request one second later returned 200. |
| Cache test | Cold then 12 repeat cacheable gateway queries; Redis `INFO stats` before/after a controlled sequence | Cold 49.48 ms; warm average 12.47 ms. Redis global keyspace counters increased by 20 hits and 2 misses during the subsequent controlled request sequence. |
| Async success/failure | Same live runner | Valid job `job_99e34ed6e029` was accepted in 78.42 ms with HTTP 202 and completed with a result. Unknown-anchor job `job_0147428335fc` failed with stored error `anchor_article_id 'does-not-exist' does not exist`. |
| Request trace | Live job `job_c2944ac14436`, request ID `sd-trace-ca678811b5` | Gateway logged the HTTP 202; worker logged Redis consumption, `PROCESSING`, and persisted `COMPLETED` with the same request ID. |
| Persistence restart | Controlled `docker compose -p aura restart postgres` | Tagged job status remained `completed` before and after restart; PostgreSQL returned ready. No volume was removed. |
| Regression smoke | Live `GET /api/health` and frontend `GET /` after changes | Gateway remained `HEALTHY`; frontend returned HTTP 200. |

## Important live evidence

The live health response reported all service nodes `UP`, PostgreSQL `UP`, Redis `UP`, and all breakers `CLOSED`.

The worker trace was:

```text
[WORKER DAEMON] Consumed task from Redis queue: job_c2944ac14436
[WORKER] request_id=sd-trace-ca678811b5 job=job_c2944ac14436: status -> PROCESSING
[WORKER] request_id=sd-trace-ca678811b5 job=job_c2944ac14436: status -> COMPLETED (Persisted to DB)
```

The gateway recorded the same request ID on the HTTP 202 submission and later status polls.

## Tests not performed

- No real Redis outage was induced. The fallback code was inspected and is now honestly shown as degraded, but outage behaviour remains a live-test gap.
- No live PostgreSQL outage was induced. Database durability was tested through a safe restart instead.
- No second gateway replica was deployed; therefore, multi-instance rate-limit verification is not applicable to this one-instance Compose stack.
- No remote Git access test, push, or permission change was performed.
- Pre-existing end-to-end scripts that create user interactions/outfits were not rerun, to avoid adding unnecessary user-facing records. The live tests used tagged job records only.

## Regression and remaining issues

The project is demonstrably operational after the corrections. The main technical boundary is queue semantics: a Redis list plus `BLPOP` is not exactly-once processing. The worker's pending-job scan can recover records that remain pending, but a process crash after pop is not transactionally acknowledged. This is acceptable for the assignment demonstration when explained accurately; it is not a basis for a stronger reliability claim.
