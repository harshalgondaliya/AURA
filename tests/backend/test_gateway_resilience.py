"""Focused tests for the production gateway's controlled failure behaviour."""

import asyncio
import time

from fastapi.testclient import TestClient

from backend.common.circuit_breaker import CircuitBreaker, CircuitState
from backend.gateway import main as gateway


def test_circuit_breaker_recovers_through_half_open():
    breaker = CircuitBreaker("unit_service", failure_threshold=2, recovery_timeout=0.01)

    async def fail():
        raise OSError("controlled downstream failure")

    async def succeed():
        return "available"

    assert asyncio.run(breaker.call(fail, fallback=lambda: "fallback")) == "fallback"
    assert asyncio.run(breaker.call(fail, fallback=lambda: "fallback")) == "fallback"
    assert breaker.state == CircuitState.OPEN
    assert asyncio.run(breaker.call(succeed, fallback=lambda: "fallback")) == "fallback"

    time.sleep(0.02)
    assert asyncio.run(breaker.call(succeed, fallback=lambda: "fallback")) == "available"
    assert breaker.state == CircuitState.HALF_OPEN
    assert asyncio.run(breaker.call(succeed, fallback=lambda: "fallback")) == "available"
    assert breaker.state == CircuitState.CLOSED


def test_gateway_returns_503_and_opens_breaker_for_unreachable_downstream():
    original_url = gateway.PRODUCT_SERVICE_URL
    original_threshold = gateway.breaker_product.failure_threshold
    original_timeout = gateway.breaker_product.recovery_timeout
    try:
        gateway.PRODUCT_SERVICE_URL = "http://127.0.0.1:9"
        gateway.breaker_product.state = CircuitState.CLOSED
        gateway.breaker_product.failure_count = 0
        gateway.breaker_product.last_failure_time = 0.0
        gateway.breaker_product.failure_threshold = 2
        gateway.breaker_product.recovery_timeout = 60.0

        client = TestClient(gateway.app)
        headers = {"X-Client-ID": f"resilience-test-{time.time_ns()}"}
        first = client.get("/api/products", headers=headers)
        second = client.get("/api/products", headers=headers)
        third = client.get("/api/products", headers=headers)

        assert first.status_code == 503
        assert second.status_code == 503
        assert third.status_code == 503
        assert gateway.breaker_product.state == CircuitState.OPEN
        assert third.json()["circuit_state"] == CircuitState.OPEN
    finally:
        gateway.PRODUCT_SERVICE_URL = original_url
        gateway.breaker_product.failure_threshold = original_threshold
        gateway.breaker_product.recovery_timeout = original_timeout
        gateway.breaker_product.state = CircuitState.CLOSED
        gateway.breaker_product.failure_count = 0
        gateway.breaker_product.last_failure_time = 0.0


def test_health_reports_individual_down_nodes_without_crashing():
    original_urls = (
        gateway.PRODUCT_SERVICE_URL,
        gateway.REC_SERVICE_URL,
        gateway.USER_SERVICE_URL,
    )
    try:
        gateway.PRODUCT_SERVICE_URL = "http://127.0.0.1:9"
        gateway.REC_SERVICE_URL = "http://127.0.0.1:9"
        gateway.USER_SERVICE_URL = "http://127.0.0.1:9"

        response = TestClient(gateway.app).get("/api/health")

        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "DEGRADED"
        assert payload["services"]["product_service"]["status"] == "DOWN"
        assert payload["services"]["recommendation_service"]["status"] == "DOWN"
        assert payload["services"]["user_service"]["status"] == "DOWN"
    finally:
        (
            gateway.PRODUCT_SERVICE_URL,
            gateway.REC_SERVICE_URL,
            gateway.USER_SERVICE_URL,
        ) = original_urls
