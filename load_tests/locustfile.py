"""
load_tests/locustfile.py
Standard Locust Load-Testing Suite for AURA Platform.
Simulates realistic user browsing, recommendation synthesis, and heavy background jobs.

Usage:
  locust -f load_tests/locustfile.py --host http://localhost:8000
  locust -f load_tests/locustfile.py --headless -u 25 -r 5 --run-time 60s --host http://localhost:8000
"""

import random
from locust import HttpUser, task, between

class AuraShopperUser(HttpUser):
    """Simulates active shoppers browsing catalog, viewing details, and requesting similar items."""
    wait_time = between(1, 3)
    sample_aids = [
        "0108775015", "0108775044", "0108775051", "0110065001",
        "0110065002", "0111565001", "0111565003", "0111586001"
    ]
    categories = ["", "upper_body", "lower_body", "full_body", "shoes", "accessories"]
    genders = ["all", "women", "men"]

    @task(4)
    def browse_collection(self):
        """Browse catalog with filters."""
        cat = random.choice(self.categories)
        gen = random.choice(self.genders)
        self.client.get(f"/api/products?limit=10&page=1&category={cat}&gender={gen}", name="/api/products (browse)")

    @task(3)
    def view_product_detail(self):
        """View dedicated product detail page."""
        aid = random.choice(self.sample_aids)
        self.client.get(f"/api/products/{aid}", name="/api/products/{id} (detail)")

    @task(2)
    def find_similar_pieces(self):
        """Request AI similarity recommendations."""
        aid = random.choice(self.sample_aids)
        self.client.get(f"/api/recommendations/similar/{aid}?limit=6", name="/api/recommendations/similar/{id}")

    @task(1)
    def style_outfit(self):
        """Request complete coordinated outfit."""
        aid = random.choice(self.sample_aids)
        self.client.post(
            "/api/recommendations/outfits",
            json={"anchor_id": aid, "gender": "all"},
            name="/api/recommendations/outfits"
        )

    @task(1)
    def submit_background_job(self):
        """Submit heavy asynchronous styling task."""
        aid = random.choice(self.sample_aids)
        self.client.post(
            "/api/jobs/recommendations",
            json={"user_id": "locust_user", "job_type": "outfit_synthesis", "anchor_article_id": aid},
            name="/api/jobs/recommendations"
        )

    @task(1)
    def check_health(self):
        """Monitor system health."""
        self.client.get("/api/health", name="/api/health")
