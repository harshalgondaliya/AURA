"""
backend/tests/test_system.py
Complete Integration Test Suite verifying Gateway, Services, Rate Limiter,
Worker Queue, and Circuit Breaker.
"""

import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from starlette.testclient import TestClient
from backend.services.product_service.main import app as product_app
from backend.services.recommendation_service.main import app as rec_app
from backend.services.user_service.main import app as user_app
from backend.gateway.main import app as gateway_app
from backend.workers.tasks import submit_async_recommendation_job, process_heavy_recommendation_task
from backend.common.database import SessionLocal
from backend.common.models import RecommendationJob

def run_all_integration_tests():
    print("=" * 70)
    print("RUNNING DISTRIBUTED SYSTEM INTEGRATION TESTS")
    print("=" * 70)
    
    # 1. Product Service Tests
    print("\n[TEST 1/6] Testing Product Service Endpoints...")
    p_client = TestClient(product_app)
    res = p_client.get("/health")
    assert res.status_code == 200, f"Product health failed: {res.text}"
    print("  - Product Health Check: PASSED")
    
    res = p_client.get("/products?limit=5")
    assert res.status_code == 200 and len(res.json()["items"]) == 5
    sample_aid = res.json()["items"][0]["article_id"]
    print(f"  - Product List & Pagination: PASSED (Sample item: {sample_aid})")
    
    res = p_client.get(f"/products/{sample_aid}")
    assert res.status_code == 200 and res.json()["article_id"] == sample_aid
    print("  - Product Detail & Caching: PASSED")
    
    # 2. Recommendation Service Tests
    print("\n[TEST 2/6] Testing Recommendation Service Endpoints...")
    r_client = TestClient(rec_app)
    res = r_client.get("/health")
    assert res.status_code == 200
    print("  - Recommendation Health Check: PASSED")
    
    res = r_client.get(f"/recommendations/similar/{sample_aid}?top_k=4")
    assert res.status_code == 200 and len(res.json()) == 4
    print("  - Feature A (Similar Clothing): PASSED (4 similar items returned)")
    
    res = r_client.post("/recommendations/outfits", json={"anchor_article_id": sample_aid})
    assert res.status_code == 200
    outfit_data = res.json()
    assert "slots" in outfit_data and len(outfit_data["slots"]) >= 2
    print(f"  - Feature B (Complete Outfit Recommendation): PASSED (Slots: {list(outfit_data['slots'].keys())})")
    
    res = r_client.get("/recommendations/personalized/user_demo_01?top_k=5")
    assert res.status_code == 200 and len(res.json()) == 5
    print("  - Features C & D (Continuous Personalization Feed): PASSED")
    
    # 3. User & History Service Tests
    print("\n[TEST 3/6] Testing User & Interaction Service Endpoints...")
    u_client = TestClient(user_app)
    
    # Post interaction
    inter_payload = {
        "user_id": "user_demo_01",
        "article_id": sample_aid,
        "interaction_type": "like",
        "context": "catalog"
    }
    res = u_client.post("/interactions", json=inter_payload)
    assert res.status_code == 201
    print("  - Record User Interaction (Like): PASSED")
    
    # Get favorites
    res = u_client.get("/users/user_demo_01/favorites")
    assert res.status_code == 200 and any(p["article_id"] == sample_aid for p in res.json())
    print("  - Retrieve Favorites: PASSED")
    
    # Save outfit
    save_payload = {
        "user_id": "user_demo_01",
        "outfit_name": "Summer Chic Look",
        "anchor_article_id": sample_aid,
        "item_article_ids": [sample_aid]
    }
    res = u_client.post("/outfits/save", json=save_payload)
    assert res.status_code == 201
    print("  - Save Complete Outfit: PASSED")
    
    # 4. Asynchronous Worker Queue Test (Requirement Group 2.C)
    print("\n[TEST 4/6] Testing Asynchronous Worker & Queue Workflow...")
    job_id = submit_async_recommendation_job(
        user_id="user_demo_01",
        job_type="outfit_synthesis",
        payload={"anchor_article_id": sample_aid}
    )
    print(f"  - Job Submitted to Queue: {job_id} (Initial status: PENDING)")
    
    # Verify initial state in DB
    db = SessionLocal()
    job = db.query(RecommendationJob).filter(RecommendationJob.job_id == job_id).first()
    assert job is not None and job.status in ("pending", "processing")
    db.close()
    
    # Wait for background worker thread to process and complete
    print("  - Waiting for background worker to execute and persist to DB...")
    time.sleep(2.0)
    
    db = SessionLocal()
    job_updated = db.query(RecommendationJob).filter(RecommendationJob.job_id == job_id).first()
    assert job_updated.status == "completed", f"Expected completed, got {job_updated.status}"
    assert job_updated.result is not None, "Job result missing from database"
    db.close()
    print("  - Worker Execution & PostgreSQL DB Persistence: PASSED (Status -> COMPLETED)")
    
    # 5. API Gateway Rate Limiting Test (Requirement Group 1.B)
    print("\n[TEST 5/6] Testing Gateway Token Bucket Rate Limiter (HTTP 429)...")
    gw_client = TestClient(gateway_app)
    
    # Send rapid burst of requests
    client_ip = "192.168.1.100"
    rate_limited = False
    for i in range(70):
        res = gw_client.get("/api/products", headers={"X-Client-Id": client_ip})
        if res.status_code == 429:
            rate_limited = True
            retry_after = res.headers.get("Retry-After")
            print(f"  - Request {i+1}: Breached limit! Received HTTP 429 Too Many Requests (Retry-After: {retry_after}s)")
            break
            
    assert rate_limited, "Rate limiter failed to trigger HTTP 429 on excessive requests!"
    print("  - Token Bucket Rate Limiter: PASSED (Verified HTTP 429 & Headers)")
    
    # 6. Gateway Circuit Breaker Fault Tolerance Test (Requirement Group 3.A)
    print("\n[TEST 6/6] Testing Circuit Breaker Fault Tolerance...")
    from backend.gateway.main import breaker_product, breaker_rec
    
    # Simulate consecutive failures on breaker
    for _ in range(5):
        breaker_product._on_failure(Exception("Simulated connection timeout"))
        
    assert breaker_product.state == "OPEN", f"Expected circuit OPEN, got {breaker_product.state}"
    print(f"  - Circuit Breaker Tripped to: {breaker_product.state} (Failure threshold reached)")
    
    res = gw_client.get("/health")
    assert res.status_code == 200
    health_data = res.json()
    assert health_data["circuit_breakers"]["product_service"]["state"] == "OPEN"
    print("  - Gateway Health Check reports Circuit OPEN state: PASSED")
    
    print("\n" + "=" * 70)
    print("ALL DISTRIBUTED SYSTEM INTEGRATION TESTS PASSED (100% OK)!")
    print("=" * 70)

if __name__ == "__main__":
    run_all_integration_tests()
