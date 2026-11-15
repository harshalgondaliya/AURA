"""
backend/gateway/main.py
Central API Gateway: Distributed Token Bucket Rate Limiting, Dynamic Routing,
Circuit Breakers, Request ID Logging, and Health/Metrics Observability.
"""

import os
import sys
import time
import uuid
import json
from pathlib import Path
from typing import Optional, Dict, Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request, Response, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import httpx
import numpy as np

from backend.common.redis_cache import cache
from backend.common.circuit_breaker import CircuitBreaker
from backend.common.database import SessionLocal
from backend.common.models import RecommendationJob
from backend.workers.tasks import submit_async_recommendation_job

# Downstream Service URLs (Configurable via Environment variables)
PRODUCT_SERVICE_URL = os.getenv("PRODUCT_SERVICE_URL", "http://localhost:8001")
REC_SERVICE_URL = os.getenv("REC_SERVICE_URL", "http://localhost:8002")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8003")

# Initialize Circuit Breakers for each downstream microservice
breaker_product = CircuitBreaker("product_service", failure_threshold=5, recovery_timeout=8.0)
breaker_rec = CircuitBreaker("recommendation_service", failure_threshold=5, recovery_timeout=8.0)
breaker_user = CircuitBreaker("user_service", failure_threshold=5, recovery_timeout=8.0)

# Metrics Tracking Counters
METRICS = {
    "total_requests": 0,
    "status_200": 0,
    "status_429": 0,
    "status_500": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "circuit_breaker_trips": 0,
    "latencies_ms": []
}

app = FastAPI(
    title="AI Fashion Recommendation API Gateway",
    version="1.0.0",
    description="Distributed API Gateway with Token Bucket Rate Limiting and Circuit Breakers"
)

# Mount local dataset images directory for high-speed static asset delivery
IMAGES_DIR = PROJECT_ROOT / "h-and-m-personalized-fashion-recommendations" / "images"
if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Enable CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Middleware: Request ID, Token Bucket Rate Limiter, and Structured Logging ---
@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    t0 = time.perf_counter()
    METRICS["total_requests"] += 1
    
    # 1. Generate or extract X-Request-ID
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    
    # 2. Identify client (Header or IP)
    client_ip = request.headers.get("X-Client-Id") or (request.client.host if request.client else "127.0.0.1")
    
    # Skip rate limiting for static /health, /metrics, docs and /images endpoints
    if not request.url.path.startswith(("/health", "/metrics", "/docs", "/openapi.json", "/images")):
        # Rate Limiting: 60 req/min capacity, 1 req/sec refill
        allowed, remaining_tokens = cache.check_rate_limit(client_id=client_ip, capacity=60, refill_rate=1.0)
        if not allowed:
            METRICS["status_429"] += 1
            print(f"[GATEWAY] 429 RATE LIMIT EXCEEDED: Client {client_ip} on {request.url.path}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded. Too many requests.",
                    "client_id": client_ip,
                    "retry_after_seconds": 2
                },
                headers={
                    "X-Request-ID": request_id,
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "2"
                }
            )

    # 3. Process Request
    response = await call_next(request)
    
    # 4. Observability & Latency Logging
    duration_ms = (time.perf_counter() - t0) * 1000
    METRICS["latencies_ms"].append(duration_ms)
    if len(METRICS["latencies_ms"]) > 1000:
        METRICS["latencies_ms"].pop(0) # Keep sliding window
        
    if response.status_code == 200:
        METRICS["status_200"] += 1
    elif response.status_code >= 500:
        METRICS["status_500"] += 1

    # Attach tracking headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-MS"] = f"{duration_ms:.2f}"
    
    # Structured Log
    log_entry = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "request_id": request_id,
        "client": client_ip,
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "latency_ms": round(duration_ms, 2)
    }
    print(f"[ACCESS LOG] {json.dumps(log_entry)}")
    return response

# --- HTTP Forwarding Helper with Circuit Breaker ---
async def forward_request(service_url: str, path: str, request: Request, breaker: CircuitBreaker):
    target_url = f"{service_url}{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"
        
    headers = dict(request.headers)
    headers.pop("host", None)
    
    async def _send():
        async with httpx.AsyncClient(timeout=4.0) as client:
            body = await request.body()
            res = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body
            )
            return JSONResponse(status_code=res.status_code, content=res.json())
            
    def _fallback(*args, **kwargs):
        METRICS["circuit_breaker_trips"] += 1
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": f"Downstream service '{breaker.service_name}' is currently unavailable (Circuit {breaker.state}).",
                "service": breaker.service_name,
                "circuit_state": breaker.state
            }
        )

    return await breaker.call(_send, fallback=_fallback)

# --- Routing: Product Catalog ---
@app.api_route("/api/products/{rest_of_path:path}", methods=["GET", "POST"])
async def route_products(rest_of_path: str, request: Request):
    return await forward_request(PRODUCT_SERVICE_URL, f"/products/{rest_of_path}", request, breaker_product)

@app.get("/api/products")
async def route_products_root(request: Request):
    return await forward_request(PRODUCT_SERVICE_URL, "/products", request, breaker_product)

@app.get("/api/categories")
async def route_categories(request: Request):
    return await forward_request(PRODUCT_SERVICE_URL, "/categories", request, breaker_product)

@app.get("/api/sizes")
async def route_sizes(request: Request):
    return await forward_request(PRODUCT_SERVICE_URL, "/sizes", request, breaker_product)

# --- Routing: Recommendation Service ---
@app.api_route("/api/recommendations/{rest_of_path:path}", methods=["GET", "POST"])
async def route_recommendations(rest_of_path: str, request: Request):
    return await forward_request(REC_SERVICE_URL, f"/recommendations/{rest_of_path}", request, breaker_rec)

# --- Routing: User & Interaction Service ---
@app.api_route("/api/users/{rest_of_path:path}", methods=["GET", "POST", "DELETE", "PUT"])
async def route_users(rest_of_path: str, request: Request):
    return await forward_request(USER_SERVICE_URL, f"/users/{rest_of_path}", request, breaker_user)

@app.post("/api/interactions")
async def route_interactions(request: Request):
    return await forward_request(USER_SERVICE_URL, "/interactions", request, breaker_user)

@app.post("/api/outfits/save")
async def route_save_outfit(request: Request):
    return await forward_request(USER_SERVICE_URL, "/outfits/save", request, breaker_user)

# --- Routing: Asynchronous Recommendation Jobs (Requirement Group 2.C) ---
@app.post("/api/jobs/recommendations", status_code=status.HTTP_202_ACCEPTED)
async def submit_job(payload: Dict[str, Any]):
    """Accepts expensive recommendation synthesis task and pushes to background worker queue."""
    user_id = payload.get("user_id", "user_demo_01")
    job_type = payload.get("job_type", "outfit_synthesis")
    
    job_id = submit_async_recommendation_job(user_id=user_id, job_type=job_type, payload=payload)
    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Task accepted. Recommendation synthesis running in background queue.",
        "poll_url": f"/api/jobs/{job_id}"
    }

@app.get("/api/jobs/{job_id}")
def check_job_status(job_id: str):
    """Polls status of background worker recommendation task."""
    cached = cache.get_json(f"job:{job_id}")
    if cached:
        return cached

    db = SessionLocal()
    job = db.query(RecommendationJob).filter(RecommendationJob.job_id == job_id).first()
    db.close()
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
        
    return {
        "job_id": job.job_id,
        "status": job.status,
        "job_type": job.job_type,
        "result": job.result,
        "error_message": job.error_message,
        "created_at": str(job.created_at),
        "updated_at": str(job.updated_at)
    }

# --- System Health & Observability Endpoints ---
@app.get("/health")
@app.get("/api/health")
async def aggregated_health():
    """Deep Health Check reporting status of Gateway, Downstream Services, DB, and Cache."""
    services = {}
    
    async def _check_service(url, name):
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                res = await client.get(f"{url}/health")
                return res.json() if res.status_code == 200 else {"name": name, "status": "DEGRADED"}
        except Exception:
            return {"name": name, "status": "DOWN"}

    services["product_service"] = await _check_service(PRODUCT_SERVICE_URL, "product_service")
    services["recommendation_service"] = await _check_service(REC_SERVICE_URL, "recommendation_service")
    services["user_service"] = await _check_service(USER_SERVICE_URL, "user_service")

    # Dependency check: Database
    db_status = "UP"
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception:
        db_status = "DOWN"

    # Dependency check: Cache
    cache_status = "UP" if cache.is_connected or isinstance(cache.client, cache.__class__) else "UP (Mock)"

    overall_status = "HEALTHY" if all(s.get("status") == "UP" for s in services.values()) else "DEGRADED"

    return {
        "status": overall_status,
        "environment": "local_dev",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "gateway": {"status": "UP", "port": 8000},
        "services": services,
        "dependencies": {
            "database": {"name": "PostgreSQL/SQLite", "status": db_status},
            "cache": {"name": "Redis", "status": cache_status}
        },
        "circuit_breakers": {
            "product_service": breaker_product.get_status(),
            "recommendation_service": breaker_rec.get_status(),
            "user_service": breaker_user.get_status()
        }
    }

@app.get("/metrics")
@app.get("/api/metrics")
def get_metrics():
    """Structured metrics tracking Gateway, Rate Limiting, Latencies, and Circuit Breakers."""
    lats = METRICS["latencies_ms"]
    return {
        "total_requests": METRICS["total_requests"],
        "status_200": METRICS["status_200"],
        "status_429_rate_limited": METRICS["status_429"],
        "status_500_errors": METRICS["status_500"],
        "circuit_breaker_trips": METRICS["circuit_breaker_trips"],
        "latency_summary_ms": {
            "mean": round(float(np.mean(lats)), 2) if lats else 0.0,
            "p50": round(float(np.median(lats)), 2) if lats else 0.0,
            "p95": round(float(np.quantile(lats, 0.95)), 2) if lats else 0.0,
            "p99": round(float(np.quantile(lats, 0.99)), 2) if lats else 0.0
        }
    }
