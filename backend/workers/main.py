"""
backend/workers/main.py
Standalone Worker Daemon for Background Recommendation Tasks.
"""

import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.common.database import SessionLocal
from backend.common.models import RecommendationJob
from backend.common.redis_cache import cache
from backend.workers.tasks import process_heavy_recommendation_task

def run_worker_loop():
    print("[WORKER DAEMON] Starting Distributed Recommendation Task Worker daemon...")
    while True:
        try:
            # 1. First check Distributed Redis Queue
            task = cache.pop_queue("queue:recommendation_tasks", timeout=2)
            if task and isinstance(task, dict) and "job_id" in task:
                print(f"[WORKER DAEMON] Consumed task from Redis queue: {task['job_id']}")
                process_heavy_recommendation_task(task["job_id"], task.get("user_id", "demo"), task.get("payload", {}))
                continue

            # 2. Database fallback check for any unconsumed pending jobs
            db = SessionLocal()
            pending_jobs = (
                db.query(RecommendationJob)
                .filter(RecommendationJob.status == "pending")
                .limit(5)
                .all()
            )
            for job in pending_jobs:
                print(f"[WORKER DAEMON] Processing DB job {job.job_id} for user {job.user_id}...")
                process_heavy_recommendation_task(job.job_id, job.user_id, job.payload or {})
            db.close()
        except Exception as e:
            print(f"[WORKER DAEMON] Error in worker loop: {e}")
        time.sleep(1)

if __name__ == "__main__":
    run_worker_loop()
