"""
backend/services/user_service/main.py
User Management, Interaction Logging, and Saved Outfits Microservice.
"""

import os
import sys
import uuid
import time
from pathlib import Path
from typing import List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.common.database import get_db
from backend.common.models import User, UserInteraction, Product, SavedOutfit, OutfitItem
from backend.common.schemas import (
    InteractionCreate, InteractionResponse, SaveOutfitRequest,
    SavedOutfitResponse, ProductResponse, NodeHealth
)
from backend.common.redis_cache import cache

app = FastAPI(title="Fashion User Service", version="1.0.0")

@app.get("/health", response_model=NodeHealth)
def health_check(db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    try:
        user_cnt = db.query(User).count()
        interaction_cnt = db.query(UserInteraction).count()
        return NodeHealth(
            name="user_service",
            status="UP",
            latency_ms=round((time.perf_counter() - t0) * 1000, 2),
            details={"users": user_cnt, "interactions": interaction_cnt}
        )
    except Exception as e:
        return NodeHealth(name="user_service", status="DOWN", details={"error": str(e)})

def ensure_product_exists(db: Session, aid: str):
    p = db.query(Product).filter(Product.article_id == aid).first()
    if not p:
        p = Product(
            article_id=aid,
            prod_name=f"Fashion Item {aid}",
            product_type_name="Apparel",
            product_group_name="Garment",
            standard_category="apparel",
            colour_group_name="Multi",
            price_cents=2999,
            has_image=True
        )
        db.add(p)
        db.commit()
    return p

@app.post("/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
def record_interaction(interaction_in: InteractionCreate, db: Session = Depends(get_db)):
    """Feature C: Store user interactions (view, like, save, click, dismiss)."""
    # Ensure user exists or create automatically
    user = db.query(User).filter(User.user_id == interaction_in.user_id).first()
    if not user:
        user = User(user_id=interaction_in.user_id)
        db.add(user)
        db.commit()

    ensure_product_exists(db, interaction_in.article_id)

    interaction = UserInteraction(
        user_id=interaction_in.user_id,
        article_id=interaction_in.article_id,
        interaction_type=interaction_in.interaction_type,
        session_id=interaction_in.session_id,
        context=interaction_in.context
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    # Invalidate user recommendation & favorites cache on new interaction
    cache.delete(f"rec:user:{interaction_in.user_id}")
    cache.delete(f"favs:user:{interaction_in.user_id}")
    return interaction

@app.get("/users/{user_id}/history", response_model=List[ProductResponse])
def get_user_history(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Retrieve user's previously viewed/clicked products in reverse chronological order."""
    interactions = (
        db.query(UserInteraction)
        .filter(UserInteraction.user_id == user_id)
        .order_by(UserInteraction.created_at.desc())
        .limit(limit)
        .all()
    )
    
    seen = set()
    products = []
    for inter in interactions:
        if inter.article_id not in seen:
            seen.add(inter.article_id)
            prod = db.query(Product).filter(Product.article_id == inter.article_id).first()
            if prod:
                products.append(prod.to_dict())
    return products

@app.get("/users/{user_id}/favorites", response_model=List[ProductResponse])
def get_user_favorites(user_id: str, db: Session = Depends(get_db)):
    """Retrieve products currently liked/saved by user, reconciling likes and dismissals."""
    cache_key = f"favs:user:{user_id}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    # Query all like and dismiss interactions ordered by newest first
    interactions = (
        db.query(UserInteraction)
        .filter(
            UserInteraction.user_id == user_id,
            UserInteraction.interaction_type.in_(["like", "dismiss"])
        )
        .order_by(UserInteraction.created_at.desc())
        .all()
    )
    
    seen = set()
    active_favorite_aids = []
    for inter in interactions:
        if inter.article_id not in seen:
            seen.add(inter.article_id)
            if inter.interaction_type == "like":
                active_favorite_aids.append(inter.article_id)
                
    favorites = []
    for aid in active_favorite_aids:
        p = db.query(Product).filter(Product.article_id == aid, Product.is_active == True).first()
        if p:
            favorites.append(p.to_dict())
            
    cache.set_json(cache_key, favorites, ttl_seconds=60)
    return favorites

@app.post("/users/{user_id}/favorites/{article_id}")
def add_favorite(user_id: str, article_id: str, db: Session = Depends(get_db)):
    """Explicitly save a product to user favorites."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = User(user_id=user_id)
        db.add(user)
        db.commit()
    ensure_product_exists(db, article_id)
    interaction = UserInteraction(
        user_id=user_id,
        article_id=article_id,
        interaction_type="like",
        context="wishlist_toggle"
    )
    db.add(interaction)
    db.commit()
    cache.delete(f"favs:user:{user_id}")
    cache.delete(f"rec:user:{user_id}")
    return {"status": "saved", "article_id": article_id}

@app.delete("/users/{user_id}/favorites/{article_id}")
def remove_favorite(user_id: str, article_id: str, db: Session = Depends(get_db)):
    """Explicitly remove a product from user favorites."""
    interaction = UserInteraction(
        user_id=user_id,
        article_id=article_id,
        interaction_type="dismiss",
        context="wishlist_toggle"
    )
    db.add(interaction)
    db.commit()
    cache.delete(f"favs:user:{user_id}")
    cache.delete(f"rec:user:{user_id}")
    return {"status": "removed", "article_id": article_id}

@app.post("/outfits/save", status_code=status.HTTP_201_CREATED)
def save_outfit(req: SaveOutfitRequest, db: Session = Depends(get_db)):
    """Feature B & C: Save a complete outfit look with garment sizes."""
    ensure_product_exists(db, req.anchor_article_id)
    outfit_uuid = f"outfit_{uuid.uuid4().hex[:12]}"
    outfit = SavedOutfit(
        outfit_id=outfit_uuid,
        user_id=req.user_id,
        outfit_name=req.outfit_name,
        anchor_article_id=req.anchor_article_id,
        compatibility_score=0.96
    )
    db.add(outfit)
    db.commit()

    # Consolidate items ensuring anchor is always the primary garment
    all_items_to_save = []
    if req.anchor_article_id not in req.item_article_ids:
        anchor_sz = None
        if req.selected_sizes:
            anchor_sz = req.selected_sizes.get(req.anchor_article_id) or req.selected_sizes.get("anchor")
        all_items_to_save.append((req.anchor_article_id, "anchor", anchor_sz))

    for idx, aid in enumerate(req.item_article_ids):
        p_obj = db.query(Product).filter(Product.article_id == aid).first()
        slot_name = p_obj.standard_category if (p_obj and p_obj.standard_category) else f"slot_{idx+1}"
        chosen_sz = None
        if req.selected_sizes:
            chosen_sz = (
                req.selected_sizes.get(aid)
                or req.selected_sizes.get(slot_name)
                or req.selected_sizes.get(f"slot_{idx}")
                or req.selected_sizes.get(f"slot_{idx+1}")
            )
        all_items_to_save.append((aid, slot_name, chosen_sz))

    for aid, slot_name, chosen_sz in all_items_to_save:
        ensure_product_exists(db, aid)
        item = OutfitItem(
            outfit_id=outfit_uuid,
            article_id=aid,
            slot=slot_name,
            selected_size=chosen_sz
        )
        db.add(item)
    db.commit()
    return {"outfit_id": outfit_uuid, "message": "Outfit saved successfully!"}

@app.get("/users/{user_id}/outfits")
def get_saved_outfits(user_id: str, db: Session = Depends(get_db)):
    """Retrieve all outfits saved by the user."""
    outfits = db.query(SavedOutfit).filter(SavedOutfit.user_id == user_id).order_by(SavedOutfit.created_at.desc()).all()
    results = []
    for o in outfits:
        items = db.query(OutfitItem).filter(OutfitItem.outfit_id == o.outfit_id).all()
        prod_list = []
        for it in items:
            p = db.query(Product).filter(Product.article_id == it.article_id).first()
            if p:
                p_data = p.to_dict(selected_size=it.selected_size)
                p_data["slot"] = it.slot
                prod_list.append(p_data)
        results.append({
            "outfit_id": o.outfit_id,
            "outfit_name": o.outfit_name,
            "anchor_article_id": o.anchor_article_id,
            "compatibility_score": o.compatibility_score,
            "created_at": o.created_at,
            "items": prod_list
        })
    return results
