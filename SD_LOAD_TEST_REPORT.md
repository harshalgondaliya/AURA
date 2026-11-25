# AURA Live Gateway Load-Test Report

**Date:** 23 November 2026 (Asia/Kolkata)  
**Objective:** Measure bounded live behaviour through the AURA API gateway, demonstrate rate-limit protection, observe cache behaviour, and verify asynchronous work without creating product, interaction, or outfit records.

## Environment and method

- Target: `http://localhost:8000` — the running Docker gateway, not an in-process FastAPI import.
- Stack: one gateway, product/recommendation/user services, worker, PostgreSQL 15, Redis 7, and frontend under Compose project `aura`.
- Rate limit under test: Redis Lua token bucket, **capacity 120** and **refill 2.0 tokens/s**, per client identity.
- Runner: `python load_tests/live_gateway_scenarios.py --base-url http://localhost:8000 --rate-capacity 120`.
- Load was deliberately bounded: at most 136 requests / 24 concurrent clients in the spike. This is a classroom verification, not a capacity certification.

## Measured results

| Scenario | Requests | Concurrency | Duration | Throughput | 2xx | 429 | Other 4xx | 5xx | Avg | p50 | p95 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline product gateway traffic | 30 | 6 | 0.329 s | 91.08 RPS | 30 | 0 | 0 | 0 | 64.14 ms | 60.83 ms | 98.72 ms | 107.54 ms | 108.15 ms |
| Concurrent rate-limit spike | 136 | 24 | 2.250 s | 60.45 RPS | 123 | 13 | 0 | 0 | 376.78 ms | 386.88 ms | 744.46 ms | 788.76 ms | 794.92 ms |

Error rate in the spike was **9.56%**, entirely intentional HTTP 429 protection; there were no 5xx responses.

## Rate-limiter observation

The spike used one isolated client identity and deliberately supplied `X-Test-RateLimit-Capacity: 100000`. The gateway ignored that request header because allowance is now server-side configuration only. It still returned **13 HTTP 429** responses. After a one-second wait, a request with that same identity returned HTTP 200, confirming refill/recovery.

This verifies protection for the single Compose gateway instance. It does not claim test coverage for a multi-replica deployment, because one was not configured.

## Cache comparison

| Measurement | Result |
|---|---:|
| Cold cacheable product query | 49.48 ms |
| Mean of 12 repeated queries | 12.47 ms |
| Observed cold/warm ratio | 3.97× |
| Redis global keyspace counter change during controlled follow-up sequence | +20 hits, +2 misses |

The latency comparison is an observation from this local run, not a universal performance promise. Redis `INFO stats` counters are global to the AURA Redis instance, so they establish real key activity but are not treated as an endpoint-exclusive hit ratio.

## Asynchronous workload

| Check | Actual result |
|---|---|
| Submit valid heavy job | HTTP 202 in 78.42 ms |
| Valid task terminal state | `completed` with persisted result |
| Invalid task | Real unknown-anchor validation failure, persisted as `failed` |
| Separate-worker trace | Redis consumption and worker completion were observed in `fashion_worker_service` logs |

The later trace job `job_c2944ac14436` was accepted under request ID `sd-trace-ca678811b5`; the worker logged the same ID while transitioning to processing and completion. Its `completed` state survived a controlled PostgreSQL restart.

## Failure and recovery

`tests/backend/test_gateway_resilience.py` provided the safe failure exercise. An intentionally unreachable localhost downstream produced gateway HTTP 503 responses and opened the product circuit breaker. A separate test verified the breaker transitions `CLOSED → OPEN → HALF_OPEN → CLOSED` after recovery. The health endpoint test reported individual nodes `DOWN` and aggregate `DEGRADED` without crashing.

## Findings and limits

- The live gateway, limiter, cache path, Redis queue, worker, database update, and task polling flow were all exercised.
- The rate limiter protected the downstream product route under bounded concurrent load without a server error.
- Cache reuse was observed in both timing and Redis statistics.
- This run does **not** establish production capacity, horizontal scaling, or exactly-once queue delivery.
- A live Redis outage was not induced; cache/queue fallback is therefore documented as a limitation rather than a verified performance claim.

## Conclusion

For the assignment demonstration, the measured evidence supports the claim that AURA routes through the gateway, returns HTTP 429 under a controlled spike, benefits from cache reuse, and offloads an accepted job to a separate worker. Present the numbers above as a bounded local result from this environment, not as a general benchmark.
