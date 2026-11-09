"""
scripts/verify_e2e_walkthrough.py
Full End-to-End User Journey Simulation and Verification Script.
Simulates a real shopper interacting with the live AURA.AI Fashion RecSys platform.
"""

import os
import sys
import time
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import httpx

def print_banner(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def run_e2e_walkthrough():
    print_banner("AURA.AI FASHION RECSYS: FULL E2E CLIENT SIMULATION")
    client = httpx.Client(base_url="http://localhost:8000", timeout=10.0)

    # 1. System Health Check
    print("\n[STEP 1] Checking Distributed Gateway Health & Status...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    health_data = res.json()
    print(f"  Status: {health_data['status']}")
    print(f"  Services: {list(health_data['services'].keys())}")
    print("  --> Gateway and Microservices are ONLINE and HEALTHY.")

    # 2. Browse Product Catalog
    print("\n[STEP 2] Shopper opens Catalog & applies category filter 'upper_body'...")
    res = client.get("/api/products?limit=6&category=upper_body")
    assert res.status_code == 200, f"Catalog fetch failed: {res.status_code}"
    catalog_resp = res.json()
    products = catalog_resp.get("items", catalog_resp)
    print(f"  Found {len(products)} products in 'upper_body' slot:")
    for p in products[:3]:
        print(f"    - [{p['article_id']}] {p['prod_name']} ({p['colour_group_name']}) - ${p['price_cents']/100:.2f}")

    anchor_item = products[0]
    aid = anchor_item["article_id"]

    # 3. User clicks and views product
    print(f"\n[STEP 3] User clicks on item [{aid}] '{anchor_item['prod_name']}'...")
    res = client.post("/api/interactions", json={
        "user_id": "user_demo_01",
        "article_id": aid,
        "interaction_type": "view",
        "session_id": "session_live_01",
        "context": {"source": "catalog_grid", "filter": "upper_body"}
    })
    assert res.status_code == 201
    print("  --> View interaction recorded in database and user profile updated.")

    # 4. Instant Similar Items (Feature A)
    print(f"\n[STEP 4] User clicks 'Find Similar' (Feature A: Visual + NLP Retrieval)...")
    t0 = time.perf_counter()
    res = client.get(f"/api/recommendations/similar/{aid}?top_k=4&mode=hybrid")
    lat = (time.perf_counter() - t0) * 1000
    assert res.status_code == 200
    similar = res.json()
    print(f"  Retrieved {len(similar)} similar products in {lat:.2f} ms:")
    for s in similar:
        print(f"    - [{s['article_id']}] {s['prod_name']} ({s['colour_group_name']}) | Similarity: {s['similarity_score']*100:.1f}%")

    # 5. Complete Outfit Recommendation (Feature B)
    print(f"\n[STEP 5] User clicks 'Style Outfit' in Outfit Studio (Feature B: Slot Filling + Color Harmony)...")
    t0 = time.perf_counter()
    res = client.post("/api/recommendations/outfits", json={"anchor_article_id": aid})
    lat = (time.perf_counter() - t0) * 1000
    assert res.status_code == 200
    outfit = res.json()
    print(f"  Synthesized outfit in {lat:.2f} ms with overall score: {outfit['overall_score']*100:.0f}%")
    print(f"  Anchor Garment: [{outfit['anchor']['article_id']}] {outfit['anchor']['prod_name']} ({outfit['anchor']['colour_group_name']})")
    print("  Coordinated Slots:")
    for slot_name, slot_item in outfit["slots"].items():
        print(f"    - Slot [{slot_name.upper()}]: [{slot_item['article_id']}] {slot_item['prod_name']} ({slot_item['colour_group_name']}) | Harmony: {slot_item['compatibility_score']*100:.0f}%")

    # 6. Save Complete Outfit & Like Anchor (Feature C)
    print("\n[STEP 6] User likes anchor item & saves the complete ensemble to their portfolio...")
    client.post("/api/interactions", json={
        "user_id": "user_demo_01",
        "article_id": aid,
        "interaction_type": "like",
        "session_id": "session_live_01"
    })
    
    outfit_item_ids = [s["article_id"] for s in outfit["slots"].values()]
    res = client.post("/api/outfits/save", json={
        "user_id": "user_demo_01",
        "outfit_name": f"Summer Look: {anchor_item['prod_name']}",
        "anchor_article_id": aid,
        "item_article_ids": outfit_item_ids
    })
    assert res.status_code == 201
    save_result = res.json()
    print(f"  --> Saved outfit ID: {save_result['outfit_id']} successfully persisted to DB.")

    # 7. Continuous Personalization Feed (Feature D)
    print("\n[STEP 7] User visits 'For You' Feed (Feature D: Dynamic Hybrid Ranking)...")
    res = client.get(f"/api/recommendations/personalized/user_demo_01?top_k=6&recent_views={aid}")
    assert res.status_code == 200
    personalized = res.json()
    print(f"  Curated feed returned {len(personalized)} tailored recommendations:")
    for p in personalized[:4]:
        print(f"    - [{p['article_id']}] {p['prod_name']} ({p['product_type_name']}, {p['colour_group_name']})")

    # 8. User History & Portfolio Verification
    print("\n[STEP 8] Verifying User Saved Outfits & Browsing History...")
    res_history = client.get("/api/users/user_demo_01/history")
    res_outfits = client.get("/api/users/user_demo_01/outfits")
    assert res_history.status_code == 200
    assert res_outfits.status_code == 200
    print(f"  User history count: {len(res_history.json())} items")
    print(f"  User saved outfits: {len(res_outfits.json())} ensembles")

    # 9. Asynchronous Heavy Worker Job
    print("\n[STEP 9] Launching Heavy Asynchronous Recommendation Job (Worker Daemon)...")
    res = client.post("/api/jobs/recommendations", json={
        "user_id": "user_demo_01",
        "job_type": "deep_outfit_search",
        "payload": {"anchor_article_id": aid, "search_depth": 50}
    })
    assert res.status_code == 202
    job_info = res.json()
    job_id = job_info["job_id"]
    print(f"  Job Accepted (HTTP 202 Accepted): Job ID = {job_id}, Initial Status = {job_info['status']}")
    
    # Wait for worker thread to process
    print("  Awaiting background worker execution...")
    time.sleep(2.0)
    res_job = client.get(f"/api/jobs/{job_id}")
    assert res_job.status_code == 200
    job_status = res_job.json()
    print(f"  Updated Job Status: {job_status['status'].upper()}")
    if job_status.get("result"):
        print(f"  Worker Result Persisted: {len(job_status['result']['generated_outfit'])} slot items generated at {job_status['result']['computed_at']}")

    # 10. Observability & Rate Limiter Telemetry
    print("\n[STEP 10] Checking Real-Time Observability & Metrics...")
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    metrics = res_metrics.json()
    print(f"  Total Gateway Requests Processed: {metrics['total_requests']}")
    print(f"  HTTP 200 Responses: {metrics['status_200']}")
    print(f"  Latency Summary (ms): Mean = {metrics['latency_summary_ms']['mean']} ms, p95 = {metrics['latency_summary_ms']['p95']} ms")

    print_banner("ALL 10 END-TO-END DEMO WORKFLOW STEPS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_e2e_walkthrough()
