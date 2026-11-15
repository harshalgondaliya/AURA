"""
backend/workers/tasks.py
Asynchronous Task Worker for Heavy Recommendation Jobs.
Updates PostgreSQL with status: pending -> processing -> completed / failed.
"""

import os
import sys
import time
import json
import uuid
import threading
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.common.database import SessionLocal
from backend.common.models import RecommendationJob, Product
from backend.common.redis_cache import cache

def process_heavy_recommendation_task(job_id: str, user_id: str, payload: dict):
    """
    Simulates / executes heavy asynchronous recommendation synthesis (e.g. multi-slot outfit generation).
    Updates PostgreSQL job record from pending -> processing -> completed.
    """
    db = SessionLocal()
    job = db.query(RecommendationJob).filter(RecommendationJob.job_id == job_id).first()
    if not job:
        db.close()
        return

    try:
        # 1. Update state to processing
        job.status = "processing"
        db.commit()
        print(f"[WORKER] Job {job_id}: status -> PROCESSING")
        
        # Simulate heavy ML work (e.g. cross-slot candidate scoring)
        time.sleep(1.5)
        
        # 2. Synthesize results
        anchor_id = payload.get("anchor_article_id", "0108775015")
        products = db.query(Product).filter(Product.has_image == True).limit(4).all()
        
        result_payload = {
            "anchor_id": anchor_id,
            "generated_outfit": [
                {
                    "slot": f"slot_{idx}",
                    "article_id": p.article_id,
                    "prod_name": p.prod_name,
                    "color": p.colour_group_name,
                    "image_path": p.image_path,
                    "score": 0.95 - (idx * 0.02)
                }
                for idx, p in enumerate(products)
            ],
            "computed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 3. Update state to completed and persist result
        job.status = "completed"
        job.result = result_payload
        db.commit()
        print(f"[WORKER] Job {job_id}: status -> COMPLETED (Persisted to DB)")
        
        # Update cache as well
        cache.set_json(f"job:{job_id}", {
            "job_id": job_id,
            "status": "completed",
            "result": result_payload
        }, ttl_seconds=600)
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        print(f"[WORKER] Job {job_id}: status -> FAILED ({e})")
    finally:
        db.close()

def submit_async_recommendation_job(user_id: str, job_type: str, payload: dict) -> str:
    """Creates a job record in DB, pushes to Redis task queue, and returns job_id."""
    job_uuid = f"job_{uuid.uuid4().hex[:12]}"
    db = SessionLocal()
    
    job = RecommendationJob(
        job_id=job_uuid,
        user_id=user_id,
        job_type=job_type,
        status="pending",
        payload=payload
    )
    db.add(job)
    db.commit()
    db.close()
    
    # 1. Push to Distributed Redis Task Queue
    task_data = {
        "job_id": job_uuid,
        "user_id": user_id,
        "payload": payload
    }
    pushed = cache.push_queue("queue:recommendation_tasks", task_data)
    print(f"[GATEWAY TASK] Enqueued job {job_uuid} into Redis queue: {pushed}")

    # 2. In standalone/local mode without separate daemon container, launch daemon thread
    worker_thread = threading.Thread(
        target=process_heavy_recommendation_task,
        args=(job_uuid, user_id, payload),
        daemon=True
    )
    worker_thread.start()
    
    return job_uuid
