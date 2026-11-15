"""
backend/services/recommendation_service/main.py
AI Recommendation Microservice: Visual Similarity, Outfit Compatibility, and Personalization.
"""

import os
import sys
import time
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Query, Body, status
import pandas as pd
import numpy as np
import scipy.sparse as sp
from sklearn.metrics.pairwise import linear_kernel

from backend.common.schemas import ProductResponse, OutfitResponse, OutfitSlotItem, NodeHealth
from backend.common.redis_cache import cache

app = FastAPI(title="Fashion Recommendation Service", version="1.0.0")

# --- Initialize In-Memory ML Models and Artifacts ---
print("[REC SERVICE] Initializing ML Models & Vectors...")
DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
ARTIFACTS_MODELS_DIR = PROJECT_ROOT / "artifacts" / "models"
ARTIFACTS_EMBEDDINGS_DIR = PROJECT_ROOT / "artifacts" / "embeddings"

# 1. Catalog Metadata
df_articles = pd.read_parquet(DATA_PROCESSED_DIR / "hm_articles_cleaned.parquet")

def classify_gender(row):
    ig = str(row.get('index_group_name', '')).strip()
    idx = str(row.get('index_name', '')).strip()
    sec = str(row.get('section_name', '')).strip()
    if ig == 'Baby/Children' or 'children' in idx.lower() or 'baby' in idx.lower():
        return 'Kids'
    if ig == 'Menswear' or 'men ' in sec.lower() or 'menswear' in idx.lower() or sec.lower().startswith('men'):
        return 'Men'
    if ig == 'Ladieswear' or 'ladies' in idx.lower() or 'lingeries' in idx.lower() or 'ladies' in sec.lower():
        return 'Women'
    if ig == 'Sport' or idx == 'Sport':
        return 'Unisex'
    if ig == 'Divided':
        if 'men' in sec.lower():
            return 'Men'
        return 'Women'
    return 'Unisex'

df_articles['normalized_gender'] = df_articles.apply(classify_gender, axis=1)
article_meta = df_articles.set_index("article_id").to_dict("index")
all_articles = list(article_meta.keys())
aid2idx = {aid: idx for idx, aid in enumerate(df_articles["article_id"])}
idx2aid = {idx: aid for idx, aid in enumerate(df_articles["article_id"])}

# 2. TF-IDF Matrix
tfidf_matrix = sp.load_npz(ARTIFACTS_MODELS_DIR / "hm_tfidf_matrix.npz").tocsr()

# 3. Visual Embeddings
vis_embeddings = None
vis_aid2idx = {}
vis_aids = []
if (ARTIFACTS_EMBEDDINGS_DIR / "hm_image_embeddings.npy").exists():
    vis_embeddings = np.load(ARTIFACTS_EMBEDDINGS_DIR / "hm_image_embeddings.npy")
    with open(ARTIFACTS_EMBEDDINGS_DIR / "hm_image_aids.json", "r") as f:
        vis_aids = json.load(f)
    vis_aid2idx = {aid: idx for idx, aid in enumerate(vis_aids)}
    print(f"[REC SERVICE] Loaded {len(vis_embeddings):,} visual embeddings.")

# 4. Popular Items
df_train = pd.read_parquet(DATA_PROCESSED_DIR / "transactions_train_14w.parquet")
popular_articles = df_train["article_id"].value_counts().head(50).index.tolist()

# 5. Slot candidates partitioned by slot and gender scope
slot_candidates = {}
for slot in ["upper_body", "lower_body", "full_body", "shoes", "accessories"]:
    slot_df = df_articles[(df_articles["standard_category"] == slot) & (df_articles["has_image"] == 1)]
    slot_candidates[(slot, "all")] = slot_df["article_id"].tolist()
    slot_candidates[(slot, "Men")] = slot_df[slot_df["normalized_gender"].isin(["Men", "Unisex"])]["article_id"].tolist()
    slot_candidates[(slot, "Women")] = slot_df[slot_df["normalized_gender"].isin(["Women", "Unisex"])]["article_id"].tolist()

print("[REC SERVICE] ML Models, Indexes and Gender-Aware Slot Partitions Ready!")

# --- Recommendation Helpers ---
def format_item(aid: str, score: float = 1.0) -> dict:
    meta = article_meta.get(aid, {})
    img_path = meta.get("image_path", "")
    if pd.isna(img_path):
        img_path = ""
    return {
        "article_id": str(aid),
        "prod_name": "Fashion Item" if pd.isna(meta.get("prod_name")) else str(meta.get("prod_name")),
        "product_type_name": "Apparel" if pd.isna(meta.get("product_type_name")) else str(meta.get("product_type_name")),
        "product_group_name": "Garment" if pd.isna(meta.get("product_group_name")) else str(meta.get("product_group_name")),
        "colour_group_name": "Multi" if pd.isna(meta.get("colour_group_name")) else str(meta.get("colour_group_name")),
        "standard_category": "other" if pd.isna(meta.get("standard_category")) else str(meta.get("standard_category")),
        "gender": str(meta.get("normalized_gender", "Unisex")),
        "price_cents": 2999,
        "image_path": str(img_path),
        "has_image": bool(meta.get("has_image", 1)),
        "similarity_score": round(float(score), 4)
    }

UNIVERSAL_NEUTRALS = {"Black", "White", "Grey", "Light Beige", "Dark Blue"}
CURATED_HARMONY = {
    ("Black", "White"): 1.00,
    ("Dark Blue", "White"): 0.98,
    ("Dark Blue", "Light Beige"): 0.95,
    ("Dark Blue", "Grey"): 0.92,
    ("Black", "Grey"): 0.95,
    ("Black", "Light Beige"): 0.90,
    ("White", "Light Beige"): 0.92,
    ("Dark Blue", "Light Blue"): 0.95,
    ("White", "Light Blue"): 0.95,
    ("White", "Light Pink"): 0.90,
    ("Grey", "Light Pink"): 0.92,
    ("Black", "Red"): 0.88,
    ("White", "Red"): 0.90,
    ("Dark Blue", "Greenish Khaki"): 0.92,
    ("White", "Greenish Khaki"): 0.94
}

def color_harmony(c1: str, c2: str) -> float:
    if c1 == c2: return 0.85
    pair = tuple(sorted([c1, c2]))
    if pair in CURATED_HARMONY: return CURATED_HARMONY[pair]
    if c1 in UNIVERSAL_NEUTRALS or c2 in UNIVERSAL_NEUTRALS: return 0.80
    return 0.50

# --- API Endpoints ---
@app.get("/health", response_model=NodeHealth)
def health_check():
    return NodeHealth(
        name="recommendation_service",
        status="UP",
        details={
            "catalog_size": len(all_articles),
            "visual_vectors_indexed": len(vis_aids),
            "popular_pool_size": len(popular_articles)
        }
    )

@app.get("/recommendations/similar/{article_id}", response_model=List[ProductResponse])
def get_similar_items(
    article_id: str,
    top_k: int = Query(default=6, ge=1, le=24),
    mode: str = Query(default="hybrid", pattern="^(hybrid|visual|text)$"),
    filter_category: bool = Query(default=True),
    gender: Optional[str] = Query(default=None)
):
    """Feature A: Recommend Similar Clothing Items with slot and gender integrity."""
    cache_key = f"rec:similar:{article_id}:k{top_k}:m{mode}:fc{filter_category}:g{gender}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    if article_id not in article_meta:
        raise HTTPException(status_code=404, detail=f"Article '{article_id}' not found.")

    anchor_meta = article_meta[article_id]
    anchor_cat = anchor_meta.get("standard_category")

    scores = np.zeros(len(df_articles), dtype=np.float32)

    # 1. Text TF-IDF Channel
    if mode in ("hybrid", "text") and article_id in aid2idx:
        q_idx = aid2idx[article_id]
        text_sim = linear_kernel(tfidf_matrix[q_idx], tfidf_matrix).ravel()
        text_sim[q_idx] = -1.0
        scores += 0.50 * text_sim if mode == "hybrid" else text_sim

    # 2. Visual Embedding Channel
    if mode in ("hybrid", "visual") and vis_embeddings is not None and article_id in vis_aid2idx:
        vq_idx = vis_aid2idx[article_id]
        vis_sim = np.dot(vis_embeddings, vis_embeddings[vq_idx])
        vis_sim[vq_idx] = -1.0
        # Map visual indices to global articles
        for v_idx, sim in enumerate(vis_sim):
            aid = vis_aids[v_idx]
            if aid in aid2idx:
                scores[aid2idx[aid]] += 0.50 * sim if mode == "hybrid" else sim

    # Mask out query item
    if article_id in aid2idx:
        scores[aid2idx[article_id]] = -1.0

    # 3. Category slot integrity: enforce slot category consistency to eliminate cross-category contamination
    if filter_category and anchor_cat and anchor_cat != "other":
        cat_mask = (df_articles["standard_category"] == anchor_cat).values
        scores = np.where(cat_mask, scores, scores - 10.0)

    # 4. Gender scope filtering
    if gender:
        g_lower = gender.lower().strip()
        if g_lower == "men":
            gender_mask = df_articles["normalized_gender"].isin(["Men", "Unisex"]).values
            scores = np.where(gender_mask, scores, scores - 15.0)
        elif g_lower == "women":
            gender_mask = df_articles["normalized_gender"].isin(["Women", "Unisex"]).values
            scores = np.where(gender_mask, scores, scores - 15.0)

    top_indices = np.argsort(scores)[::-1][:top_k]
    valid_indices = [i for i in top_indices if scores[i] > -5.0]
    results = [format_item(idx2aid[i], float(scores[i])) for i in valid_indices]
    
    cache.set_json(cache_key, results, ttl_seconds=300)
    return results

@app.post("/recommendations/outfits", response_model=OutfitResponse)
def get_outfit_recommendations(
    payload: Dict[str, Any] = Body(...)
):
    """Feature B: Complete Outfit Recommendation with Gender Scope, Color Harmony & Resynthesize Diversity."""
    anchor_id = str(payload.get("anchor_article_id", popular_articles[0]))
    if anchor_id not in article_meta:
        anchor_id = popular_articles[0]

    anchor_meta = article_meta[anchor_id]
    anchor_slot = anchor_meta.get("standard_category", "upper_body")
    anchor_color = anchor_meta.get("colour_group_name", "Black")
    anchor_gender = anchor_meta.get("normalized_gender", "Women")

    # Scope gender: explicit payload scope > anchor item gender > Women
    requested_gender = payload.get("gender")
    if requested_gender and str(requested_gender).lower().strip() in ("men", "women"):
        target_gender = str(requested_gender).capitalize().strip()
    else:
        target_gender = "Men" if anchor_gender == "Men" else "Women"

    exclude_ids = set(str(x) for x in payload.get("exclude_ids", []))
    exclude_ids.add(anchor_id)
    resynthesize_count = int(payload.get("resynthesize_count", 0))

    cache_key = f"rec:outfit:{anchor_id}:g{target_gender}:r{resynthesize_count}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    # Structural slot constraints (Section 6: Configurable composition)
    if anchor_slot == "upper_body":
        needed_slots = ["lower_body", "shoes", "accessories"]
    elif anchor_slot == "lower_body":
        needed_slots = ["upper_body", "shoes", "accessories"]
    elif anchor_slot == "full_body":
        needed_slots = ["shoes", "accessories"]
    else:
        needed_slots = ["upper_body", "lower_body", "shoes"]

    outfit_slots = {}
    chosen_aids_in_outfit = set()
    total_harmony = 0.0

    for slot_idx, slot in enumerate(needed_slots):
        # 1. Retrieve gender-partitioned candidates for this slot
        candidates = slot_candidates.get((slot, target_gender))
        if not candidates:
            candidates = slot_candidates.get((slot, "all"), popular_articles)

        # 2. Score candidates by color harmony with anchor
        scored_candidates = []
        for cid in candidates[:150]:
            if cid in chosen_aids_in_outfit or cid == anchor_id:
                continue
            cmeta = article_meta.get(cid, {})
            if cmeta.get("standard_category") != slot:
                continue
            
            base_score = color_harmony(anchor_color, cmeta.get("colour_group_name", "Black"))
            # Apply severe penalty if product was already displayed in recent session history
            adjusted_score = base_score - 0.40 if cid in exclude_ids else base_score
            scored_candidates.append((cid, adjusted_score, base_score))

        # Sort by adjusted compatibility score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        # 3. Intelligent Diversity Selection (MMR / Controlled Exploration)
        if scored_candidates:
            top_pool = [c for c in scored_candidates if c[1] >= 0.70]
            if not top_pool:
                top_pool = scored_candidates[:10]
            else:
                top_pool = top_pool[:15]

            # Use deterministic offset based on resynthesize_count and slot_idx to cycle through distinct compatible pieces
            pick_idx = (resynthesize_count * 3 + slot_idx * 5) % len(top_pool)
            pick_cid, _, final_score = top_pool[pick_idx]
        else:
            pick_cid = candidates[0]
            final_score = 0.85

        chosen_aids_in_outfit.add(pick_cid)
        total_harmony += final_score

        pmeta = article_meta.get(pick_cid, {})
        outfit_slots[slot] = OutfitSlotItem(
            article_id=pick_cid,
            slot=slot,
            prod_name=pmeta.get("prod_name", "Apparel"),
            product_type_name=pmeta.get("product_type_name", "Garment"),
            colour_group_name=pmeta.get("colour_group_name", "Black"),
            gender=pmeta.get("normalized_gender", target_gender),
            image_path=pmeta.get("image_path", ""),
            compatibility_score=round(final_score, 2)
        )

    overall_score = round(total_harmony / len(needed_slots), 2) if needed_slots else 0.95

    response = OutfitResponse(
        anchor=OutfitSlotItem(
            article_id=anchor_id,
            slot=anchor_slot,
            prod_name=anchor_meta.get("prod_name", "Anchor Item"),
            product_type_name=anchor_meta.get("product_type_name", "Garment"),
            colour_group_name=anchor_color,
            gender=anchor_gender,
            image_path=anchor_meta.get("image_path", ""),
            compatibility_score=1.0
        ),
        slots=outfit_slots,
        overall_score=overall_score
    )

    cache.set_json(cache_key, response.dict(), ttl_seconds=300)
    return response

@app.get("/recommendations/personalized/{user_id}", response_model=List[ProductResponse])
def get_personalized_recommendations(
    user_id: str,
    top_k: int = Query(default=10, ge=1, le=30),
    gender: Optional[str] = Query(default=None),
    recent_views: Optional[str] = Query(default=None) # Comma-separated article_ids
):
    """Features C & D: Continuous Personalization Feed with Gender Scope."""
    cache_key = f"rec:user:{user_id}:k{top_k}:g{gender}:rv{recent_views}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    results = []
    seen_aids = set()

    # If user recently clicked/viewed items, blend recommendations across recent items
    if recent_views:
        recent_aids = [a.strip() for a in recent_views.split(",") if a.strip() in article_meta]
        for aid in recent_aids[-3:]:
            sim_items = get_similar_items(aid, top_k=4, mode="hybrid", filter_category=True, gender=gender)
            for it in sim_items:
                if it["article_id"] not in seen_aids and it["article_id"] != aid:
                    seen_aids.add(it["article_id"])
                    results.append(it)
                if len(results) >= top_k:
                    break
            if len(results) >= top_k:
                break

    # Fill remainder with trending popular items matching gender
    if len(results) < top_k:
        for aid in popular_articles:
            if aid not in seen_aids and aid in article_meta:
                meta = article_meta[aid]
                if gender:
                    g_lower = gender.lower().strip()
                    item_gender = meta.get("normalized_gender", "Women")
                    if g_lower == "men" and item_gender not in ("Men", "Unisex"):
                        continue
                    elif g_lower == "women" and item_gender not in ("Women", "Unisex"):
                        continue
                seen_aids.add(aid)
                results.append(format_item(aid, 0.85))
            if len(results) >= top_k:
                break

    cache.set_json(cache_key, results, ttl_seconds=180)
    return results[:top_k]
