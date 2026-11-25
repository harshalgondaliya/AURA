"""Bounded live AURA gateway verification and load scenarios.

Unlike the historical in-process runner, this script sends HTTP requests to the
running gateway.  It never writes product, user, or outfit records; it creates
two tagged RecommendationJob records so the queue and failure paths can be
verified and later cleaned up by their exact IDs.

Usage:
    python load_tests/live_gateway_scenarios.py --base-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import httpx


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower, upper = math.floor(position), math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def summarize(name: str, results: list[tuple[int, float]], duration_s: float, concurrency: int) -> dict[str, Any]:
    statuses = [status for status, _ in results]
    latencies = [latency for _, latency in results]
    return {
        "scenario": name,
        "requests": len(results),
        "concurrency": concurrency,
        "duration_s": round(duration_s, 3),
        "requests_per_second": round(len(results) / duration_s, 2) if duration_s else 0.0,
        "http_2xx": sum(200 <= status < 300 for status in statuses),
        "http_429": statuses.count(429),
        "other_4xx": sum(400 <= status < 500 and status != 429 for status in statuses),
        "http_5xx": sum(status >= 500 for status in statuses),
        "average_latency_ms": round(statistics.mean(latencies), 2) if latencies else 0.0,
        "p50_latency_ms": round(percentile(latencies, 0.50), 2),
        "p95_latency_ms": round(percentile(latencies, 0.95), 2),
        "p99_latency_ms": round(percentile(latencies, 0.99), 2),
        "max_latency_ms": round(max(latencies), 2) if latencies else 0.0,
    }


def run_get_batch(
    client: httpx.Client,
    path: str,
    count: int,
    concurrency: int,
    headers: dict[str, str],
) -> dict[str, Any]:
    def request_one() -> tuple[int, float]:
        started = time.perf_counter()
        try:
            response = client.get(path, headers=headers)
            return response.status_code, (time.perf_counter() - started) * 1000
        except httpx.HTTPError:
            return 599, (time.perf_counter() - started) * 1000

    started = time.perf_counter()
    results: list[tuple[int, float]] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(request_one) for _ in range(count)]
        for future in as_completed(futures):
            results.append(future.result())
    return summarize("", results, time.perf_counter() - started, concurrency)


def wait_for_terminal_job(client: httpx.Client, job_id: str, timeout_s: float = 12.0) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_s
    latest: dict[str, Any] = {}
    while time.monotonic() < deadline:
        response = client.get(f"/api/jobs/{job_id}")
        response.raise_for_status()
        latest = response.json()
        if latest.get("status") in {"completed", "failed"}:
            return latest
        time.sleep(0.25)
    raise TimeoutError(f"Job {job_id} did not reach a terminal state: {latest}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run bounded live AURA gateway verification scenarios")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--rate-capacity", type=int, default=120, help="Server-side configured burst capacity")
    args = parser.parse_args()

    run_id = uuid.uuid4().hex[:10]
    report: dict[str, Any] = {"run_id": run_id, "base_url": args.base_url.rstrip("/"), "scenarios": []}
    with httpx.Client(base_url=report["base_url"], timeout=15.0) as client:
        health = client.get("/api/health")
        product = client.get("/api/products?limit=1", headers={"X-Client-ID": f"sd-route-{run_id}"})
        invalid = client.get("/api/not-a-route", headers={"X-Client-ID": f"sd-invalid-{run_id}"})
        report["routing_and_health"] = {
            "health_status": health.status_code,
            "health": health.json() if health.headers.get("content-type", "").startswith("application/json") else {},
            "valid_route_status": product.status_code,
            "invalid_route_status": invalid.status_code,
        }

        cache_term = f"sd_audit_{run_id}"
        cold_start = time.perf_counter()
        cold = client.get(f"/api/products?limit=5&search={cache_term}", headers={"X-Client-ID": f"sd-cache-{run_id}"})
        cold_ms = (time.perf_counter() - cold_start) * 1000
        warm_latencies = []
        for _ in range(12):
            warm_start = time.perf_counter()
            warm = client.get(f"/api/products?limit=5&search={cache_term}", headers={"X-Client-ID": f"sd-cache-{run_id}"})
            warm_latencies.append((time.perf_counter() - warm_start) * 1000)
        report["cache_comparison"] = {
            "cold_status": cold.status_code,
            "warm_status": warm.status_code,
            "cold_latency_ms": round(cold_ms, 2),
            "warm_average_latency_ms": round(statistics.mean(warm_latencies), 2),
            "warm_request_count": len(warm_latencies),
        }

        baseline = run_get_batch(
            client,
            "/api/products?limit=1",
            count=30,
            concurrency=6,
            headers={"X-Client-ID": f"sd-baseline-{run_id}"},
        )
        baseline["scenario"] = "Baseline gateway traffic"
        report["scenarios"].append(baseline)

        spike = run_get_batch(
            client,
            "/api/products?limit=1",
            count=args.rate_capacity + 16,
            concurrency=24,
            headers={
                "X-Client-ID": f"sd-spike-{run_id}",
                # Deliberately ignored by the gateway.  This validates that a
                # caller cannot increase its own server-side allowance.
                "X-Test-RateLimit-Capacity": "100000",
            },
        )
        spike["scenario"] = "Concurrent rate-limit traffic spike"
        report["scenarios"].append(spike)
        time.sleep(1.0)
        recovery = client.get("/api/products?limit=1", headers={"X-Client-ID": f"sd-spike-{run_id}"})
        report["rate_limit_recovery_status"] = recovery.status_code

        request_id = f"sd-async-{run_id}"
        valid_started = time.perf_counter()
        valid = client.post(
            "/api/jobs/recommendations",
            headers={"X-Request-ID": request_id, "X-Client-ID": f"sd-job-{run_id}"},
            json={"user_id": f"sd_audit_{run_id}", "job_type": "outfit_synthesis", "anchor_article_id": "0559129003"},
        )
        valid_submit_ms = (time.perf_counter() - valid_started) * 1000
        valid.raise_for_status()
        valid_job = wait_for_terminal_job(client, valid.json()["job_id"])

        invalid = client.post(
            "/api/jobs/recommendations",
            headers={"X-Request-ID": f"{request_id}-failure", "X-Client-ID": f"sd-job-failure-{run_id}"},
            json={"user_id": f"sd_audit_{run_id}", "job_type": "outfit_synthesis", "anchor_article_id": "does-not-exist"},
        )
        invalid.raise_for_status()
        invalid_job = wait_for_terminal_job(client, invalid.json()["job_id"])
        report["async_jobs"] = {
            "valid_submit_status": valid.status_code,
            "valid_submit_latency_ms": round(valid_submit_ms, 2),
            "valid_job_id": valid.json()["job_id"],
            "valid_terminal_status": valid_job.get("status"),
            "valid_result_persisted": bool(valid_job.get("result")),
            "invalid_job_id": invalid.json()["job_id"],
            "invalid_terminal_status": invalid_job.get("status"),
            "invalid_error": invalid_job.get("error_message"),
            "request_id": request_id,
        }

        metrics = client.get("/api/metrics")
        report["gateway_metrics_after_run"] = metrics.json() if metrics.status_code == 200 else {"status": metrics.status_code}

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
