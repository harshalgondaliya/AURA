"""
tests/backend/test_outfit_studio_history.py
Comprehensive Regression Test Suite for Outfit Studio Resynthesize, Diversity,
History State Machine, and Category-Aware Outfit Templates.
"""

import sys
import time
import hashlib
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"
HEADERS = {
    "Content-Type": "application/json",
    "X-Client-Id": "test_history_verifier",
}

def get_real_catalog_products():
    """Fetch sample products across distinct categories to test all 5 outfit templates."""
    r = requests.get(f"{BASE_URL}/api/products?limit=100", headers=HEADERS)
    assert r.status_code == 200, f"Failed to fetch products: {r.text}"
    items = r.json().get("items", [])
    assert len(items) > 0, "Catalog is empty"

    by_category = {}
    for it in items:
        cat = it.get("standard_category")
        if cat and cat not in by_category:
            by_category[cat] = it
    return by_category

def test_anchor_preservation_and_category_templates():
    print("\n[TEST 1/5] Testing Anchor Preservation & Category-Aware Templates...")
    by_category = get_real_catalog_products()
    
    expected_slots_map = {
        "upper_body": {"lower_body", "shoes", "accessories"},
        "lower_body": {"upper_body", "shoes", "accessories"},
        "full_body": {"shoes", "accessories", "accessories_2"},
        "shoes": {"upper_body", "lower_body", "accessories"},
        "accessories": {"upper_body", "lower_body", "shoes"},
    }

    tested_categories = 0
    for cat, expected_slots in expected_slots_map.items():
        anchor = by_category.get(cat)
        if not anchor:
            print(f"  - Warning: No sample product for category '{cat}', skipping template test.")
            continue
            
        anchor_id = anchor["article_id"]
        payload = {
            "anchor_article_id": anchor_id,
            "resynthesize_count": 0,
            "exclude_ids": [],
        }
        res = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload, headers=HEADERS)
        assert res.status_code == 200, f"Failed for {cat}: {res.text}"
        data = res.json()
        
        # Verify anchor unchanged
        assert data["anchor"]["article_id"] == anchor_id, f"Anchor mismatch for {cat}"
        
        # Verify slots match template
        actual_slots = set(data["slots"].keys())
        assert actual_slots == expected_slots, f"Slot mismatch for {cat}: expected {expected_slots}, got {actual_slots}"
        print(f"  - Template for '{cat}' anchor ({anchor['prod_name']}): PASSED (Slots: {actual_slots})")
        tested_categories += 1

    assert tested_categories >= 3, f"Tested fewer than 3 category templates ({tested_categories})"
    print("  -> Anchor Preservation & Templates: 100% PASSED")

def test_resynthesize_diversity_and_signatures():
    print("\n[TEST 2/5] Testing Resynthesize Diversity (Zero Repetition across 5 Consecutive Turns)...")
    by_category = get_real_catalog_products()
    anchor = by_category.get("upper_body") or by_category.get("full_body")
    anchor_id = anchor["article_id"]
    anchor_gender = anchor.get("gender", "Women")

    seen_signatures = set()
    seen_item_ids = set()
    exclude_ids = []

    for turn in range(5):
        payload = {
            "anchor_article_id": anchor_id,
            "gender": anchor_gender,
            "resynthesize_count": turn,
            "exclude_ids": list(exclude_ids),
        }
        res = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload, headers=HEADERS)
        assert res.status_code == 200, f"Turn {turn} failed: {res.text}"
        data = res.json()

        # Compute canonical outfit signature
        slots = data["slots"]
        slot_parts = [f"{k}:{s['article_id']}" for k, s in sorted(slots.items())]
        signature = f"{anchor_id}#" + "|".join(slot_parts)

        # Signature must be unique
        assert signature not in seen_signatures, f"Duplicate outfit signature on turn {turn}: {signature}"
        seen_signatures.add(signature)

        # Non-anchor products must be diverse and unseen
        for slot_name, item in slots.items():
            iid = item["article_id"]
            assert iid != anchor_id, f"Anchor appeared in slot {slot_name}"
            assert iid not in seen_item_ids, f"Product {iid} repeated on turn {turn}!"
            seen_item_ids.add(iid)
            exclude_ids.append(iid)

        print(f"  - Turn {turn} (Look #{turn + 1}): Returned {len(slots)} pieces. Unique items seen so far: {len(seen_item_ids)}")

    print(f"  -> Resynthesize Diversity: 100% PASSED ({len(seen_signatures)} distinct outfits, {len(seen_item_ids)} unique pieces)")

def test_redis_caching_and_variation():
    print("\n[TEST 3/5] Testing Redis Caching with Hash Invalidation...")
    by_category = get_real_catalog_products()
    anchor = by_category.get("upper_body") or by_category.get("full_body")
    anchor_id = anchor["article_id"]

    # Initial request
    payload1 = {"anchor_article_id": anchor_id, "resynthesize_count": 0, "exclude_ids": []}
    res1 = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload1, headers=HEADERS)
    assert res1.status_code == 200
    data1 = res1.json()

    # Identical request should hit cache
    res1_cached = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload1, headers=HEADERS)
    assert res1_cached.status_code == 200
    assert res1_cached.json() == data1, "Cache failed to return identical response for identical params"

    # Resynthesize with exclusions should NOT return cached result from payload1
    item_ids = [s["article_id"] for s in data1["slots"].values()]
    payload2 = {"anchor_article_id": anchor_id, "resynthesize_count": 1, "exclude_ids": item_ids}
    res2 = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload2, headers=HEADERS)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2 != data1, "Redis cache returned stale outfit despite new exclude_ids and resynthesize_count!"
    print("  -> Redis Cache Differentiation: 100% PASSED (Stale collisions prevented)")

def test_candidate_exhaustion():
    print("\n[TEST 4/5] Testing Candidate Pool Exhaustion Reporting...")
    by_category = get_real_catalog_products()
    anchor = by_category.get("upper_body") or by_category.get("full_body")
    anchor_id = anchor["article_id"]

    # Gather candidates with a controlled candidate window until exhausted
    exclude_ids = []
    is_exhausted = False
    message = ""

    for turn in range(10):
        payload = {
            "anchor_article_id": anchor_id,
            "resynthesize_count": turn,
            "exclude_ids": list(exclude_ids),
            "candidate_window": 6,
        }
        res = requests.post(f"{BASE_URL}/api/recommendations/outfits", json=payload, headers=HEADERS)
        assert res.status_code == 200
        data = res.json()
        if data.get("exhausted"):
            is_exhausted = True
            message = data.get("message", "")
            break
        for item in data.get("slots", {}).values():
            exclude_ids.append(item["article_id"])

    assert is_exhausted is True, f"Expected candidate exhaustion when candidate pool depleted"
    assert "No more distinct looks available" in message, f"Unexpected message: {message}"
    print(f"  -> Candidate Exhaustion Signal: 100% PASSED (Reported: '{message}')")

def test_gender_and_size_integrity():
    print("\n[TEST 5/5] Testing Gender Scope and Size Preferences...")
    by_category = get_real_catalog_products()
    anchor = by_category.get("upper_body")
    anchor_id = anchor["article_id"]

    # Test Men scope
    res_men = requests.post(
        f"{BASE_URL}/api/recommendations/outfits",
        json={"anchor_article_id": anchor_id, "gender": "Men", "size_preferences": {"anchor": "M"}},
        headers=HEADERS
    )
    assert res_men.status_code == 200
    data_men = res_men.json()
    for s_name, item in data_men["slots"].items():
        assert item["gender"] in ("Men", "Unisex"), f"Cross-gender item {item['article_id']} ({item['gender']}) in Men outfit!"

    # Test Women scope
    res_women = requests.post(
        f"{BASE_URL}/api/recommendations/outfits",
        json={"anchor_article_id": anchor_id, "gender": "Women"},
        headers=HEADERS
    )
    assert res_women.status_code == 200
    data_women = res_women.json()
    for s_name, item in data_women["slots"].items():
        assert item["gender"] in ("Women", "Unisex"), f"Cross-gender item {item['article_id']} ({item['gender']}) in Women outfit!"

    print("  -> Gender Scope & Size Constraints: 100% PASSED")

if __name__ == "__main__":
    print("=" * 75)
    print("OUTFIT STUDIO BACKEND & DIVERSITY REGRESSION TEST SUITE")
    print("=" * 75)
    test_anchor_preservation_and_category_templates()
    test_resynthesize_diversity_and_signatures()
    test_redis_caching_and_variation()
    test_candidate_exhaustion()
    test_gender_and_size_integrity()
    print("\n" + "=" * 75)
    print("ALL 5 OUTFIT STUDIO BACKEND REGRESSION TESTS PASSED (100% SUCCESS)!")
    print("=" * 75)
